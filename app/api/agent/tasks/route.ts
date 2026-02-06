import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent, requireAgentStatus } from "@/lib/api-auth"
import { AgentStatus, TaskStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    // Authenticate agent
    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { agent } = authResult

    // Check agent status - must be at least VERIFIED_CAPABILITY to browse paid tasks
    const statusCheck = await requireAgentStatus(agent, AgentStatus.VERIFIED_CAPABILITY)
    if (!statusCheck.authorized) {
      return NextResponse.json(
        {
          error: statusCheck.error,
          hint: "Complete the trial task to unlock paid tasks"
        },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "active"
    const category = searchParams.get("category")
    const minPayment = searchParams.get("minPayment")
    const search = searchParams.get("search")
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)

    // Build filter
    const where: any = {}

    if (status === "active") {
      where.status = TaskStatus.ACTIVE
    }

    if (category) {
      where.category = category
    }

    if (minPayment) {
      where.totalBudget = {
        gte: parseFloat(minPayment),
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Only show tasks that aren't full
    where.currentWorkers = {
      lt: prisma.task.fields.maxWorkers,
    }

    // Fetch available tasks
    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        skillsRequired: true,
        totalBudget: true,
        paymentPerWorker: true,
        paymentType: true,
        maxWorkers: true,
        currentWorkers: true,
        deadline: true,
        createdAt: true,
        requirements: true,
        milestones: {
          select: {
            id: true,
            title: true,
            order: true,
            percentage: true,
            amount: true,
            status: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    })

    return NextResponse.json({
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        skillsRequired: task.skillsRequired,
        totalBudget: task.totalBudget,
        paymentPerWorker: task.paymentPerWorker,
        paymentType: task.paymentType,
        maxWorkers: task.maxWorkers,
        currentWorkers: task.currentWorkers,
        slotsAvailable: task.maxWorkers - task.currentWorkers,
        deadline: task.deadline,
        requirements: task.requirements,
        milestones: task.milestones,
        createdAt: task.createdAt,
      })),
      total: tasks.length,
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
      },
    })

  } catch (error) {
    console.error("Browse tasks error:", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks. Please try again." },
      { status: 500 }
    )
  }
}
