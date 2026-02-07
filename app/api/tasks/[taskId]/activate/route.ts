import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/components/auth/role-guard"
import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"

const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS || ""
const USDC_MINT = process.env.USDC_MINT || ""
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const MOCK_TRANSFERS = process.env.MOCK_TRANSFERS === "true" && process.env.NODE_ENV !== "production"

interface ActivateRequest {
  method: "privy" | "manual" | "solana-pay"
  transactionHash?: string
  reference?: string
  paymentChain?: "SOLANA" | "EVM"
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await context.params
    const session = await requireAuth()
    const body: ActivateRequest = await request.json()

    // Fetch task and verify ownership
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
        creatorId: session.user.id,
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: "Task not found or unauthorized" },
        { status: 404 }
      )
    }

    if (task.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Task is not in DRAFT status" },
        { status: 400 }
      )
    }

    const paymentChain = body.paymentChain || "SOLANA"

    // MOCK MODE: Skip verification
    if (MOCK_TRANSFERS) {
      console.log(`🎭 MOCK: Activating task ${taskId} (method: ${body.method}, chain: ${paymentChain})`)
      
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "ACTIVE", paymentChain },
      })

      return NextResponse.json({
        success: true,
        message: "Task activated (MOCK MODE)",
        transactionHash: body.transactionHash || `mock_${Date.now()}`,
      })
    }

    // REAL VERIFICATION
    const connection = new Connection(SOLANA_RPC_URL, "confirmed")
    
    // Use task-specific escrow wallet if available, otherwise fallback to platform wallet
    const targetWallet = task.escrowWalletAddress || PLATFORM_WALLET
    const platformPubkey = new PublicKey(targetWallet)
    const usdcMintPubkey = new PublicKey(USDC_MINT)

    let verified = false
    let transactionHash = body.transactionHash

    // L-03: Validate transaction hash format
    if (body.transactionHash) {
      if (!/^[a-zA-Z0-9]{64,128}$/.test(body.transactionHash)) {
        return NextResponse.json(
          { error: "Invalid transaction hash format" },
          { status: 400 }
        )
      }
    }

    switch (body.method) {
      case "privy": {
        // Verify specific transaction hash
        if (!body.transactionHash) {
          return NextResponse.json(
            { error: "Transaction hash required for Privy method" },
            { status: 400 }
          )
        }

        verified = await verifyTransaction(
          connection,
          body.transactionHash,
          platformPubkey,
          usdcMintPubkey,
          task.totalBudget
        )
        break
      }

      case "manual": {
        // Check recent transactions to platform wallet
        const result = await findRecentTransfer(
          connection,
          platformPubkey,
          usdcMintPubkey,
          task.totalBudget,
          600 // 10 minutes
        )

        if (result) {
          verified = true
          transactionHash = result.signature
        }
        break
      }

      case "solana-pay": {
        // Find transaction with reference key
        if (!body.reference) {
          return NextResponse.json(
            { error: "Reference required for Solana Pay method" },
            { status: 400 }
          )
        }

        const result = await findTransactionByReference(
          connection,
          platformPubkey,
          usdcMintPubkey,
          task.totalBudget,
          body.reference
        )

        if (result) {
          verified = true
          transactionHash = result.signature
        }
        break
      }

      default:
        return NextResponse.json(
          { error: "Invalid payment method" },
          { status: 400 }
        )
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Payment not found or verification failed" },
        { status: 400 }
      )
    }

    // Update task status to ACTIVE + record payment chain
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "ACTIVE",
        paymentChain,
        updatedAt: new Date(),
      },
    })

    console.log(`✅ Task ${taskId} activated. TX: ${transactionHash}`)

    return NextResponse.json({
      success: true,
      message: "Task activated successfully",
      transactionHash,
    })
  } catch (error: any) {
    console.error("Task activation error:", error)
    return NextResponse.json(
      { error: "Failed to activate task" },
      { status: 500 }
    )
  }
}

/**
 * Verify a specific transaction
 */
async function verifyTransaction(
  connection: Connection,
  signature: string,
  recipient: PublicKey,
  usdcMint: PublicKey,
  expectedAmount: number
): Promise<boolean> {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!tx || !tx.meta) return false

    return checkTransactionForTransfer(tx, recipient, usdcMint, expectedAmount)
  } catch (error) {
    console.error("Transaction verification error:", error)
    return false
  }
}

/**
 * Find recent USDC transfers to platform wallet
 */
async function findRecentTransfer(
  connection: Connection,
  recipient: PublicKey,
  usdcMint: PublicKey,
  expectedAmount: number,
  timeWindowSeconds: number
): Promise<{ signature: string } | null> {
  try {
    const signatures = await connection.getSignaturesForAddress(recipient, {
      limit: 20,
    })

    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - timeWindowSeconds

    for (const sigInfo of signatures) {
      // Check if within time window
      if (sigInfo.blockTime && sigInfo.blockTime < cutoff) continue

      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      })

      if (!tx || !tx.meta) continue

      if (checkTransactionForTransfer(tx, recipient, usdcMint, expectedAmount)) {
        return { signature: sigInfo.signature }
      }
    }

    return null
  } catch (error) {
    console.error("Find recent transfer error:", error)
    return null
  }
}

/**
 * Find transaction with specific reference key
 */
async function findTransactionByReference(
  connection: Connection,
  recipient: PublicKey,
  usdcMint: PublicKey,
  expectedAmount: number,
  reference: string
): Promise<{ signature: string } | null> {
  try {
    const referencePubkey = new PublicKey(reference)
    
    const signatures = await connection.getSignaturesForAddress(recipient, {
      limit: 20,
    })

    for (const sigInfo of signatures) {
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      })

      if (!tx || !tx.meta) continue

      // Check if transaction includes the reference key
      const hasReference = tx.transaction.message.accountKeys.some(
        (key) => key.pubkey.toBase58() === reference
      )

      if (
        hasReference &&
        checkTransactionForTransfer(tx, recipient, usdcMint, expectedAmount)
      ) {
        return { signature: sigInfo.signature }
      }
    }

    return null
  } catch (error) {
    console.error("Find transaction by reference error:", error)
    return null
  }
}

/**
 * Check if a parsed transaction contains a USDC transfer matching our criteria
 */
function checkTransactionForTransfer(
  tx: ParsedTransactionWithMeta,
  recipient: PublicKey,
  usdcMint: PublicKey,
  expectedAmount: number
): boolean {
  if (!tx.meta || tx.meta.err) return false

  const preBalances = tx.meta.preTokenBalances || []
  const postBalances = tx.meta.postTokenBalances || []

  // Find USDC token changes for recipient
  for (const postBalance of postBalances) {
    if (postBalance.mint !== usdcMint.toBase58()) continue
    if (postBalance.owner !== recipient.toBase58()) continue

    const preBalance = preBalances.find(
      (pre) =>
        pre.accountIndex === postBalance.accountIndex &&
        pre.mint === usdcMint.toBase58()
    )

    if (!preBalance) continue

    const preAmount = parseFloat(preBalance.uiTokenAmount.uiAmountString || "0")
    const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString || "0")
    const transferAmount = postAmount - preAmount

    // Check if transfer amount matches expected amount (with small tolerance for rounding)
    const tolerance = 0.01 // $0.01 tolerance
    if (Math.abs(transferAmount - expectedAmount) <= tolerance) {
      return true
    }
  }

  return false
}
