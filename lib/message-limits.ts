import { prisma } from "./prisma"

const PRE_ACCEPTANCE_MAX_MESSAGES = 1
const PRE_ACCEPTANCE_MAX_CHARS = 1000

/**
 * Check if a pending applicant is allowed to send a message.
 * Returns { allowed: true } or { allowed: false, error: string }.
 *
 * Rules:
 * - Creator: always allowed
 * - Accepted/Paid applicant: always allowed
 * - Pending applicant: max 1 USER message, max 1000 chars
 *   UNLESS the creator has replied after the applicant's first message (limit lifted)
 */
export async function checkPreAcceptanceLimit(
  taskId: string,
  senderId: string, // userId of sender
  senderAgentId: string | null, // agentId if agent
  creatorId: string,
  content: string
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  // Creator is always allowed
  if (senderId === creatorId) return { allowed: true }

  // Find the sender's application status
  const application = await prisma.application.findFirst({
    where: {
      taskId,
      agent: senderAgentId
        ? { id: senderAgentId }
        : { operatorId: senderId },
    },
    select: { status: true },
  })

  if (!application) return { allowed: true } // shouldn't happen, but don't block

  // Accepted/Paid/Completed — no limits
  if (application.status !== "PENDING") return { allowed: true }

  // --- Pending applicant rate limiting ---

  // Character limit
  if (content.length > PRE_ACCEPTANCE_MAX_CHARS) {
    return {
      allowed: false,
      error: `Messages before acceptance are limited to ${PRE_ACCEPTANCE_MAX_CHARS} characters.`,
    }
  }

  // Count sender's existing USER messages
  const senderMessages = await prisma.taskMessage.findMany({
    where: {
      taskId,
      type: "USER",
      OR: [
        ...(senderAgentId ? [{ agentId: senderAgentId }] : []),
        { senderId: senderId },
      ].filter(Boolean),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true },
  })

  if (senderMessages.length === 0) {
    // First message — allowed
    return { allowed: true }
  }

  // Already sent 1+ messages — check if creator replied after the first
  const firstMessage = senderMessages[0]
  const creatorReply = await prisma.taskMessage.findFirst({
    where: {
      taskId,
      type: "USER",
      senderId: creatorId,
      createdAt: { gt: firstMessage.createdAt },
    },
    select: { id: true },
  })

  if (creatorReply) {
    // Creator has replied — limit lifted
    return { allowed: true }
  }

  // No creator reply yet and already sent a message
  return {
    allowed: false,
    error:
      "You can send one message before your application is accepted. The creator will respond if interested.",
  }
}
