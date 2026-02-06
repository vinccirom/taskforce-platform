# TaskForce — Project Context for Claude Code

## What Is This?
**TaskForce** — "Upwork for AI Agents & Humans". A work marketplace where creators post tasks, workers (AI agents or humans) complete them, and payments happen in USDC via milestone-based escrow.

## Stack
- **Next.js 16** (App Router, Turbopack, React 19)
- **Prisma ORM** + **PostgreSQL 14** (direct connection via `@prisma/adapter-pg`, NOT `prisma dev`)
- **Privy** for auth (email OTP for humans, API keys for agents)
- **Solana/USDC** for payments (Privy embedded wallets)
- **shadcn/ui** + Tailwind CSS 4 for components

## Database
- Schema: `prisma/schema.prisma`
- Connection: `lib/prisma.ts` — uses `PrismaPg` adapter with `pg.Pool` when `DIRECT_DATABASE_URL` is set
- Direct URL: `postgresql://dylanramirez@localhost:5432/taskforce`
- Push schema: `DATABASE_URL="postgresql://dylanramirez@localhost:5432/taskforce" npx prisma db push`
- **No `prisma dev` needed** — just `npm run dev`

## Key Architecture Decisions
- **No role gating** — any authenticated user can create tasks AND work on tasks. The `role` field on User is nullable/optional. Don't check for CREATOR role — check task ownership instead.
- **Per-task escrow wallets** — each task gets its own Solana wallet via Privy server SDK
- **Privy SDK is NOT in root layout** — it's lazy-loaded only on `/login`, `/settings`, and payment pages via `WithPrivy` wrapper
- **Auth:** `lib/auth.ts` → `getAuthUser()` reads `privy-token` cookie. `components/auth/role-guard.tsx` → `requireAuth()` auto-creates users.
- **Agent auth:** API key in `X-API-Key` header → `lib/api-auth.ts` → `authenticateAgent()`

## Directory Structure
```
app/
  (admin)/          — Admin dashboard
  (agent)/          — Worker pages (browse, my-tasks, earnings, submissions)
  (creator)/        — Creator pages (dashboard, new-task, task detail, edit)
  (landing)/        — Landing page
  api/              — API routes
    agent/          — Agent endpoints (register, apply, submit, withdraw)
    creator/        — Creator endpoints (tasks CRUD, submissions review, milestones)
    disputes/       — Dispute filing and resolution
    tasks/          — Shared (activate, messages)
    user/           — Profile
  disputes/         — Dispute pages
  login/            — Login page (loads Privy here)
  messages/         — Messages inbox
  settings/         — User settings (loads Privy here)

components/
  auth/             — Auth context, role guard, Privy provider
  layouts/          — AppShell (navbar + footer)
  task/             — Task cards, forms, buttons, messages, payment
  dispute/          — Dispute button
  ui/               — shadcn components

lib/
  auth.ts           — Server-side Privy token verification
  api-auth.ts       — Agent API key authentication
  prisma.ts         — Prisma client (direct PG adapter)
  privy-server.ts   — Privy Node SDK (wallet creation)
  payment.ts        — USDC transfer logic
  dispute-jury.ts   — AI jury (3 models via OpenRouter)
  messages.ts       — System message helper
```

## Next.js 16 Gotchas
- **ALL dynamic params are async**: `params: Promise<{ id: string }>` → `const { id } = await params`
- **searchParams too**: same pattern, must await
- **Client components**: use `use(params)` from React instead of await

## Important Patterns
- `requireAuth()` in server components — auto-provisions users, returns `{ user }` with id, email, role, wallets
- `getAuthUser()` in API routes — returns Privy claims or null
- Task ownership check: compare `task.creatorId === user.id` (NOT role-based)
- Applications auto-accept workers currently (no manual review step)
- `MOCK_TRANSFERS=true` — all payment operations are mocked in dev

## What NOT to Do
- Don't add Privy imports to root layout or AppShell — it's 7MB+ of JS
- Don't use `useSolanaWallets` — use `useWallets` from `@privy-io/react-auth/solana`
- Don't check `UserRole.CREATOR` for authorization — check task ownership
- Don't use `prisma dev` — we use direct PostgreSQL
- Don't create `@privy-io/node` with `appId` — it's `appID` (capital D)

## Build & Dev
```bash
npm run dev          # Start dev server (Turbopack)
npx next build       # Production build (use to verify no type errors)
```
