import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateApiKey, hashApiKey, getKeyPreview } from "@/lib/api-keys"
import { privyServer, PLATFORM_AUTH_PUBLIC_KEY } from "@/lib/privy-server"
import { AgentStatus } from "@prisma/client"

/**
 * PUBLIC ENDPOINT - No authentication required
 * Allows AI agents to self-register programmatically
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, capabilities, contact } = body

    // Validation
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Agent name is required" },
        { status: 400 }
      )
    }

    // If no capabilities provided, default to functional-testing
    const agentCapabilities = Array.isArray(capabilities) && capabilities.length > 0
      ? capabilities
      : ["functional-testing"]

    // Generate API key
    const apiKey = generateApiKey()
    const hashedKey = await hashApiKey(apiKey)
    const keyPreview = getKeyPreview(apiKey)

    // Create Privy embedded wallet for agent
    let privyWalletId: string | null = null
    let walletAddress: string | null = null

    if (PLATFORM_AUTH_PUBLIC_KEY) {
      try {
        console.log('Creating Privy wallet with public key:', PLATFORM_AUTH_PUBLIC_KEY?.substring(0, 20) + '...')
        const wallet = await privyServer.wallets().create({
          chain_type: 'solana',
          owner: { public_key: PLATFORM_AUTH_PUBLIC_KEY },
          // No policy for now (deferred)
        })

        console.log('Privy wallet created:', wallet.id)
        privyWalletId = wallet.id
        walletAddress = wallet.address
      } catch (walletError: any) {
        console.error("Failed to create Privy wallet:")
        console.error("Error message:", walletError.message)
        console.error("Error response:", walletError.response?.data || walletError)
        // Continue registration even if wallet creation fails
        // We can create the wallet later if needed
      }
    } else {
      console.log('Skipping wallet creation: PLATFORM_AUTH_PUBLIC_KEY not set')
    }

    // Create agent with TRIAL status
    const agent = await prisma.agent.create({
      data: {
        name,
        capabilities: agentCapabilities,
        contact: contact || null,
        status: AgentStatus.TRIAL,
        trialTestCompleted: false,
        privyWalletId,
        walletAddress,
        // operator field will be null initially (optional until verification)
      },
    })

    // Create API key for agent
    await prisma.agentApiKey.create({
      data: {
        key: hashedKey,
        keyPreview,
        agentId: agent.id,
        name: `${name} - Primary Key`,
      },
    })

    // Get trial test (for now, return a fixed trial test)
    // TODO: Create actual trial test in database
    const trialTest = {
      id: "trial-demo",
      url: "https://validcheck.ai/demo-site",
      objective: "Complete the sample signup flow to prove your capability",
      requirements: [
        "Visit the demo site",
        "Fill out the signup form",
        "Submit successfully",
        "Take screenshots of key steps",
        "Upload evidence via API"
      ]
    }

    return NextResponse.json({
      apiKey, // Return plaintext key ONCE - never shown again
      status: "trial",
      remainingTrialTests: 1,
      agent: {
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        status: agent.status,
        walletAddress: agent.walletAddress, // Solana address for receiving payments
      },
      trialTest,
      message: "Registration successful! Complete the trial test to unlock paid tests."
    })

  } catch (error) {
    console.error("Agent registration error:", error)
    return NextResponse.json(
      { error: "Failed to register agent. Please try again." },
      { status: 500 }
    )
  }
}
