import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { privyId: user.userId },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const agent = await prisma.agent.findFirst({
    where: { operatorId: dbUser.id },
    select: { walletAddress: true },
  });

  if (!agent?.walletAddress) {
    return NextResponse.json({ usdcBalance: 0, solBalance: 0 });
  }

  try {
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const walletPubkey = new PublicKey(agent.walletAddress);

    const solBalance = await connection.getBalance(walletPubkey);

    let usdcBalance = 0;
    try {
      const usdcMint = new PublicKey(USDC_MINT_SOLANA);
      const tokenAccount = await getAssociatedTokenAddress(usdcMint, walletPubkey);
      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      usdcBalance = accountInfo.value.uiAmount || 0;
    } catch {
      // Token account doesn't exist = 0 balance
    }

    return NextResponse.json({
      usdcBalance,
      solBalance: solBalance / 1_000_000_000,
      walletAddress: agent.walletAddress,
    });
  } catch (error: any) {
    return NextResponse.json({ usdcBalance: 0, solBalance: 0, error: error.message });
  }
}
