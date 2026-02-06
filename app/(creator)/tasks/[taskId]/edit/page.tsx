import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { notFound } from "next/navigation"
import { EditTaskForm } from "@/components/task/edit-task-form"

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const { taskId } = await params
  const session = await requireAuth()

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      milestones: { orderBy: { order: "asc" } },
    },
  })

  if (!task) notFound()

  // Must be creator
  if (task.creatorId !== session.user.id) notFound()

  // Can't edit terminal states
  if (["COMPLETED", "CANCELLED", "DISPUTED"].includes(task.status)) {
    notFound()
  }

  const isDraft = task.status === "DRAFT"

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <EditTaskForm
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            referenceUrl: task.referenceUrl || "",
            credentials: task.credentials || "",
            requirements: task.requirements,
            category: task.category,
            skillsRequired: task.skillsRequired || [],
            totalBudget: task.totalBudget,
            paymentType: task.paymentType,
            paymentPerWorker: task.paymentPerWorker ?? task.totalBudget,
            maxWorkers: task.maxWorkers,
            deadline: task.deadline?.toISOString() || null,
            milestones: task.milestones.map((m) => ({
              title: m.title,
              description: m.description || "",
              percentage: m.percentage,
            })),
          }}
          isDraft={isDraft}
        />
      </div>
    </AppShell>
  )
}
