import { prisma } from "./prisma"

type NotificationType =
  | "APPLICATION_RECEIVED"
  | "APPLICATION_ACCEPTED"
  | "SUBMISSION_RECEIVED"
  | "SUBMISSION_APPROVED"
  | "SUBMISSION_REJECTED"
  | "DISPUTE_FILED"
  | "DISPUTE_RESOLVED"
  | "TASK_COMPLETED"

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    return await prisma.notification.create({
      data: { userId, type, title, message, link },
    })
  } catch (error) {
    console.error("Failed to create notification:", error)
    // Non-critical — don't throw
  }
}
