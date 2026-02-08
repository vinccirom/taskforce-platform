import { NextResponse } from "next/server"
import { Connection, PublicKey } from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"

export async function GET() {
  const results: any = {}
  
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "missing"
    const usdcMint = process.env.USDC_MINT || "missing"
    const escrowAddress = "84Ccdje3LHGaMrnY3EQajTK7s4GAASzm2AiGCHRgWwAU"
    
    results.config = { rpcUrl: rpcUrl.substring(0, 30) + "...", usdcMint, escrowAddress }
    
    const connection = new Connection(rpcUrl, "confirmed")
    const escrowPubkey = new PublicKey(escrowAddress)
    const usdcMintPubkey = new PublicKey(usdcMint)
    
    // SOL balance
    const solBalance = await connection.getBalance(escrowPubkey)
    results.solBalance = solBalance / 1e9
    
    // ATA
    const ata = await getAssociatedTokenAddress(usdcMintPubkey, escrowPubkey)
    results.ata = ata.toBase58()
    
    // Token balance
    try {
      const tokenBalance = await connection.getTokenAccountBalance(ata)
      results.usdcBalance = tokenBalance.value.uiAmountString
      results.usdcRaw = tokenBalance.value.amount
    } catch (e: any) {
      results.tokenError = e.message
    }
    
    // Check signatures
    try {
      const sigs = await connection.getSignaturesForAddress(escrowPubkey, { limit: 5 })
      results.recentSignatures = sigs.map(s => ({ sig: s.signature.substring(0, 20) + "...", blockTime: s.blockTime }))
    } catch (e: any) {
      results.sigError = e.message
    }
    
  } catch (e: any) {
    results.error = e.message
  }
  
  return NextResponse.json(results)
}
