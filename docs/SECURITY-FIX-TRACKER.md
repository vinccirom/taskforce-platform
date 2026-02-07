# Security Fix Tracker

## Status Legend
- [ ] Not started
- [~] In progress (agent working)
- [x] Fixed

---

## BATCH 1 — Critical Fixes (ALL DONE)

- [x] **C-01**: Add admin auth to `app/api/admin/payouts/pending/route.ts` and `app/api/admin/payouts/approve/route.ts`
- [x] **C-03**: Add auth + text length limit to `app/api/tts/route.ts`
- [x] **C-05**: Fix API key lookup in `lib/api-auth.ts` (prefix-based filtering via keyPreview)
- [x] **C-06**: Gate MOCK_TRANSFERS in `lib/payment.ts`, `app/api/tasks/[taskId]/activate/route.ts`, `app/api/creator/tasks/route.ts`, `app/api/agent/tasks/create/route.ts`
- [x] **C-07**: Add security headers + disable source maps in `next.config.ts`
- [x] **C-08/C-09/H-14**: Fix upload validation — allowlist extensions, sanitize filenames, gate dev mode, remove JS/HTML from ALLOWED_TYPES
- [x] **C-10**: Sanitize error message in `app/api/tasks/[taskId]/activate/route.ts` + dispute endpoints

## BATCH 2 — High Fixes (ALL DONE)

- [x] **H-01**: Atomic transaction for submission approval — `updateMany` with status guard + PROCESSING/FAILED payout states
- [x] **H-02**: Admin payout — added auth + select clauses + fixed totalBudget fallback
- [x] **H-03**: Atomic dispute resolution (updateMany race guard) + prompt injection fix (XML tags) + juror abstention fix (no default vote)
- [x] **H-04**: Atomic worker slot assignment (updateMany with lt guard + rollback)
- [x] **H-05**: IDOR fix for disputes — scope GET to participants (admin/creator/operator), auth on detail view
- [x] **H-06**: Remove credentials from auto-accept response
- [x] **H-10**: XSS fix in `app/docs/api/page.tsx` (HTML entity escaping before syntax highlighting)
- [x] **H-12**: Create `middleware.ts` for admin route protection (privy-token cookie check)
- [x] **H-13**: Admin dashboard auth guard (`app/(admin)/layout.tsx`)
- [x] **M-17**: voiceId SSRF validation (done with C-03)

## BATCH 3 — Medium Fixes (ALL DONE)

- [x] **M-03**: Add select to browse page `app/(agent)/browse/page.tsx` — excludes credentials, escrow fields
- [x] **M-04**: Strip credentials from non-accepted applications in `app/(agent)/my-tasks/page.tsx`
- [x] **M-05**: Added creatorId ownership check in `app/(creator)/tasks/[taskId]/page.tsx`
- [x] **M-06**: Select clauses on agent includes in `app/api/creator/tasks/route.ts`
- [x] **M-07**: Fix status-before-transfer — PROCESSING state set before transfer attempt (done with H-01)
- [x] **M-08**: Fix totalBudget fallback in admin payout (done with C-01 fix)
- [x] **M-09**: Prompt injection in jury — XML tag wrapping for user content (done with H-03)
- [x] **M-10**: Failed juror bias fix — abstention instead of default REJECTION_UPHELD (done with H-03)
- [x] **M-13**: Fix broken agent access check in `app/api/milestones/[milestoneId]/route.ts` — agent.operatorId
- [x] **M-15**: Remove email from messages in `app/api/tasks/[taskId]/messages/route.ts`
- [x] **M-18/M-19/M-20**: Input validation — name length (register), capabilities array validation, task field limits, maxWorkers/budget bounds, deadline future check

## BATCH 4 — Low Fixes (ALL DONE)

- [x] **L-01**: Change logout to POST `app/api/auth/logout/route.ts` + updated app-shell.tsx link
- [x] **L-03**: Transaction hash format validation in `app/api/tasks/[taskId]/activate/route.ts`
- [x] **L-07**: Evidence URL validation (https:// only) in both submit endpoints
- [x] **L-08**: JSON parse error handling (400 vs 500) in disputes POST, resolve POST, task create

---

## ALL 58 FINDINGS FIXED

## Files Modified (complete list)

### Batch 1 — Critical
1. `app/api/admin/payouts/pending/route.ts` — Added admin auth (getAuthUser + role check)
2. `app/api/admin/payouts/approve/route.ts` — Added admin auth, select clauses on includes, fixed totalBudget/maxWorkers fallback
3. `app/api/tts/route.ts` — Added auth, text length limit (5000), voiceId alphanumeric validation
4. `lib/api-auth.ts` — Changed from full table scan to keyPreview prefix filtering
5. `lib/payment.ts` — Added NODE_ENV !== 'production' guard on MOCK_TRANSFERS
6. `app/api/tasks/[taskId]/activate/route.ts` — NODE_ENV guard, sanitized error, tx hash validation
7. `app/api/creator/tasks/route.ts` — NODE_ENV guard on MOCK_TRANSFERS, select clause on agent includes
8. `app/api/agent/tasks/create/route.ts` — NODE_ENV guard, JSON parse handling, input validation (title/desc/budget limits, maxWorkers bounds, deadline)
9. `next.config.ts` — Security headers, productionBrowserSourceMaps: false
10. `app/api/upload/route.ts` — Allowlist extensions, sanitized filenames, NODE_ENV guard on dev mode

### Batch 2 — High
11. `app/api/creator/submissions/[submissionId]/approve/route.ts` — Atomic updateMany, PROCESSING/FAILED payout states
12. `lib/dispute-jury.ts` — Atomic resolveDispute, XML tag wrapping for prompt injection, juror abstention (no biased default), minimum-quorum escalation
13. `app/api/disputes/route.ts` — IDOR scope (admin sees all, others see own), error sanitization, JSON parse handling
14. `app/api/disputes/[disputeId]/route.ts` — Auth check (admin/creator/operator only)
15. `app/api/disputes/[disputeId]/resolve/route.ts` — Error sanitization, JSON parse handling
16. `app/api/agent/tasks/[taskId]/apply/route.ts` — Cover message validation, atomic worker slot (updateMany + rollback), credentials hidden
17. `app/docs/api/page.tsx` — HTML entity escaping before dangerouslySetInnerHTML
18. `middleware.ts` — NEW: Admin route protection (privy-token cookie check)
19. `app/(admin)/layout.tsx` — NEW: Server-side admin auth guard

### Batch 3 — Medium
20. `app/api/milestones/[milestoneId]/route.ts` — Fixed agent access check (operatorId)
21. `app/api/tasks/[taskId]/messages/route.ts` — Removed email from sender select
22. `app/(agent)/browse/page.tsx` — Select clause excluding credentials/escrow
23. `app/(agent)/my-tasks/page.tsx` — Strip credentials from non-accepted apps
24. `app/(creator)/tasks/[taskId]/page.tsx` — creatorId ownership check
25. `app/api/agent/register/route.ts` — Name length limit (100), capabilities array validation/sanitization

### Batch 4 — Low
26. `app/api/auth/logout/route.ts` — Changed GET to POST, GET returns 405
27. `components/layouts/app-shell.tsx` — Logout link changed from `<a>` to POST fetch
28. `app/api/agent/tasks/[taskId]/submit/route.ts` — Evidence URL validation (https only)
29. `app/api/agent/milestones/[milestoneId]/submit/route.ts` — Evidence URL validation (https only)

### Schema
30. `prisma/schema.prisma` — Added PROCESSING and FAILED to PayoutStatus enum
