# TaskForce Security Audit — Claude Code Agent Teams

## Context

You are auditing **TaskForce**, a work marketplace for AI agents and humans. The platform handles:
- USDC payments via Solana (escrow wallets managed by Privy)
- User authentication (Privy for humans, API keys for agents)
- File uploads (Vercel Blob)
- Task/milestone workflow with disputes
- AI agent registration and verification

**Tech Stack:**
- Next.js 16 (App Router) + TypeScript
- Prisma + PostgreSQL (direct connection, no Prisma Accelerate)
- Privy (auth for humans, server wallets for escrow)
- Solana (USDC payments)
- Vercel Blob (file uploads)

**Project Location:** `~/Documents/Programming/taskforce-platform/`

---

## Recent Moltbook Hack — Lessons to Apply

A competitor platform (Moltbook) was completely compromised due to:
1. **No Row Level Security** — Supabase tables fully exposed via frontend API key
2. **API keys in frontend JS** — Supabase anon key gave full DB access
3. **Frontend-only validation** — Invite code bypass by changing `valid:false` → `valid:true`
4. **No rate limiting** — 1M fake accounts registered
5. **Plaintext secrets in DMs** — Agents sharing OpenAI keys in messages

**We must verify TaskForce doesn't have equivalent vulnerabilities.**

---

## Audit Scope — Spin Up Agent Teams

Create specialized agent teams for each security domain. Each team should:
1. **Identify vulnerabilities** with specific file paths and line numbers
2. **Rate severity** (Critical / High / Medium / Low)
3. **Provide fix** with code diff or clear instructions
4. **Verify fix** doesn't break functionality

---

## Team 1: Authentication & Authorization

**Audit targets:**
- `lib/auth.ts` — Privy token verification
- `lib/api-auth.ts` — Agent API key validation
- `app/api/**/route.ts` — Every API route's auth checks
- `components/auth/role-guard.tsx` — Client-side auth
- `middleware.ts` (if exists)

**Check for:**
- [ ] Missing auth checks on sensitive endpoints
- [ ] Token validation bypass possibilities
- [ ] API key exposure in responses or logs
- [ ] Session fixation / hijacking vectors
- [ ] Privilege escalation (can agents access human-only endpoints?)
- [ ] Can users access other users' data? (IDOR vulnerabilities)
- [ ] Is `getAuthUser()` called before every sensitive operation?
- [ ] Agent status checks (TRIAL vs VERIFIED_CAPABILITY) enforced server-side?

**Specific tests:**
```bash
# Test: Can an unauthenticated request access protected endpoints?
curl -X GET http://localhost:3000/api/creator/tasks

# Test: Can Agent A access Agent B's data?
# Test: Can a TRIAL agent create tasks? (should be blocked)
# Test: Are API keys validated on every request, not cached insecurely?
```

---

## Team 2: Database & Data Access

**Audit targets:**
- `prisma/schema.prisma` — Schema review
- `lib/prisma.ts` — Connection setup
- All files using `prisma.` queries

**Check for:**
- [ ] SQL injection via raw queries (`prisma.$queryRaw`, `prisma.$executeRaw`)
- [ ] Missing `where` clauses that could leak data across users
- [ ] Sensitive fields exposed in API responses (passwords, keys, tokens)
- [ ] Are agent API keys hashed or stored plaintext?
- [ ] Can one user's query return another user's records?
- [ ] Cascade deletes that could orphan or expose data
- [ ] Database connection string exposure

**Specific tests:**
```typescript
// Pattern to find: queries without user scoping
prisma.task.findMany({}) // BAD — returns all tasks
prisma.task.findMany({ where: { userId: currentUser.id } }) // GOOD

// Pattern to find: sensitive field exposure
select: { user: { select: { apiKey: true } } } // BAD
```

---

## Team 3: API Endpoint Security

**Audit targets:**
- Every file in `app/api/`
- Focus on: input validation, error handling, response data

**Check for:**
- [ ] Missing input validation (zod, manual checks)
- [ ] Type coercion vulnerabilities
- [ ] Error messages leaking internal details (stack traces, paths, queries)
- [ ] Rate limiting on sensitive endpoints (login, register, submit)
- [ ] CORS misconfiguration
- [ ] HTTP method enforcement (POST-only endpoints accepting GET?)
- [ ] Request size limits on file uploads
- [ ] Proper HTTP status codes (don't return 200 on errors)

**Specific tests:**
```bash
# Test: Send malformed JSON
curl -X POST http://localhost:3000/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"name": {"$ne": ""}}'

# Test: Send oversized payload
curl -X POST http://localhost:3000/api/agent/tasks/create \
  -H "Content-Type: application/json" \
  -d '{"title": "'$(python3 -c "print('A'*1000000)")'"}'

# Test: Check error response doesn't leak internals
curl -X POST http://localhost:3000/api/nonexistent
```

---

## Team 4: Payment & Wallet Security

**Audit targets:**
- `lib/payment.ts` — USDC transfer logic
- `lib/privy-server.ts` — Wallet management
- `app/api/creator/submissions/[submissionId]/approve/route.ts` — Payout trigger
- `app/api/admin/payouts/approve/route.ts` — Admin payout
- `lib/dispute-jury.ts` — Dispute resolution payouts

**Check for:**
- [ ] Can payments be triggered without proper authorization?
- [ ] Double-spend: Can the same milestone be paid twice?
- [ ] Race conditions in payment approval
- [ ] Are wallet IDs validated before transfer?
- [ ] Can an attacker specify arbitrary destination wallet?
- [ ] Is `MOCK_TRANSFERS` definitely off in production?
- [ ] Privy auth keys exposed in logs or responses?
- [ ] Are transaction hashes verified after transfer?
- [ ] Can escrow be drained by manipulating task status?

**Specific tests:**
```typescript
// Check: Is there a lock/mutex on payment operations?
// Check: Is milestone.status checked BEFORE payment?
// Check: Can userId be spoofed in payment request?
```

---

## Team 5: Frontend Security

**Audit targets:**
- `app/` — All page components
- `components/` — Shared components
- `.env*` files — What's exposed to client?
- Browser network tab — What's sent to client?

**Check for:**
- [ ] API keys or secrets in client-side JavaScript
- [ ] `NEXT_PUBLIC_*` env vars that shouldn't be public
- [ ] Sensitive data in SSR props passed to client
- [ ] XSS vectors (dangerouslySetInnerHTML, unescaped user content)
- [ ] CSRF protection on state-changing operations
- [ ] Clickjacking protection (X-Frame-Options)
- [ ] Secure cookies (HttpOnly, Secure, SameSite)
- [ ] Client-side validation only (must be duplicated server-side)

**Specific tests:**
```bash
# Find exposed env vars
grep -r "NEXT_PUBLIC_" .env* 
grep -r "process.env" app/ components/ --include="*.tsx"

# Check for dangerouslySetInnerHTML
grep -r "dangerouslySetInnerHTML" app/ components/

# View page source for exposed secrets
curl http://localhost:3000 | grep -i "key\|secret\|token\|password"
```

---

## Team 6: File Upload Security

**Audit targets:**
- `app/api/upload/route.ts` (or wherever uploads are handled)
- Vercel Blob integration
- `lib/` — Any file processing

**Check for:**
- [ ] File type validation (server-side, not just client)
- [ ] File size limits enforced server-side
- [ ] Executable file blocking (.exe, .sh, .php, .js)
- [ ] Path traversal in filenames (`../../../etc/passwd`)
- [ ] Malicious file content (polyglots, zip bombs)
- [ ] Are uploaded files served from a different domain?
- [ ] Content-Type sniffing prevention
- [ ] Virus/malware scanning (if applicable)

**Specific tests:**
```bash
# Test: Upload disguised executable
curl -X POST http://localhost:3000/api/upload \
  -F "file=@malicious.exe;filename=innocent.jpg"

# Test: Path traversal
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.txt;filename=../../../etc/passwd"
```

---

## Team 7: Agent System Security

**Audit targets:**
- `app/api/agent/register/route.ts` — Agent registration
- `app/api/agent/tasks/create/route.ts` — Agent task creation
- `prisma/schema.prisma` — Agent model
- Any agent-to-agent communication

**Check for:**
- [ ] Rate limiting on agent registration
- [ ] Agent API key generation (sufficient entropy?)
- [ ] Can agents impersonate other agents?
- [ ] Is agent status (TRIAL/VERIFIED) checked server-side?
- [ ] Can agents access other agents' API keys?
- [ ] Agent capability verification actually enforced?
- [ ] Operator relationship properly validated?

**Specific tests:**
```bash
# Test: Register 1000 agents rapidly
for i in {1..1000}; do
  curl -X POST http://localhost:3000/api/agent/register \
    -H "Content-Type: application/json" \
    -d '{"name": "bot'$i'", "capabilities": ["coding"]}'
done

# Test: Access another agent's details
curl -X GET http://localhost:3000/api/agent/OTHER_AGENT_ID \
  -H "X-API-Key: MY_API_KEY"
```

---

## Team 8: Secrets & Configuration

**Audit targets:**
- `.env`, `.env.local`, `.env.production`
- `next.config.js` / `next.config.ts`
- Any hardcoded secrets in source
- `.gitignore` — Are secrets excluded?

**Check for:**
- [ ] Secrets committed to git history
- [ ] Production secrets in `.env.local`
- [ ] Hardcoded API keys, passwords, tokens in source
- [ ] Default/weak credentials
- [ ] Secrets in error logs or console output
- [ ] Are production env vars properly separated?

**Specific commands:**
```bash
# Search for hardcoded secrets
grep -rE "(api[_-]?key|secret|password|token|credential)" --include="*.ts" --include="*.tsx" --include="*.js" .

# Check git history for secrets
git log -p | grep -iE "(api[_-]?key|secret|password)" | head -50

# Verify .gitignore covers sensitive files
cat .gitignore | grep -E "\.env|secret|key"
```

---

## Team 9: Dispute System Integrity

**Audit targets:**
- `lib/dispute-jury.ts` — AI jury logic
- `app/api/disputes/` — Dispute endpoints
- Dispute → payout flow

**Check for:**
- [ ] Can disputes be created for non-existent submissions?
- [ ] Can the same submission be disputed multiple times?
- [ ] Is jury verdict manipulation possible?
- [ ] Are jury model calls properly authenticated?
- [ ] Can dispute status be changed without proper authorization?
- [ ] Is payout triggered correctly only on WORKER_PAID verdict?
- [ ] Can dispute creator influence the verdict?

---

## Team 10: Infrastructure & Deployment

**Audit targets:**
- `vercel.json` (if exists)
- `next.config.ts`
- Headers and security middleware

**Check for:**
- [ ] Security headers (CSP, HSTS, X-Content-Type-Options)
- [ ] HTTPS enforced
- [ ] Source maps disabled in production
- [ ] Debug endpoints disabled
- [ ] Admin routes protected
- [ ] Database exposed to internet?
- [ ] Proper CORS origins for production

---

## Output Format

For each finding, report:

```markdown
### [SEVERITY] Finding Title

**Location:** `path/to/file.ts:123`

**Description:** 
What the vulnerability is and why it matters.

**Proof of Concept:**
Steps or code to reproduce.

**Fix:**
\`\`\`typescript
// Before (vulnerable)
...

// After (fixed)
...
\`\`\`

**Verified:** [ ] Fix tested and working
```

---

## Priority Order

1. **Critical first:** Auth bypass, payment manipulation, data exposure
2. **High second:** Privilege escalation, injection, secrets exposure
3. **Medium third:** Rate limiting, error handling, missing validation
4. **Low last:** Best practices, code quality, minor issues

---

## Final Deliverable

Create a `SECURITY-AUDIT-REPORT.md` with:
1. Executive summary (pass/fail, critical count)
2. All findings by severity
3. Fixes applied (with commit references if possible)
4. Remaining risks and recommendations
5. Re-test results after fixes

---

**Begin audit. Spin up agent teams. Report findings.**
