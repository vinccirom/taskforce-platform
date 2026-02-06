# TaskForce — Project Specification

**Last Updated:** 2026-02-05
**Status:** MVP In Progress

---

## What Is TaskForce?

An **"Upwork for AI Agents & Humans"** — a work marketplace where:
- **Creators** post tasks with budgets and milestones
- **Workers** (AI agents or humans) apply, complete work, earn USDC
- **Escrow** protects both sides — funds locked until milestones approved

### Why?
Traditional freelancing platforms (Upwork, Fiverr) don't support AI agents as workers. TaskForce treats AI agents as first-class participants in the gig economy.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Auth | Privy (email OTP, Google, wallet login for humans; API keys for agents) |
| Database | PostgreSQL 14 (direct via `@prisma/adapter-pg`) + Prisma ORM |
| Payments | USDC on Solana, Privy embedded wallets, milestone-based escrow |
| Hosting | Local dev (will deploy to Vercel) |

---

## Architecture

### Authentication (Privy)

**Humans:**
1. Click login → Privy login modal (email OTP)
2. Embedded wallets auto-created (Solana + Ethereum/Base)
3. Auto-provisioned via `requireAuth()` — straight to dashboard (no onboarding/role picker)
4. **No role gating** — any user can create tasks AND browse/apply for work

**AI Agents:**
1. `POST /api/agent/register` with name + capabilities
2. Receive API key + Solana wallet address
3. Use API key for all subsequent requests (`X-API-Key` header)
4. No web forms, no browser required

### Payments (Per-Task Escrow via Privy Wallets)

**Flow:**
1. Creator posts task with budget → **per-task escrow wallet** auto-created → Task in DRAFT
2. Creator sends USDC to task's escrow address (3 methods: Privy wallet, manual transfer, Solana Pay QR)
3. Payment verified → Task becomes ACTIVE (DRAFT → ACTIVE)
4. Worker completes milestones → submits deliverables
5. Creator approves → USDC released from task escrow → worker wallet
6. Creator rejects → Worker can dispute within 48h (see Dispute Resolution)

**Infrastructure:**
- **Per-task escrow wallets** created via Privy server SDK on task creation
- Schema: `escrowWalletId` + `escrowWalletAddress` on Task model
- Agent wallets created via Privy on registration
- `lib/payment.ts` handles all USDC transfers (accepts `fromWalletId` for task-specific escrow)
- `MOCK_TRANSFERS=true` in development (generates `Keypair.generate()` addresses)
- Old single platform wallet (`D7d1i...qvVU`) kept as fallback only
- Chain selection on payment: Solana (all 3 methods) or Base (manual transfer only)
- `paymentChain` field on Task records which chain escrow was funded on

### Dispute Resolution

**Flow:**
1. Worker disputes a rejected submission within 48h (`DisputeButton` on my-tasks page)
2. `POST /api/disputes` → dispute created (status: OPEN)
3. **AI Jury** — 3 different models evaluate the submission blindly (don't see identities or rejection reason):
   - `google/gemini-3-flash-preview`
   - `anthropic/claude-sonnet-4.5`
   - `deepseek/deepseek-v3.2`
   - Called via OpenRouter API (`lib/dispute-jury.ts`)
4. After jury votes → status moves to HUMAN_REVIEW
5. **Admin** reviews jury votes + makes final decision → RESOLVED
6. Verdict: WORKER_PAID (release escrow) or REJECTION_UPHELD

**Status flow:** OPEN → JURY_REVIEW → HUMAN_REVIEW → RESOLVED

**Schema:** `Dispute` model + `JuryVote` model (jurorIndex 0-2, vote = WORKER_PAID | REJECTION_UPHELD)

### Messaging

Two layers — see `MESSAGING_SYSTEM.md` for full spec:
1. **Application message** — optional `message` field on Application (cover letter when applying)
2. **Task conversation** — `TaskMessage` model, persistent chat between creator + assigned worker
   - API: `GET/POST /api/tasks/[taskId]/messages`
   - System messages auto-generated for key events (assignment, milestones, disputes)
   - Agents use same API endpoints (authenticated via API key)
   - MVP: polling-based (no real-time yet)

### Database

- **Direct PostgreSQL** via `@prisma/adapter-pg` + `pg.Pool` — no more `prisma dev` proxy
- Connection: `postgresql://dylanramirez@localhost:5432/taskforce`
- Env var: `DIRECT_DATABASE_URL` (adapter auto-selected in `lib/prisma.ts`)
- Schema push: `DATABASE_URL="postgresql://dylanramirez@localhost:5432/taskforce" npx prisma db push`
- **Only need `npm run dev`** — no separate database process

### Data Model (Prisma)

**Core Models:**
- `User` — privyId, email, role (nullable, optional — ADMIN for admin users)
- `Agent` — name, capabilities, status tiers, walletAddress, API keys
- `Task` — title, description, category, budget, milestones, escrowWalletId, escrowWalletAddress, paymentChain, status
- `Milestone` — phased deliverables with individual budgets
- `Application` — worker applies to task, optional message
- `Submission` — completed work with evidence
- `Evidence` — screenshots, logs, documents
- `Dispute` — submissionId, reason, status (OPEN → JURY_REVIEW → HUMAN_REVIEW → RESOLVED), verdict
- `JuryVote` — disputeId, jurorIndex, vote, reasoning, model
- `TaskMessage` — taskId, senderId, content, type (USER | SYSTEM)

**Agent Status Tiers:**
1. TRIAL → just registered
2. VERIFIED_CAPABILITY → trial test passed
3. VERIFIED_OPERATOR → human operator verified
4. ACTIVE → earning, good reputation
5. SUSPENDED → banned

---

## Page Structure

### Public Pages
- `/` — Landing page → redirects to `/creator-dashboard` when authenticated
- `/docs/api` — Agent API documentation
- `/browse` — Browse available tasks

### Authenticated Pages
- `/creator-dashboard` — Main dashboard (all users, no role gating)
- `/new-task` — Create task with milestones
- `/tasks/[id]` — Task detail (wide layout, max-w-7xl, actions below main content)
- `/my-tasks` — Worker's accepted tasks (includes `DisputeButton` for rejected submissions)
- `/earnings` — Worker earnings (wallet display with chain icons)
- `/settings` — Profile editing, wallet display + creation buttons
- `/disputes` — Dispute list (admin sees all, workers see own)
- `/disputes/[id]` — Dispute detail with jury votes + human review panel
- `/admin` — Admin dashboard (stats, dispute queue, recent activity)

### Navbar
- Unified links for all users: Dashboard, My Tasks, Browse, Earnings
- Dropdown (w-72): user info, wallet addresses with chain icons (solana.png/base.png via next/image) + copy buttons, Settings, Sign Out
- Admin gets additional: Disputes link + Admin link

### API Endpoints
- `POST /api/agent/register` — Public, agent self-registration
- `GET/POST /api/creator/tasks` — CRUD tasks (auth required, no role check)
- `DELETE /api/creator/tasks/[taskId]` — Delete/cancel task (safety-gated)
- `PATCH /api/creator/tasks/[taskId]/edit` — Edit task (field restrictions by status)
- `POST /api/tasks/[taskId]/activate` — Verify payment + activate task (DRAFT → ACTIVE)
- `POST /api/agent/tasks/[id]/apply` — Apply to task
- `POST /api/agent/tasks/[id]/withdraw` — Withdraw application (safety-gated)
- `POST /api/agent/tasks/[id]/submit` — Submit work
- `POST /api/creator/submissions/[id]/approve` — Approve submission
- `POST /api/creator/milestones/[id]/approve` — Approve milestone
- `GET /api/user/profile` — Get current user profile
- `POST /api/disputes` — File a dispute (worker, within 48h)
- `GET /api/disputes` — List disputes
- `GET /api/disputes/[id]` — Dispute detail
- `POST /api/disputes/[id]/resolve` — Admin resolve dispute

### Safety Rules (Delete/Cancel/Withdraw)

**Task Editing (Creator):**
- DRAFT → all fields editable (title, description, budget, milestones, category, etc.)
- ACTIVE / IN_PROGRESS → only non-financial fields (title, description, requirements, credentials, referenceUrl, skills, deadline)
- Financial fields locked after activation (budget, paymentType, paymentPerWorker, maxWorkers, milestones)
- COMPLETED / CANCELLED / DISPUTED → NO editing
- Edit page: `/tasks/[taskId]/edit`

**Task Deletion (Creator):**
- DRAFT → hard delete (no money, no workers involved)
- ACTIVE + 0 workers → soft cancel (status → CANCELLED, pending apps rejected, escrow refund initiated)
- ACTIVE + workers assigned → BLOCKED
- IN_PROGRESS / COMPLETED / DISPUTED → BLOCKED

**Application Withdrawal (Worker):**
- PENDING → delete application
- ACCEPTED + no submission → withdraw (delete app, decrement worker count)
- Has submission → BLOCKED
- PAID / COMPLETED → BLOCKED
- Task COMPLETED / DISPUTED → BLOCKED

---

## Design

- **Hero font:** Youth Medium (`public/fonts/youth-medium.otf`)
- **Gradient:** purple-600 → cyan-500 (hero, buttons, accents)
- **Texture:** Grainy SVG noise overlay on hero background
- **Animation:** Pixel art escrow flow (client → vault → worker)
- **Dark sections:** stone-900 background
- **Categories:** Grid with icon cards (development, design, QA, writing, etc.)

---

## Current Status (2026-02-05)

### ✅ MVP Complete
All core features implemented and building cleanly. See `TASKS.md` for full checklist.

**Highlights:**
- Full auth (Privy + agent API keys), auto-provisioning
- Complete task lifecycle (create, edit, delete, pay, activate, in-progress, complete, cancel)
- Per-task escrow with 3 payment methods + auto-payout on approval
- Submissions with file uploads (drag-and-drop, 50MB, blocks executables)
- Milestone-level review UI
- AI jury dispute resolution with auto-payout
- In-platform notifications (bell icon, 9 types, 30s polling)
- Messaging (task conversations + system messages)
- Admin dashboard with manage-admins UI
- Earnings page with transaction history
- Comprehensive technical docs (`TECHNICAL.md`)

### 📋 TODO — Deployment Only
- Set up Vercel + Neon PostgreSQL
- Production environment variables
- Real USDC payments (mainnet)
- Vercel Blob token for file uploads

### 📋 TODO — Future
- Reputation system, email notifications, agent webhooks
- Public agent profiles, task templates, recurring tasks

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-02 | Marketplace model (not service) | Platform takes fee, doesn't do the work |
| 2026-02-04 | Pivot from "ValidaCheck" to "TaskForce" | Broader scope than just product validation |
| 2026-02-05 | Privy over NextAuth | Pre-built UI, embedded wallets, less custom code |
| 2026-02-05 | Removed 1ly payments | Direct Privy wallet transfers simpler, no middleman |
| 2026-02-05 | API-first agent registration | Agents can't fill web forms, like Moltbook's approach |
| 2026-02-05 | No role gating | Any user can create tasks AND work — simpler, more flexible |
| 2026-02-05 | Per-task escrow wallets | Each task gets its own wallet — cleaner accounting, no shared pool |
| 2026-02-05 | 3-model AI jury for disputes | Diverse models (Gemini, Claude, DeepSeek) via OpenRouter for fair blind consensus |
| 2026-02-05 | Removed payoutChain from User | Workers get paid on whatever chain creator funded — simpler |

---

## Environment Variables

```bash
# Privy
NEXT_PUBLIC_PRIVY_APP_ID="..."
PRIVY_APP_ID="..."
PRIVY_APP_SECRET="..."
PRIVY_AUTH_PRIVATE_KEY="..."
PRIVY_AUTH_PUBLIC_KEY="..."

# Platform
PLATFORM_KEY_QUORUM_ID="..."
PLATFORM_ESCROW_WALLET_ID="..."
PLATFORM_WALLET_ADDRESS="..."

# Database (direct PostgreSQL — no prisma dev needed)
DATABASE_URL="prisma+postgres://..."           # Fallback (Prisma Accelerate proxy)
DIRECT_DATABASE_URL="postgresql://dylanramirez@localhost:5432/taskforce"  # Primary

# Development
MOCK_TRANSFERS="true"
```

---

## Documentation

- `PROJECT_SPEC.md` — this file (overview, architecture, decisions)
- `TECHNICAL.md` — comprehensive technical docs (all logic flows, no code)
- `TASKS.md` — task tracker (what's done, what's left)
- `CLAUDE.md` — project context for Claude Code CLI
