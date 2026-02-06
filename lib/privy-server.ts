import { PrivyClient } from '@privy-io/node';

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  throw new Error('Missing Privy credentials. Add PRIVY_APP_ID and PRIVY_APP_SECRET to .env');
}

export const privyServer = new PrivyClient({
  appId: process.env.PRIVY_APP_ID,
  appSecret: process.env.PRIVY_APP_SECRET,
});

// Policy IDs (set after creating policies in Privy dashboard)
export const TRIAL_POLICY_ID = process.env.PRIVY_TRIAL_POLICY_ID;
export const FULL_ACCESS_POLICY_ID = process.env.PRIVY_FULL_ACCESS_POLICY_ID;

// Platform authorization keys (for wallet control)
export const PLATFORM_AUTH_PRIVATE_KEY = process.env.PRIVY_AUTH_PRIVATE_KEY;
export const PLATFORM_AUTH_PUBLIC_KEY = process.env.PRIVY_AUTH_PUBLIC_KEY;

// Platform key quorum and wallets
export const PLATFORM_KEY_QUORUM_ID = process.env.PLATFORM_KEY_QUORUM_ID;
export const PLATFORM_ESCROW_WALLET_ID = process.env.PLATFORM_ESCROW_WALLET_ID;
export const PLATFORM_WALLET_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS;
