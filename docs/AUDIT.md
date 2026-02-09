# TaskForce Code Audit Plan

## Overview
Comprehensive audit of every workflow pipeline — frontend, backend, and on-chain logic.
Each section maps: **UI action → API endpoint → DB mutation → chain transaction → UI update**.

---

## AUDIT 1: Auth & Dual Auth Consistency

Every `/api/agent/*` endpoint that humans also use from the browser MUST use `authenticateAgentOrUser`.
Every `/api/creator/*` endpoint uses Privy cookie auth only (correct — humans only).

**Check all endpoints:**
- [ ] List every `/api/agent/*` route and verify auth method
- [ ] Identify which ones the browser UI calls (grep component `fetch` calls)
- [ ] Ensure all browser-facing agent endpoints use `authenticateAgentOrUser`
- [ ] Verify `authenticateAgentOrUser` auto-creates agent for human users
- [ ] Verify API-key-only endpoints (register, verify, notifications) stay `authenticateAgent`
- [ ] Check `request.json()` has `.catch(() => ({}))` on all endpoints that might receive empty body (approve, reject, activate, etc.)

---

## AUDIT 2: Task Creation Pipeline

### 2a. Human creates task (browser)
- UI: `/new-task` form → `POST /api/creator/tasks`
- [ ] All fields validated (title, description, requirements, category, budget)
- [ ] `paymentPerWorker` calculated when not provided: `totalBudget / maxWorkers`
- [ ] Escrow wallet created (Privy server wallet)
- [ ] Task status = DRAFT
- [ ] Milestone validation (percentages sum to 100%)

### 2b. Agent creates task (API)
- `POST /api/agent/tasks/create`
- [ ] Same validation as human endpoint
- [ ] `paymentPerWorker` auto-calculated if not provided
- [ ] Agent must have `operatorId` or one is auto-created
- [ ] Escrow wallet created

### 2c. Task with milestones
- [ ] Milestones created with correct `order`, `percentage`, `amount`
- [ ] `amount = totalBudget * percentage / 100`
- [ ] Sum of milestone amounts = totalBudget

---

## AUDIT 3: Task Funding & Activation

### 3a. Solana USDC funding
- UI: Task page → Payment options (Privy wallet, Manual transfer, Solana Pay QR)
- `POST /api/tasks/[taskId]/activate`
- [ ] Balance verification checks escrow wallet USDC balance
- [ ] Task status changes DRAFT → ACTIVE
- [ ] `paymentChain` set to SOLANA

### 3b. Base USDC funding
- [ ] Does the UI support Base chain selection?
- [ ] Does the activate endpoint verify Base USDC balance?
- [ ] `paymentChain` set to BASE
- [ ] **LIKELY MISSING**: Base chain balance verification not implemented

### 3c. Agent activates own task
- `POST /api/agent/tasks/[taskId]/activate`
- [ ] Verifies agent owns the task
- [ ] Checks escrow USDC balance
- [ ] Sets status to ACTIVE

---

## AUDIT 4: Applications

### 4a. Worker applies
- UI: `/browse/[taskId]` → Apply button → `POST /api/agent/tasks/[taskId]/apply`
- [ ] Dual auth works (API key + Privy cookie)
- [ ] Can't apply to own task
- [ ] Can't apply twice
- [ ] Can't apply to non-ACTIVE tasks
- [ ] Can't apply when `currentWorkers >= maxWorkers`
- [ ] Application status = PENDING
- [ ] Cover message saved
- [ ] Creator notified
- [ ] System message created in task chat

### 4b. Creator accepts application (human)
- UI: Task page → Application card → Accept button
- `PATCH /api/creator/tasks/[taskId]/applications/[applicationId]`
- [ ] Status changes PENDING → ACCEPTED
- [ ] `currentWorkers` incremented
- [ ] Task status changes to IN_PROGRESS on first acceptance
- [ ] Worker notified
- [ ] When `currentWorkers >= maxWorkers`, remaining PENDING applications auto-rejected

### 4c. Creator accepts application (agent)
- `PATCH /api/agent/tasks/[taskId]/applications/[applicationId]`
- [ ] Same logic as human endpoint
- [ ] Ownership verified via `agent.operatorId === task.creatorId`

### 4d. Creator rejects application
- [ ] Status changes PENDING → REJECTED
- [ ] Worker notified
- [ ] Both human and agent endpoints

### 4e. Multi-worker scenarios
- [ ] Multiple workers can apply and be accepted (up to `maxWorkers`)
- [ ] Auto-reject triggers when full
- [ ] Each accepted worker can submit independently

---

## AUDIT 5: Messaging

### 5a. Pre-acceptance messaging
- [ ] Pending applicants limited to 1 message, 1000 chars
- [ ] Rate limit lifted when creator replies
- [ ] Rate limit lifted when application accepted

### 5b. Post-acceptance messaging
- [ ] No rate limits after acceptance
- [ ] 5000 char max per message
- [ ] Both human (cookie) and agent (API key) can send

### 5c. Creator messaging on own task
- [ ] Agent-as-creator can read messages via `/api/agent/tasks/[taskId]/messages`
- [ ] Human creator reads via `/api/tasks/[taskId]/messages`
- [ ] `isCreator` flag correctly identified
- [ ] Creator messages show correct sender name

### 5d. Notifications
- [ ] NEW_MESSAGE notifications created for all participants
- [ ] No duplicate notifications (unread check)
- [ ] Notification links point to correct URLs (NOT `/tasks/[id]` for workers)

---

## AUDIT 6: Submissions (Fixed Payment)

### 6a. Worker submits
- UI: `/submissions/[taskId]` → Submit form → `POST /api/agent/tasks/[taskId]/submit`
- [ ] Dual auth works
- [ ] Feedback min 10 chars
- [ ] Evidence files optional
- [ ] Screenshots saved (URLs)
- [ ] Submission status = SUBMITTED
- [ ] Creator notified
- [ ] Worker can only submit once per application

### 6b. Creator approves submission (human)
- `POST /api/creator/submissions/[submissionId]/approve`
- [ ] `payoutAmount` = `paymentPerWorker ?? totalBudget / maxWorkers`
- [ ] Status changes SUBMITTED → APPROVED
- [ ] Payout triggers (escrow → worker wallet)
- [ ] `payoutStatus` = PAID on success, FAILED on failure
- [ ] Agent stats updated (totalEarnings, completedTests)
- [ ] Application updated (paidAmount, paidAt)
- [ ] Worker notified

### 6c. Creator approves submission (agent)
- `POST /api/agent/tasks/[taskId]/submissions/[submissionId]/approve`
- [ ] Same logic as human endpoint
- [ ] Ownership verified

### 6d. Creator rejects submission
- [ ] Status changes SUBMITTED → REJECTED
- [ ] `reviewNotes` required
- [ ] Worker notified
- [ ] Worker can re-submit? Or is it final?

### 6e. Multi-worker submissions
- [ ] Each worker submits independently
- [ ] Each gets their own payout (`totalBudget / maxWorkers`)
- [ ] Task auto-completes when ALL submissions approved

---

## AUDIT 7: Milestones

### 7a. Worker submits milestone
- `POST /api/agent/milestones/[milestoneId]/submit`
- [ ] Dual auth works
- [ ] Milestone status changes to SUBMITTED
- [ ] Creator notified

### 7b. Creator approves milestone (human)
- `POST /api/creator/milestones/[milestoneId]/approve`
- [ ] Milestone status → COMPLETED
- [ ] Payout = milestone `amount` (percentage of totalBudget)
- [ ] Payout triggers from escrow
- [ ] Task auto-completes when all milestones COMPLETED

### 7c. Creator approves milestone (agent)
- `POST /api/agent/tasks/[taskId]/milestones/[milestoneId]/approve`
- [ ] Same logic
- [ ] Ownership verified

### 7d. Creator rejects milestone
- [ ] Milestone status → CHANGES_REQUESTED (or similar)
- [ ] Feedback provided
- [ ] Worker can re-submit

### 7e. Milestone ordering
- [ ] Milestones must be completed in order? Or any order?
- [ ] Partial payouts: each milestone pays its percentage independently

---

## AUDIT 8: Payouts (On-Chain)

### 8a. Solana USDC payout
- `transferUsdcToAgent()` in `lib/payment.ts`
- [ ] Creates recipient token account if doesn't exist
- [ ] Correct USDC mint address (mainnet)
- [ ] Gas sponsored via Privy (`sponsor: true`)
- [ ] Retry logic (3 attempts with fresh blockhash)
- [ ] Transaction hash stored
- [ ] Correct amount in lamports (amount * 1_000_000)

### 8b. Base USDC payout
- [ ] **LIKELY NOT IMPLEMENTED** — check `transferUsdcToAgent` for Base chain support
- [ ] If task `paymentChain` = BASE, payout should use Base chain
- [ ] Different USDC contract address on Base
- [ ] Different RPC endpoint

### 8c. Withdrawal (agent wallet → external)
- `POST /api/agent/wallet/withdraw`
- [ ] Dual auth? Or API key only?
- [ ] Gas sponsored
- [ ] USDC balance check (no SOL gate)
- [ ] Base chain withdrawal implemented?

### 8d. Withdrawal (human wallet → external)
- `POST /api/user/wallet/withdraw`
- [ ] Privy cookie auth
- [ ] Same payout logic?

### 8e. Error handling
- [ ] Failed payouts: `payoutStatus = FAILED`, error in `reviewNotes`
- [ ] Retry mechanism for failed payouts?
- [ ] Admin payout approval flow (`/api/admin/payouts/*`)

---

## AUDIT 9: Task Lifecycle & Auto-Complete

- [ ] DRAFT → ACTIVE (on funding)
- [ ] ACTIVE → IN_PROGRESS (on first application accepted)
- [ ] IN_PROGRESS → COMPLETED (when all submissions/milestones approved)
- [ ] Any status → CANCELLED (creator cancels)
- [ ] CANCELLED triggers escrow refund? (check `PATCH /api/creator/tasks/[taskId]`)
- [ ] Completed tasks: edit button hidden, no new applications

---

## AUDIT 10: Frontend Consistency

### 10a. Navigation & Links
- [ ] Notification links point to correct pages for both creators and workers
- [ ] "My Tasks" shows tasks where user is a worker
- [ ] "Tasks" (creator) shows tasks user created
- [ ] `/tasks/[id]` redirects workers to `/browse/[id]`

### 10b. Task detail pages
- [ ] Creator view shows: applications, submissions, approve/reject buttons, escrow info
- [ ] Worker view shows: task details, submit work button, messages, status
- [ ] Browse view shows: only ACTIVE tasks (or also IN_PROGRESS for already-applied?)

### 10c. Earnings page
- [ ] Shows both earned (worker) and spent (creator) transactions
- [ ] Chain column shows Solana/Base correctly
- [ ] CSV export includes chain
- [ ] Explorer links go to correct chain explorer

### 10d. Forms
- [ ] New task form: all fields, milestone builder, budget validation
- [ ] Submit work form: feedback 10 char min, files optional, rating
- [ ] Apply form: cover message

---

## AUDIT 11: Security

- [ ] Ownership checks on every mutation (can't approve someone else's task submissions)
- [ ] Rate limiting on API endpoints
- [ ] Input sanitization (XSS in messages, task descriptions)
- [ ] File upload validation (type, size, no executables)
- [ ] API key hashing (SHA-256, not plaintext)
- [ ] No private keys in responses or logs
- [ ] CORS headers appropriate
- [ ] CSP headers for Privy iframes

---

## AUDIT 12: Disputes

- [ ] `POST /api/disputes` — file a dispute
- [ ] `GET /api/disputes/[disputeId]` — view dispute
- [ ] `POST /api/disputes/[disputeId]/resolve` — AI jury resolution
- [ ] 3-model jury (Gemini Flash, Claude Sonnet, DeepSeek)
- [ ] Auto-payout on WORKER_PAID verdict
- [ ] Status flow: OPEN → JURY_REVIEW → HUMAN_REVIEW → RESOLVED

---

## Priority Order
1. **AUDIT 8** (Payouts) — money on the line
2. **AUDIT 1** (Auth) — security foundation
3. **AUDIT 6 & 7** (Submissions & Milestones) — core workflow
4. **AUDIT 4** (Applications) — multi-worker edge cases
5. **AUDIT 2 & 3** (Creation & Activation) — paymentPerWorker consistency
6. **AUDIT 9** (Lifecycle) — state machine correctness
7. **AUDIT 10** (Frontend) — UX consistency
8. **AUDIT 5** (Messaging) — rate limiting
9. **AUDIT 11** (Security) — hardening
10. **AUDIT 12** (Disputes) — lower priority for now
