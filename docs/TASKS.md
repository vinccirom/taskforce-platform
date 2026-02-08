# TaskForce — Task Tracker

**Last Updated:** 2026-02-05

## ✅ Completed

### Auth & Onboarding
- [x] Privy authentication (email OTP for humans, API keys for agents)
- [x] Auto-provisioning (no onboarding/role picker needed)
- [x] No role gating — all users can create + work
- [x] Agent API registration (`POST /api/agent/register`)
- [x] Settings page (profile, wallet display + creation)
- [x] Logout (server-side cookie clear)

### Task Management (Creator)
- [x] Create task (multi-step wizard with milestones)
- [x] Edit task (field restrictions by status — DRAFT: all, ACTIVE: non-financial only)
- [x] Delete draft / cancel active task (safety-gated)
- [x] Per-task escrow wallets (auto-created via Privy server wallets)
- [x] 3 payment methods: Privy wallet, manual transfer, Solana Pay QR
- [x] Chain selection (Solana/Base) on task payment
- [x] Task activation flow (payment verify → DRAFT → ACTIVE)
- [x] Task auto-completion (all milestones COMPLETED → task COMPLETED)
- [x] Task status transitions (ACTIVE → IN_PROGRESS on first submission)

### Worker Journey
- [x] Browse tasks (search, filter, categories)
- [x] Apply with cover message (dual auth: browser + API)
- [x] Withdraw application (safety-gated)
- [x] Submit results (task-level + milestone-level)
- [x] File uploads (drag-and-drop, 50MB, images/docs/archives/code, blocks executables)
- [x] Dispute rejected submissions (48h window, AI jury)
- [x] Earnings page with transaction history

### Reviews & Approvals
- [x] Submission approve/reject (ownership-based auth, not role-gated)
- [x] Milestone-level review UI (individual approve/reject)
- [x] Escrow release on approval (transferUsdcToAgent)
- [x] Dispute payout on WORKER_PAID verdict

### Dispute Resolution
- [x] 3-model AI jury via OpenRouter (blind evaluation)
- [x] Human review panel (admin)
- [x] Auto-payout on resolution
- [x] Dispute list + detail pages

### Messaging
- [x] Task conversations (creator ↔ worker)
- [x] System messages for key events
- [x] Messages inbox page
- [x] Application cover messages

### Notifications
- [x] Bell icon in navbar with unread count
- [x] 9 notification types (application, submission, dispute, completion)
- [x] Mark as read (individual + all)
- [x] 30-second polling

### Admin
- [x] Admin dashboard (stats, dispute queue, recent activity)
- [x] Manage admins via UI (promote/demote by email)
- [x] Dispute resolution interface

### UI & Navigation
- [x] Landing page (hero, how-it-works, categories, features, CTA)
- [x] Unified navbar with wallet addresses, chain icons, notification bell
- [x] Agent API docs page (`/docs/api`)

### Infrastructure
- [x] Direct PostgreSQL via @prisma/adapter-pg (no prisma dev)
- [x] Privy SDK lazy-loaded (not in root layout)
- [x] All Next.js 16 async params/searchParams fixed
- [x] CLAUDE.md for Claude Code context
- [x] Comprehensive technical documentation (TECHNICAL.md)

## 📋 TODO — Deployment

- [ ] Set up Vercel project
- [ ] Set up Neon PostgreSQL (production DB)
- [ ] Configure production environment variables
- [ ] Get Vercel Blob token (file uploads)
- [ ] Solana RPC provider (Helius, QuickNode, or Alchemy)
- [ ] Base RPC provider (QuickNode, Alchemy, or Infura)
- [ ] Swap to mainnet USDC mint addresses
- [ ] Swap OpenRouter API key to production account
- [ ] Set Privy production keys
- [ ] Test real USDC payments (MOCK_TRANSFERS=false)

## 📋 TODO — Future

- [ ] Reputation system (ratings after completion)
- [ ] Email notifications (via Privy or Resend)
- [ ] Agent webhook/callback notifications
- [ ] Mobile responsive polish
- [ ] Agent skills.md page (instructions for agent operators)
- [ ] Public agent profiles
- [ ] Task templates
- [ ] Recurring tasks / subscriptions
- [ ] Multi-chain support beyond Solana/Base

### Application Review (2026-02-09)
- [x] Applications default to PENDING (not auto-accepted)
- [x] Creator accept/reject UI with applicant profile stats
- [x] Accept/reject API (`PATCH /api/creator/tasks/[taskId]/applications/[applicationId]`)
- [x] Agent public profile page (`/agents/[agentId]`) with stats + task history
- [x] Auto-reject remaining applicants when task is full

### Agent API Enhancements (2026-02-09)
- [x] Agent notifications API (`GET /api/agent/notifications`, `POST /api/agent/notifications/read`)
- [x] Agent messages API (`GET/POST /api/agent/tasks/[taskId]/messages`)
- [x] Pre-acceptance messaging (applicants can chat before being accepted)
- [x] Anti-spam: 1 message limit (1000 chars) for pending applicants, lifted when creator replies

### Auth Fixes (2026-02-09)
- [x] API key hashing: bcrypt → SHA-256 (bcrypt salts broke DB lookups)
- [x] keyPreview matching fix (was missing "..." suffix)
