/**
 * Payment utilities for USDC transfers
 * Handles transfers from platform wallet to agent wallets via Privy
 * 
 * NOTE: Gas fees are currently sponsored by Privy (enabled in Privy dashboard).
 * This means the platform absorbs Solana transaction fees at 0% cost to users.
 * TODO: When platform fees are introduced, deduct fees from transfer amounts
 * and switch from Privy sponsorship to self-sponsored gas from platform revenue.
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

// Base chain config
const BASE_RPC_URL = process.env.BASE_RPC_URL || '';
const USDC_MINT_BASE = process.env.USDC_MINT_BASE || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

/**
 * Encode an ERC-20 transfer(address,uint256) call without external deps
 */
function encodeErc20Transfer(to: string, amount: bigint): string {
  const selector = '0xa9059cbb';
  const paddedTo = to.toLowerCase().replace('0x', '').padStart(64, '0');
  const paddedAmount = amount.toString(16).padStart(64, '0');
  return selector + paddedTo + paddedAmount;
}

/**
 * Encode an ERC-20 balanceOf(address) call
 */
function encodeErc20BalanceOf(address: string): string {
  const selector = '0x70a08231';
  const paddedAddress = address.toLowerCase().replace('0x', '').padStart(64, '0');
  return selector + paddedAddress;
}

/**
 * Query Base USDC balance for an address via JSON-RPC
 */
export async function getBaseUsdcBalance(walletAddress: string): Promise<number> {
  const rpcUrl = BASE_RPC_URL;
  if (!rpcUrl) throw new Error('BASE_RPC_URL not configured');

  const data = encodeErc20BalanceOf(walletAddress);
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: USDC_MINT_BASE, data }, 'latest'],
    }),
  });

  const json = await response.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  const rawBalance = BigInt(json.result || '0x0');
  return Number(rawBalance) / 1_000_000;
}

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
  fromWalletAddress?: string,
  chain: 'solana' | 'base' = 'solana'
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

  // ---- Base chain transfer ----
  if (chain === 'base') {
    try {
      const amountRaw = BigInt(Math.floor(amountUsdc * 1_000_000));
      const data = encodeErc20Transfer(agentWalletAddress, amountRaw);

      console.log(`💸 [Base] Transferring ${amountUsdc} USDC to ${agentWalletAddress}`);

      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await (privyServer.wallets() as any).ethereum().sendTransaction(
            sourceWalletId,
            {
              caip2: 'eip155:8453',
              method: 'eth_sendTransaction',
              params: {
                transaction: {
                  to: USDC_MINT_BASE,
                  data,
                  value: '0x0',
                },
              },
              sponsor: true,
              authorization_context: {
                authorization_private_keys: [PLATFORM_AUTH_PRIVATE_KEY || ''],
              },
            }
          );

          const txHash = (result as any).hash || (result as any).transaction_hash || JSON.stringify(result);
          console.log('✅ [Base] Transfer successful:', txHash);
          return { success: true, transactionHash: txHash };
        } catch (retryError: any) {
          const msg = retryError?.message || String(retryError);
          console.warn(`⚠️ [Base] Transfer attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
          if (attempt === MAX_RETRIES) throw retryError;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      return { success: false, error: 'Max retries exceeded' };
    } catch (error: any) {
      console.error('❌ [Base] Transfer failed:', error.message);
      return { success: false, error: error.message || 'Base transfer failed' };
    }
  }

  // ---- Solana chain transfer ----
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

    // Retry loop — blockhash can expire during Privy's signing round-trip
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Get fresh blockhash on each attempt
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Serialize transaction
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      try {
        // Sign and send via Privy with gas sponsorship
        const result = await privyServer.wallets().solana().signAndSendTransaction(
          sourceWalletId,
          {
            transaction: serializedTransaction.toString('base64'),
            caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana Mainnet
            sponsor: true, // Privy gas sponsorship (server-side only)
            authorization_context: {
              authorization_private_keys: [PLATFORM_AUTH_PRIVATE_KEY || ''],
            },
          }
        );

        const txHash = (result as any).hash || (result as any).transaction_id || JSON.stringify(result);
        console.log('✅ Transfer successful:', txHash);

        return {
          success: true,
          transactionHash: txHash,
        };
      } catch (retryError: any) {
        const msg = retryError?.message || String(retryError);
        console.warn(`⚠️ Transfer attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
        if (attempt === MAX_RETRIES) throw retryError;
        // Brief pause before retry
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Should never reach here, but just in case
    return { success: false, error: 'Max retries exceeded' };
  } catch (error: any) {
    console.error('❌ Transfer failed:', error.message);
    console.error('Error details:', error);
    return {
      success: false,
      error: error.message || 'Transfer failed',
    };
  }
}

/**
 * Withdraw USDC from a Privy wallet to an external destination address.
 * Gas is sponsored by Privy when available; falls back to source wallet SOL.
 */
export async function withdrawUsdc(
  sourceWalletId: string,
  sourceWalletAddress: string,
  destinationAddress: string,
  amountUsdc: number,
  chain: 'solana' | 'base' = 'solana'
): Promise<TransferResult> {
  if (process.env.MOCK_TRANSFERS === 'true' && process.env.NODE_ENV !== 'production') {
    console.log(`🎭 MOCK: Simulating withdrawal of ${amountUsdc} USDC to ${destinationAddress}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      transactionHash: `mock_withdraw_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  if (chain === 'base') {
    try {
      const amountRaw = BigInt(Math.floor(amountUsdc * 1_000_000));
      const data = encodeErc20Transfer(destinationAddress, amountRaw);

      console.log(`💸 [Base] Withdrawing ${amountUsdc} USDC from ${sourceWalletAddress} to ${destinationAddress}`);

      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await (privyServer.wallets() as any).ethereum().sendTransaction(
            sourceWalletId,
            {
              caip2: 'eip155:8453',
              method: 'eth_sendTransaction',
              params: {
                transaction: {
                  to: USDC_MINT_BASE,
                  data,
                  value: '0x0',
                },
              },
              sponsor: true,
              authorization_context: {
                authorization_private_keys: [PLATFORM_AUTH_PRIVATE_KEY || ''],
              },
            }
          );

          const txHash = (result as any).hash || (result as any).transaction_hash || JSON.stringify(result);
          console.log('✅ [Base] Withdrawal successful:', txHash);
          return { success: true, transactionHash: txHash };
        } catch (retryError: any) {
          const msg = retryError?.message || String(retryError);
          console.warn(`⚠️ [Base] Withdrawal attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
          if (attempt === MAX_RETRIES) throw retryError;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      return { success: false, error: 'Max retries exceeded' };
    } catch (error: any) {
      console.error('❌ [Base] Withdrawal failed:', error.message);
      return { success: false, error: error.message || 'Base withdrawal failed' };
    }
  }

  try {
    const amountLamports = Math.floor(amountUsdc * 1_000_000);
    console.log(`💸 Withdrawing ${amountUsdc} USDC (${amountLamports} lamports) from ${sourceWalletAddress} to ${destinationAddress}`);

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const fromPubkey = new PublicKey(sourceWalletAddress);
    const toPubkey = new PublicKey(destinationAddress);
    const mintPubkey = new PublicKey(USDC_MINT_ADDRESS);

    const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
    const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

    const transaction = new Transaction();

    // Create recipient token account if it doesn't exist
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toAccountInfo) {
      console.log('Creating associated token account for recipient...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey,
          toTokenAccount,
          toPubkey,
          mintPubkey
        )
      );
    }

    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        amountLamports
      )
    );

    // Retry loop with fresh blockhash
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      try {
        // Gas sponsored by Privy — no SOL needed in source wallet
        const result = await privyServer.wallets().solana().signAndSendTransaction(
          sourceWalletId,
          {
            transaction: serializedTransaction.toString('base64'),
            caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
            sponsor: true,
            authorization_context: {
              authorization_private_keys: [PLATFORM_AUTH_PRIVATE_KEY || ''],
            },
          }
        );

        const txHash = (result as any).hash || (result as any).transaction_id || JSON.stringify(result);
        console.log('✅ Withdrawal successful:', txHash);

        return {
          success: true,
          transactionHash: txHash,
        };
      } catch (retryError: any) {
        const msg = retryError?.message || String(retryError);
        console.warn(`⚠️ Withdrawal attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
        if (attempt === MAX_RETRIES) throw retryError;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  } catch (error: any) {
    console.error('❌ Withdrawal failed:', error.message);
    return {
      success: false,
      error: error.message || 'Withdrawal failed',
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
        sponsor: true, // Privy gas sponsorship
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
