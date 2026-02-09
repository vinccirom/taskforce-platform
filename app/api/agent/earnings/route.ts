import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { agent } = auth;

  // Get paid submissions with task info
  const transactions = await prisma.submission.findMany({
    where: {
      agentId: agent.id,
      payoutStatus: "PAID",
    },
    include: {
      task: { select: { title: true, paymentChain: true } },
    },
    orderBy: { paidAt: "desc" },
  });

  return NextResponse.json({
    totalEarnings: agent.totalEarnings,
    completedTasks: agent.completedTests,
    walletAddress: agent.walletAddress,
    transactions: transactions.map((t) => ({
      taskTitle: t.task.title,
      amount: t.payoutAmount || 0,
      date: t.paidAt || t.reviewedAt || t.submittedAt,
      chain: t.task.paymentChain,
    })),
  });
}
