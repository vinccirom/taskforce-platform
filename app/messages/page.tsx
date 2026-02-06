import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

export default async function MessagesPage() {
  const session = await requireAuth()
  const userId = session.user.id

  // Find all tasks where user is creator OR accepted worker (via agent operator)
  const [createdTasks, workerApplications] = await Promise.all([
    // Tasks the user created (that have any messages)
    prisma.task.findMany({
      where: {
        creatorId: userId,
        messages: { some: {} },
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
        applications: {
          where: { status: "ACCEPTED" },
          include: {
            agent: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Tasks where user is an accepted worker's operator
    prisma.application.findMany({
      where: {
        status: "ACCEPTED",
        agent: { operatorId: userId },
        task: {
          messages: { some: {} },
        },
      },
      include: {
        task: {
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                sender: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
            _count: {
              select: { messages: true },
            },
            creator: {
              select: { name: true, email: true },
            },
          },
        },
      },
    }),
  ])

  // Also get tasks the user created that have no messages yet but have accepted workers
  // (so they can start a conversation)
  const emptyConversations = await prisma.task.findMany({
    where: {
      creatorId: userId,
      messages: { none: {} },
      applications: { some: { status: "ACCEPTED" } },
      status: { in: ["ACTIVE", "IN_PROGRESS"] },
    },
    include: {
      applications: {
        where: { status: "ACCEPTED" },
        include: {
          agent: { select: { name: true } },
        },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  // Build unified conversation list
  type Conversation = {
    taskId: string
    taskTitle: string
    otherParty: string
    lastMessage: string | null
    lastMessageAt: Date | null
    lastSenderName: string | null
    isLastSenderMe: boolean
    messageCount: number
    role: "creator" | "worker"
  }

  const conversations: Conversation[] = []

  // From created tasks
  for (const task of createdTasks) {
    const lastMsg = task.messages[0] || null
    const workerNames = task.applications.map((a) => a.agent.name).join(", ")

    conversations.push({
      taskId: task.id,
      taskTitle: task.title,
      otherParty: workerNames || "No worker yet",
      lastMessage: lastMsg?.content || null,
      lastMessageAt: lastMsg?.createdAt || null,
      lastSenderName: lastMsg?.sender?.name || lastMsg?.sender?.email || (lastMsg?.type === "SYSTEM" ? "System" : null),
      isLastSenderMe: lastMsg?.sender?.id === userId,
      messageCount: task._count.messages,
      role: "creator",
    })
  }

  // From worker applications
  for (const app of workerApplications) {
    const task = app.task
    // Skip if already in list (user is both creator and worker — unlikely but safe)
    if (conversations.some((c) => c.taskId === task.id)) continue

    const lastMsg = task.messages[0] || null

    conversations.push({
      taskId: task.id,
      taskTitle: task.title,
      otherParty: task.creator.name || task.creator.email || "Creator",
      lastMessage: lastMsg?.content || null,
      lastMessageAt: lastMsg?.createdAt || null,
      lastSenderName: lastMsg?.sender?.name || lastMsg?.sender?.email || (lastMsg?.type === "SYSTEM" ? "System" : null),
      isLastSenderMe: lastMsg?.sender?.id === userId,
      messageCount: task._count.messages,
      role: "worker",
    })
  }

  // Empty conversations (tasks with accepted workers but no messages)
  for (const task of emptyConversations) {
    if (conversations.some((c) => c.taskId === task.id)) continue

    const workerNames = task.applications.map((a) => a.agent.name).join(", ")

    conversations.push({
      taskId: task.id,
      taskTitle: task.title,
      otherParty: workerNames || "Worker",
      lastMessage: null,
      lastMessageAt: null,
      lastSenderName: null,
      isLastSenderMe: false,
      messageCount: 0,
      role: "creator",
    })
  }

  // Sort by last message time (most recent first), empty convos at the end
  conversations.sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0
    if (!a.lastMessageAt) return 1
    if (!b.lastMessageAt) return -1
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
  })

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Messages</h1>
          <p className="text-muted-foreground">
            Conversations with task creators and workers
          </p>
        </div>

        {conversations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Messages will appear here once you&apos;re working on a task or have
                accepted a worker on one of your tasks.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {conversations.map((convo) => (
              <Link key={convo.taskId} href={`/tasks/${convo.taskId}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="flex items-start gap-4 py-4">
                    {/* Avatar / Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MessageSquare className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: task title + time */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">
                            {convo.taskTitle}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {convo.role === "creator" ? "Worker" : "Creator"}:{" "}
                            <span className="font-medium">{convo.otherParty}</span>
                          </p>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          {convo.lastMessageAt && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(convo.lastMessageAt, {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                          {convo.messageCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {convo.messageCount}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Last message preview */}
                      {convo.lastMessage ? (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {convo.isLastSenderMe ? (
                            <span className="text-foreground/70">You: </span>
                          ) : convo.lastSenderName ? (
                            <span className="text-foreground/70">
                              {convo.lastSenderName}:{" "}
                            </span>
                          ) : null}
                          {convo.lastMessage}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          No messages yet — start the conversation
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
