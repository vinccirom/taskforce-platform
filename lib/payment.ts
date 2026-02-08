/**
 * Payment utilities for USDC transfers
 * Handles transfers from platform wallet to agent wallets via Privy
 */

import {
  privyServer,
  PLATFORM_ESCROW_WALLET_ID,
  PLATFORM_WALLET_ADDRESS,
  PLATFORM_AUTH_PRIVATE_KEY,
} from './privy-server';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

// Solana RPC endpoint
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// USDC token mint address
const USDC_MINT_ADDRESS = process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export interface TransferResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Transfer USDC from escrow wallet to agent wallet
 *
 * @param agentWalletAddress - Solana address of agent's wallet
 * @param amountUsdc - Amount in USDC (e.g., 5.50 for $5.50)
 * @param fromWalletId - Source wallet ID (task escrow or platform escrow). If not provided, uses platform escrow.
 * @param fromWalletAddress - Source wallet address. If not provided, uses platform wallet address.
 * @returns Transaction result
 */
export async function transferUsdcToAgent(
  agentWalletAddress: string,
  amountUsdc: number,
  fromWalletId?: string,
  fromWalletAddress?: string
): Promise<TransferResult> {
  // Use provided wallet or fallback to platform escrow
  const sourceWalletId = fromWalletId || PLATFORM_ESCROW_WALLET_ID;
  const sourceWalletAddress = fromWalletAddress || PLATFORM_WALLET_ADDRESS;

  if (!sourceWalletId || !sourceWalletAddress) {
    return {
      success: false,
      error: 'Source wallet not configured',
    };
  }

  // MOCK MODE: For testing without real USDC (disabled in production)
  if (process.env.MOCK_TRANSFERS === 'true' && process.env.NODE_ENV !== 'production') {
    console.log(`🎭 MOCK: Simulating ${amountUsdc} USDC transfer to ${agentWalletAddress}`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    const mockTxHash = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(`✅ MOCK: Transfer successful! TX: ${mockTxHash}`);
    return {
      success: true,
      transactionHash: mockTxHash,
    };
  }

  try {
    // Convert USDC amount to lamports (USDC has 6 decimals)
    const amountLamports = Math.floor(amountUsdc * 1_000_000);

    console.log(`💸 Transferring ${amountUsdc} USDC (${amountLamports} lamports) to ${agentWalletAddress}`);

    // Create Solana connection
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Convert addresses to PublicKeys
    const fromPubkey = new PublicKey(sourceWalletAddress);
    const toPubkey = new PublicKey(agentWalletAddress);
    const mintPubkey = new PublicKey(USDC_MINT_ADDRESS);

    // Get associated token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      fromPubkey
    );

    const toTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      toPubkey
    );

    // Check if recipient token account exists
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);

    // Build transaction
    const transaction = new Transaction();

    // If recipient doesn't have a token account, create it first
    if (!toAccountInfo) {
      console.log('Creating associated token account for recipient...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey, // payer
          toTokenAccount, // associated token account
          toPubkey, // owner
          mintPubkey // mint
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        fromTokenAccount, // source
        toTokenAccount, // destination
        fromPubkey, // owner
        amountLamports // amount
      )
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Serialize transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Sign and send via Privy with authorization context
    const result = await privyServer.wallets().solana().signAndSendTransaction(
      sourceWalletId,
      {
        transaction: serializedTransaction.toString('base64'),
        caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana Mainnet
        authorization_context: {
          authorization_private_keys: [PLATFORM_AUTH_PRIVATE_KEY || ''],
        },
      }
    );

    console.log('✅ Transfer successful:', result.transaction_id);

    return {
      success: true,
      transactionHash: result.transaction_id,
    };
  } catch (error: any) {
    console.error('❌ Transfer failed:', error.message);
    console.error('Error details:', error);
    return {
      success: false,
      error: error.message || 'Transfer failed',
    };
  }
}

// Platform revenue wallet for fees
const PLATFORM_REVENUE_SOLANA = process.env.PLATFORM_REVENUE_SOLANA || '';

// Cancellation fee percentage
const CANCELLATION_FEE_PERCENT = 5;

/**
 * Refund USDC from escrow wallet back to creator, minus platform fee
 *
 * @param creatorWalletAddress - Solana address of creator's wallet
 * @param escrowWalletId - Privy wallet ID of the task escrow
 * @param escrowWalletAddress - Solana address of the escrow wallet
 * @param totalAmount - Total USDC in escrow
 * @returns Transaction result
 */
export async function refundEscrowToCreator(
  creatorWalletAddress: string,
  escrowWalletId: string,
  escrowWalletAddress: string,
  totalAmount: number,
): Promise<TransferResult> {
  if (!PLATFORM_REVENUE_SOLANA) {
    return { success: false, error: 'Platform revenue wallet not configured' };
  }

  // Calculate fee and refund amounts
  const feeAmount = Math.floor((totalAmount * CANCELLATION_FEE_PERCENT) / 100 * 1_000_000) / 1_000_000;
  const refundAmount = totalAmount - feeAmount;
  const feeLamports = Math.floor(feeAmount * 1_000_000);
  const refundLamports = Math.floor(refundAmount * 1_000_000);

  console.log(`💸 Refund: ${refundAmount} USDC to creator, ${feeAmount} USDC (${CANCELLATION_FEE_PERCENT}%) fee to platform`);

  if (process.env.MOCK_TRANSFERS === 'true' && process.env.NODE_ENV !== 'production') {
    console.log(`🎭 MOCK: Simulating refund of ${refundAmount} USDC to ${creatorWalletAddress}`);
    return {
      success: true,
      transactionHash: `mock_refund_${Date.now()}`,
    };
  }

  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const escrowPubkey = new PublicKey(escrowWalletAddress);
    const creatorPubkey = new PublicKey(creatorWalletAddress);
    const revenuePubkey = new PublicKey(PLATFORM_REVENUE_SOLANA);
    const mintPubkey = new PublicKey(USDC_MINT_ADDRESS);

    // Get token accounts
    const escrowTokenAccount = await getAssociatedTokenAddress(mintPubkey, escrowPubkey);
    const creatorTokenAccount = await getAssociatedTokenAddress(mintPubkey, creatorPubkey);
    const revenueTokenAccount = await getAssociatedTokenAddress(mintPubkey, revenuePubkey);

    const transaction = new Transaction();

    // Create creator's token account if needed
    const creatorAccountInfo = await connection.getAccountInfo(creatorTokenAccount);
    if (!creatorAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowPubkey, creatorTokenAccount, creatorPubkey, mintPubkey
        )
      );
    }

    // Create revenue token account if needed
    const revenueAccountInfo = await connection.getAccountInfo(revenueTokenAccount);
    if (!revenueAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowPubkey, revenueTokenAccount, revenuePubkey, mintPubkey
        )
      );
    }

    // Transfer refund to creator
    transaction.add(
      createTransferInstruction(
        escrowTokenAccount, creatorTokenAccount, escrowPubkey, refundLamports
      )
    );

    // Transfer fee to platform revenue
    if (feeLamports > 0) {
      transaction.add(
        createTransferInstruction(
          escrowTokenAccount, revenueTokenAccount, escrowPubkey, feeLamports
        )
      );
    }

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = escrowPubkey;

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const result = await privyServer.wallets().solana().signAndSendTransaction(
      escrowWalletId,
      {
        transaction: serializedTransaction.toString('base64'),
        caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        authorization_context: {
          authorization_private_keys: [PLATFORM_AUTH_PRIVATE_KEY || ''],
        },
      }
    );

    console.log(`✅ Refund successful: ${refundAmount} USDC to creator, ${feeAmount} USDC fee. TX: ${result.transaction_id}`);

    return {
      success: true,
      transactionHash: result.transaction_id,
    };
  } catch (error: any) {
    console.error('❌ Refund failed:', error.message);
    return {
      success: false,
      error: error.message || 'Refund failed',
    };
  }
}

/**
 * Get platform wallet balance
 */
export async function getPlatformBalance(): Promise<{
  sol?: number;
  usdc?: number;
  error?: string;
}> {
  if (!PLATFORM_ESCROW_WALLET_ID) {
    return { error: 'Platform wallet not configured' };
  }

  try {
    // Get wallet details including balances
    const wallet = await privyServer.wallets().get(PLATFORM_ESCROW_WALLET_ID);

    // Note: Privy SDK might not return balances directly
    // You may need to query Solana RPC directly for accurate balances
    return {
      sol: 0, // TODO: Implement SOL balance check
      usdc: 0, // TODO: Implement USDC balance check
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Validate that platform has sufficient balance for payout
 */
export async function validatePlatformBalance(
  requiredUsdc: number
): Promise<{ valid: boolean; error?: string }> {
  const balance = await getPlatformBalance();

  if (balance.error) {
    return { valid: false, error: balance.error };
  }

  if ((balance.usdc || 0) < requiredUsdc) {
    return {
      valid: false,
      error: `Insufficient balance. Required: ${requiredUsdc} USDC, Available: ${balance.usdc} USDC`,
    };
  }

  return { valid: true };
}
