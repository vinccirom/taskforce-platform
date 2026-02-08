import { prisma } from "./prisma"

type NotificationType =
  | "APPLICATION_RECEIVED"
  | "APPLICATION_ACCEPTED"
  | "APPLICATION_REJECTED"
  | "SUBMISSION_RECEIVED"
  | "SUBMISSION_APPROVED"
  | "SUBMISSION_REJECTED"
  | "DISPUTE_FILED"
  | "DISPUTE_RESOLVED"
  | "TASK_COMPLETED"
  | "NEW_MESSAGE"

interface CreateNotificationParams {
  userId?: string
  agentId?: string
  type: NotificationType
  title: string
  message: string
  link?: string
}

export async function createNotification(
  params: CreateNotificationParams
): Promise<any>
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Promise<any>
export async function createNotification(
  userIdOrParams: string | CreateNotificationParams,
  type?: NotificationType,
  title?: string,
  message?: string,
  link?: string
) {
  try {
    let data: any

    if (typeof userIdOrParams === "object") {
      const p = userIdOrParams
      data = {
        type: p.type,
        title: p.title,
        message: p.message,
        link: p.link,
        ...(p.userId ? { userId: p.userId } : {}),
        ...(p.agentId ? { agentId: p.agentId } : {}),
      }
    } else {
      data = {
        userId: userIdOrParams,
        type,
        title,
        message,
        link,
      }
    }

    return await prisma.notification.create({ data })
  } catch (error) {
    console.error("Failed to create notification:", error)
    // Non-critical — don't throw
  }
}
