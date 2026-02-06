import { prisma } from "@/lib/prisma"
import { transferUsdcToAgent } from "@/lib/payment"
import { createNotification } from "@/lib/notifications"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""
const NUM_JURORS = 3

// Three distinct models for diverse reasoning
const JUROR_MODELS = [
  "google/gemini-3-flash-preview",
  "anthropic/claude-sonnet-4.5",
  "deepseek/deepseek-v3.2",
]

interface JuryEvaluation {
  vote: "WORKER_PAID" | "REJECTION_UPHELD"
  reasoning: string
  confidence: number
}

/**
 * Run the AI jury evaluation for a dispute.
 * Each juror independently evaluates the submission against the task requirements.
 * They don't see: who created the task, who submitted, or the creator's rejection reason.
 */
export async function runJuryReview(disputeId: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      submission: {
        include: {
          task: {
            select: {
              title: true,
              description: true,
              requirements: true,
              category: true,
              skillsRequired: true,
            },
          },
          evidence: true,
        },
      },
    },
  })

  if (!dispute || !dispute.submission) {
    throw new Error("Dispute or submission not found")
  }

  // Mark as jury review in progress
  await prisma.dispute.update({
    where: { id: disputeId },
    data: { status: "JURY_REVIEW", juryStartedAt: new Date() },
  })

  const { submission } = dispute
  const { task } = submission

  // Build the blind evaluation prompt
  const evaluationContext = buildBlindContext(task, submission, dispute.reason)

  // Run all jurors in parallel (each with slightly different system prompts for diversity)
  const jurorPromises = Array.from({ length: NUM_JURORS }, (_, i) =>
    evaluateAsJuror(evaluationContext, i)
  )

  const results = await Promise.allSettled(jurorPromises)

  // Save votes
  for (let i = 0; i < NUM_JURORS; i++) {
    const result = results[i]
    if (result.status === "fulfilled") {
      await prisma.juryVote.create({
        data: {
          disputeId,
          jurorIndex: i,
          vote: result.value.vote,
          reasoning: result.value.reasoning,
          confidence: result.value.confidence,
        },
      })
    } else {
      // If a juror fails, record a neutral/failed vote
      await prisma.juryVote.create({
        data: {
          disputeId,
          jurorIndex: i,
          vote: "REJECTION_UPHELD", // Default to status quo on failure
          reasoning: `Juror evaluation failed: ${result.reason?.message || "Unknown error"}`,
          confidence: 0,
        },
      })
    }
  }

  // Tally votes
  const votes = await prisma.juryVote.findMany({ where: { disputeId } })
  const workerPaidVotes = votes.filter((v) => v.vote === "WORKER_PAID").length
  const juryVerdict = workerPaidVotes > NUM_JURORS / 2 ? "WORKER_PAID" : "REJECTION_UPHELD"

  // Move to human review
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: "HUMAN_REVIEW",
      juryCompletedAt: new Date(),
      juryVerdict,
    },
  })

  return { juryVerdict, votes }
}

/**
 * Build a context object stripped of identifying information.
 */
function buildBlindContext(
  task: { title: string; description: string; requirements: string; category: string; skillsRequired: string[] },
  submission: { feedback: string; deliverable: any; screenshots: string[]; evidence: any[] },
  disputeReason: string
) {
  return {
    taskTitle: task.title,
    taskDescription: task.description,
    taskRequirements: task.requirements,
    taskCategory: task.category,
    taskSkills: task.skillsRequired,
    submissionContent: submission.feedback,
    submissionDeliverable: submission.deliverable,
    hasScreenshots: submission.screenshots.length > 0,
    screenshotCount: submission.screenshots.length,
    evidenceCount: submission.evidence.length,
    workerDisputeReason: disputeReason,
  }
}

/**
 * Call the LLM as a specific juror.
 * Each juror gets a slightly different persona for diversity of perspective.
 */
async function evaluateAsJuror(context: any, jurorIndex: number): Promise<JuryEvaluation> {
  const personas = [
    "You are a strict but fair evaluator. Focus on whether the deliverable objectively meets the stated requirements. Look for concrete evidence of completion.",
    "You are an empathetic evaluator who considers effort and good faith. Focus on whether the worker made a genuine attempt to fulfill the requirements and delivered something of value.",
    "You are a technical evaluator who focuses on quality and completeness. Assess whether the submission demonstrates competence and thoroughness relative to the task description.",
  ]

  const systemPrompt = `${personas[jurorIndex]}

You are an anonymous juror evaluating a disputed work submission on a freelance platform.

IMPORTANT RULES:
- You are BLIND to the identities of the task creator and worker
- You do NOT know why the creator rejected the work — you must evaluate independently
- Base your decision ONLY on: the task requirements vs what was submitted
- Be objective and fair to both parties

You must return a JSON object with exactly these fields:
{
  "vote": "WORKER_PAID" or "REJECTION_UPHELD",
  "reasoning": "2-4 sentences explaining your decision",
  "confidence": 0.0 to 1.0
}

"WORKER_PAID" = The submission reasonably meets the task requirements; the worker should be paid.
"REJECTION_UPHELD" = The submission does not adequately meet the requirements; the rejection was fair.`

  const userPrompt = `## Task Requirements
**Title:** ${context.taskTitle}
**Category:** ${context.taskCategory}
**Skills:** ${context.taskSkills.join(", ") || "Not specified"}
**Description:** ${context.taskDescription}
**Requirements:** ${context.taskRequirements}

## Submission
**Content/Feedback:** ${context.submissionContent}
**Deliverable data:** ${context.submissionDeliverable ? JSON.stringify(context.submissionDeliverable).slice(0, 2000) : "None provided"}
**Screenshots:** ${context.screenshotCount} attached
**Evidence files:** ${context.evidenceCount} attached

## Worker's Dispute Reason
${context.workerDisputeReason}

---
Evaluate whether this submission meets the task requirements. Return your verdict as JSON.`

  const model = JUROR_MODELS[jurorIndex] || JUROR_MODELS[0]

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://taskforce.app",
      "X-Title": "TaskForce Dispute Jury",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter API error (${model}): ${response.status} ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) throw new Error("Empty response from juror")

  const parsed = JSON.parse(content)

  // Validate
  if (!["WORKER_PAID", "REJECTION_UPHELD"].includes(parsed.vote)) {
    throw new Error(`Invalid vote: ${parsed.vote}`)
  }

  return {
    vote: parsed.vote,
    reasoning: parsed.reasoning || "No reasoning provided",
    confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
  }
}

/**
 * Human reviewer makes final decision.
 */
export async function resolveDispute(
  disputeId: string,
  reviewerId: string,
  decision: "WORKER_PAID" | "REJECTION_UPHELD",
  notes: string
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      submission: {
        include: {
          task: {
            select: {
              escrowWalletId: true,
              escrowWalletAddress: true,
              paymentPerWorker: true,
            },
          },
          agent: {
            select: {
              walletAddress: true,
              name: true,
              operatorId: true,
            },
          },
        },
      },
    },
  })

  if (!dispute) throw new Error("Dispute not found")
  if (dispute.status !== "HUMAN_REVIEW") {
    throw new Error(`Dispute is in ${dispute.status} status, expected HUMAN_REVIEW`)
  }

  // Update dispute
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: "RESOLVED",
      humanReviewerId: reviewerId,
      humanDecision: decision,
      humanNotes: notes,
      humanReviewedAt: new Date(),
      outcome: decision,
      resolvedAt: new Date(),
    },
  })

  // Update submission based on outcome
  if (decision === "WORKER_PAID") {
    await prisma.submission.update({
      where: { id: dispute.submissionId },
      data: {
        status: "APPROVED",
        payoutStatus: "APPROVED",
      },
    })

    // Release funds from escrow to agent wallet
    const { submission } = dispute
    if (submission.agent.walletAddress && submission.task.paymentPerWorker) {
      try {
        const transferResult = await transferUsdcToAgent(
          submission.agent.walletAddress,
          submission.task.paymentPerWorker,
          submission.task.escrowWalletId ?? undefined,
          submission.task.escrowWalletAddress ?? undefined,
        )

        if (transferResult.success) {
          await prisma.submission.update({
            where: { id: dispute.submissionId },
            data: {
              payoutStatus: "PAID",
              paidAt: new Date(),
            },
          })
          console.log(`💸 Dispute resolved: escrow released to ${submission.agent.name}: ${transferResult.transactionHash}`)
        } else {
          console.error(`⚠️ Dispute payout transfer failed for submission ${dispute.submissionId}: ${transferResult.error}`)
        }
      } catch (transferError) {
        console.error(`⚠️ Dispute payout transfer error for submission ${dispute.submissionId}:`, transferError)
      }
    }
  } else {
    await prisma.submission.update({
      where: { id: dispute.submissionId },
      data: {
        status: "REJECTED",
        payoutStatus: "REFUNDED",
      },
    })
  }

  // Notify worker of dispute resolution
  if (dispute.submission.agent.operatorId) {
    const outcomeText = decision === "WORKER_PAID"
      ? "resolved in your favor — payment approved"
      : "resolved — rejection upheld"
    createNotification(
      dispute.submission.agent.operatorId,
      "DISPUTE_RESOLVED",
      "Dispute resolved",
      `Your dispute was ${outcomeText}`,
      `/my-tasks`
    ).catch(() => {})
  }

  return { outcome: decision }
}
