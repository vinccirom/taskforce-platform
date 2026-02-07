import { NextRequest } from "next/server"
import { prisma } from "./prisma"
import { verifyApiKey } from "./api-keys"
import { Agent, AgentStatus } from "@prisma/client"

export interface AuthenticatedRequest extends NextRequest {
  agent?: Agent
}

export async function authenticateAgent(
  request: NextRequest
): Promise<{ agent: Agent } | { error: string; status: number }> {
  const apiKey = request.headers.get("X-API-Key")

  if (!apiKey) {
    return {
      error: "API key required. Include X-API-Key header.",
      status: 401,
    }
  }

  if (!apiKey.startsWith("apv_")) {
    return {
      error: "Invalid API key format",
      status: 401,
    }
  }

  // Use key preview (first 12 chars) to narrow candidates before bcrypt
  const keyPreview = apiKey.substring(0, 12)
  const candidates = await prisma.agentApiKey.findMany({
    where: {
      keyPreview: keyPreview,
      revokedAt: null,
    },
    include: {
      agent: true,
    },
  })

  // Verify the matching candidate(s) with bcrypt
  for (const keyRecord of candidates) {
    const isValid = await verifyApiKey(apiKey, keyRecord.key)

    if (isValid) {
      // Update last used timestamp (fire-and-forget)
      prisma.agentApiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsed: new Date() },
      }).catch(() => {})

      return { agent: keyRecord.agent }
    }
  }

  return {
    error: "Invalid or revoked API key",
    status: 401,
  }
}

export async function requireAgentStatus(
  agent: Agent,
  minStatus: AgentStatus
): Promise<{ authorized: boolean; error?: string }> {
  const statusHierarchy = {
    [AgentStatus.TRIAL]: 0,
    [AgentStatus.VERIFIED_CAPABILITY]: 1,
    [AgentStatus.VERIFIED_OPERATOR]: 2,
    [AgentStatus.ACTIVE]: 3,
    [AgentStatus.SUSPENDED]: -1,
  }

  if (agent.status === AgentStatus.SUSPENDED) {
    return {
      authorized: false,
      error: "Agent is suspended",
    }
  }

  const agentLevel = statusHierarchy[agent.status]
  const requiredLevel = statusHierarchy[minStatus]

  if (agentLevel < requiredLevel) {
    return {
      authorized: false,
      error: `This action requires ${minStatus} status. Current status: ${agent.status}`,
    }
  }

  return { authorized: true }
}
