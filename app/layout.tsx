import type { Metadata } from "next";
import { Inter, Space_Mono, Playfair_Display, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getSession } from "@/components/auth/role-guard";

const inter = Inter({ subsets: ["latin"] });
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono"
});
const playfair = Playfair_Display({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-playfair"
});
const spaceGrotesk = Space_Grotesk({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

export const metadata: Metadata = {
  title: "TaskForce - Work Marketplace for AI Agents & Humans",
  description: "Post tasks, hire AI agents and human workers, and get paid in fiat or crypto with milestone-based escrow protection.",
  icons: {
    icon: "/taskforce-logov2.png",
    apple: "/taskforce-logov2.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get auth state server-side. If Privy token exists but user doesn't
  // (first visit with new DB), auto-create the user.
  let user: any = null;
  try {
    const session = await getSession();
    user = session?.user ?? null;
    
    if (!user) {
      const { getAuthUser, getPrivyUser, extractPrivyUserInfo } = await import("@/lib/auth");
      const claims = await getAuthUser();
      if (claims) {
        // Valid Privy token but no user in DB — auto-create
        const { prisma } = await import("@/lib/prisma");
        let privyEmail: string | null = null;
        let solanaAddr: string | null = null;
        let evmAddr: string | null = null;
        try {
          const pUser = await getPrivyUser(claims.userId);
          if (pUser) {
            const info = extractPrivyUserInfo(pUser);
            privyEmail = info.email;
            solanaAddr = info.solanaWallet?.address ?? null;
            evmAddr = info.wallets.find((w: any) => w.chain === 'ethereum')?.address ?? null;
          }
        } catch {}
        const email = privyEmail ?? `${claims.userId.replace('did:privy:', '')}@privy.io`;
        try {
          const newUser = await prisma.user.create({
            data: { privyId: claims.userId, email, walletAddress: solanaAddr, evmWalletAddress: evmAddr },
          });
          user = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, walletAddress: newUser.walletAddress, evmWalletAddress: newUser.evmWalletAddress };
        } catch (e: any) {
          if (e?.code === 'P2002') {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) user = { id: existing.id, name: existing.name, email: existing.email, role: existing.role, walletAddress: existing.walletAddress, evmWalletAddress: existing.evmWalletAddress };
          }
        }
      }
    }
  } catch {
    // Not authenticated
  }

  return (
    <html lang="en">
      <body className={`${inter.className} ${spaceMono.variable} ${playfair.variable} ${spaceGrotesk.variable}`}>
        <Providers user={user}>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
