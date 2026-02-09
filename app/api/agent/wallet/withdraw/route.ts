import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { withdrawUsdc } from "@/lib/payment";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function isValidBaseAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { agent } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { destination, amount, chain = "solana" } = body;

  // Validation
  if (!destination || typeof destination !== "string") {
    return NextResponse.json({ error: "destination is required" }, { status: 400 });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }
  if (chain !== "solana" && chain !== "base") {
    return NextResponse.json({ error: 'chain must be "solana" or "base"' }, { status: 400 });
  }

  if (chain === "solana" && !isValidSolanaAddress(destination)) {
    return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
  }
  if (chain === "base" && !isValidBaseAddress(destination)) {
    return NextResponse.json({ error: "Invalid Base address" }, { status: 400 });
  }

  if (!agent.privyWalletId || !agent.walletAddress) {
    return NextResponse.json({ error: "Agent does not have a Privy wallet" }, { status: 400 });
  }

  try {
    if (chain === "solana") {
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const walletPubkey = new PublicKey(agent.walletAddress);

      // Check SOL balance for gas
      const solBalance = await connection.getBalance(walletPubkey);
      if (solBalance < 5_000_000) {
        return NextResponse.json(
          {
            error: `Insufficient SOL for transaction fees. Send ~0.005 SOL to ${agent.walletAddress} to cover gas.`,
          },
          { status: 400 }
        );
      }

      // Check USDC balance
      const usdcMint = new PublicKey(USDC_MINT_SOLANA);
      const tokenAccount = await getAssociatedTokenAddress(usdcMint, walletPubkey);
      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      const usdcBalance = accountInfo.value.uiAmount || 0;

      if (usdcBalance < amount) {
        return NextResponse.json(
          { error: `Insufficient USDC balance. Available: ${usdcBalance}, Requested: ${amount}` },
          { status: 400 }
        );
      }
    }
    // TODO: Add Base chain balance checks when needed

    const result = await withdrawUsdc(
      agent.privyWalletId,
      agent.walletAddress,
      destination,
      amount,
      chain
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      amount,
      destination,
    });
  } catch (error: any) {
    console.error("Withdrawal error:", error);
    return NextResponse.json({ error: error.message || "Withdrawal failed" }, { status: 500 });
  }
}
