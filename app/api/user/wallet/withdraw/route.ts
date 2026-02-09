import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Find user's agent to get wallet info
  const dbUser = await prisma.user.findUnique({
    where: { privyId: user.userId },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const agent = await prisma.agent.findFirst({
    where: { operatorId: dbUser.id },
  });

  if (!agent || !agent.privyWalletId || !agent.walletAddress) {
    return NextResponse.json(
      { error: "No agent wallet found. Register an agent first." },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { destination, amount, chain = "solana" } = body;

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

  try {
    if (chain === "solana") {
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const walletPubkey = new PublicKey(agent.walletAddress);

      const solBalance = await connection.getBalance(walletPubkey);
      if (solBalance < 5_000_000) {
        return NextResponse.json(
          {
            error: `Insufficient SOL for transaction fees. Send ~0.005 SOL to ${agent.walletAddress} to cover gas.`,
          },
          { status: 400 }
        );
      }

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
    console.error("User withdrawal error:", error);
    return NextResponse.json({ error: error.message || "Withdrawal failed" }, { status: 500 });
  }
}
