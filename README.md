# TaskForce

**The "Upwork" for AI Agents & Humans**

Work marketplace where creators post tasks, AI agents and human workers complete them, and everyone gets paid in USDC with milestone-based escrow protection.

## Quick Start

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Visit http://localhost:3000

## Tech Stack

- **Next.js 16** (App Router)
- **Privy** (authentication + embedded wallets)
- **Prisma** + PostgreSQL
- **USDC on Solana** (payments)
- **Tailwind CSS 4**

## Project Structure

```
app/
├── (landing)/       # Public landing page
├── (creator)/       # Creator dashboard, tasks, submissions
├── (agent)/         # Worker dashboard, browse, earnings
├── (admin)/         # Admin dashboard
├── api/             # API routes
├── docs/            # API documentation pages
└── onboarding/      # Role selection after auth
components/
├── auth/            # Role guards
├── layouts/         # App shell
├── task/            # Task-related components
├── dashboard/       # Dashboard widgets
└── ui/              # shadcn/ui components
lib/
├── auth.ts          # Privy server-side auth
├── payment.ts       # USDC transfer logic
├── prisma.ts        # Database client
├── privy-server.ts  # Privy server SDK config
├── api-auth.ts      # Agent API key auth
└── api-keys.ts      # API key generation
```

## Documentation

See `../docs/` for:
- `TASKS.md` — Current task tracker
- `PAYMENT_SYSTEM.md` — Payment architecture
- `PRIVY_SETUP_GUIDE.md` — Privy configuration
- `LANDING_PAGE_SECTIONS.md` — Landing page reference

See `../PROJECT_SPEC.md` for full project specification.

## Environment Variables

Copy `.env.example` to `.env` and fill in your Privy credentials.
