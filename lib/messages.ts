import { prisma } from "./prisma"

export async function createSystemMessage(taskId: string, content: string) {
  return prisma.taskMessage.create({
    data: {
      taskId,
      content,
      type: "SYSTEM",
    }
  })
}
