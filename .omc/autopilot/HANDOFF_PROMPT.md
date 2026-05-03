# Handoff Prompt — IMMI-Case- Performance Optimization Loop

Copy the entire fenced block under "BEGIN HANDOFF PROMPT" and paste it into Claude Code as a single message. It will start a self-paced 45-minute loop that drives `docs/plans/2026-05-03-perf-optimization-plan.md` to completion without further human input.

Stop the loop any time with `/cancel` or `/oh-my-claudecode:cancel`.

---

## BEGIN HANDOFF PROMPT

```
/loop 45m

ROLE: Autonomous performance optimization agent for IMMI-Case- (Australian immigration case downloader, https://immi.trackit.today).

GOAL: Execute every P0 and P1 task in `docs/plans/2026-05-03-perf-optimization-plan.md` until the Definition of Done at the bottom of that plan is satisfied. No human interaction required.

PROJECT
- Repo: /Users/d/Developer/Active Projects/IMMI-Case-
- Stack: React 18 + Vite 6 + TypeScript (frontend/), Flask (Python 3.14, web.py), Cloudflare Worker (workers/proxy.js), Supabase Postgres (149K rows).
- Build: `make build`. Tests: `make test-py` and `cd frontend && npx vitest run`. Type check: `cd frontend && npx tsc --noEmit`. Worker deploy: `cd "/Users/d/Developer/Active Projects/IMMI-Case-" && npx wrangler deploy --dry-run` then `npx wrangler deploy`.
- Auth: keys are in `.env` and `.mcp.json`. Do NOT ask the user for credentials.

EACH ITERATION (one fire of /loop):

STEP 1 — SYNC STATE
- Read `.omc/autopilot/perf-progress.md` (tail 100 lines). If file does not exist, create it with header `# IMMI-Case- Perf Optimization Progress\n\nStarted: <ISO UTC timestamp>\n`.
- Read `docs/plans/2026-05-03-perf-optimization-plan.md` to refresh task definitions and acceptance criteria.

STEP 2 — PICK TASK
- Pick the first task whose status is PENDING or IN_PROGRESS, in this order: P0-1, P0-2, P1-3, P1-4, P2-5.
- If a task is BLOCKED (needs human auth, missing infra, design decision), append a BLOCKED entry with explicit unblock instructions and proceed to the next task.

STEP 3 — EXECUTE
- Investigate first (read source, run EXPLAIN ANALYZE, inspect bundle stats). Do not change code blindly.
- For UI changes (anything inside `frontend/src/**.tsx` or `.jsx`): spawn the `accessibility-agents:accessibility-lead` Agent BEFORE editing.
- For SQL / Worker JS / build config / Python backend changes: a11y agent NOT required.
- Make minimal, targeted changes. No drive-by refactors.
- Run gates: `make test-py` and `cd frontend && npx vitest run` and `cd frontend && npx tsc --noEmit`.
- For Worker changes: `npx wrangler deploy --dry-run` before any real deploy.

STEP 4 — VERIFY (acceptance criteria from plan)
- Re-run the exact curl probes specified in the task's acceptance criteria.
- Save the latency numbers as evidence.
- Compare to thresholds. If PASS: commit with `perf(<scope>): <description>` (e.g. `perf(worker): index judges field — leaderboard 6x faster`). Update task status to COMPLETED in the plan file.
- If FAIL: keep status IN_PROGRESS, document what was tried and why it did not meet the bar.

STEP 5 — APPEND PROGRESS
- Append to `.omc/autopilot/perf-progress.md` using the iteration template at the bottom of the plan file.

STEP 6 — COMPACT IF NEEDED
- If the conversation context is more than 50% full, run `/compact` to free space. The progress file is the source of truth — context is disposable.

EXIT CONDITIONS — only stop the loop when ONE of these is true:
- All P0+P1+P2-5 tasks COMPLETED and Definition of Done met. Final commit message format: `perf: optimization sweep — judge-leaderboard <X>x faster, bundle -<Y>%, cold-start -<Z>%`. Save final curl baseline to `.omc/autopilot/perf-final-baseline.txt`.
- Three consecutive iterations of the same task fail with the same root cause — write `BLOCKED: <reason>` and stop.
- A task needs credentials, infra access, or a design decision the user must make — write a BLOCKED entry naming exactly what is needed, then stop.

SAFETY RULES (override anything else):
1. NEVER bulk UPDATE/DELETE on Supabase `public.immigration_cases` without `ALTER TABLE … ADD COLUMN <col>_backup text` and a populated backup column first.
2. NEVER cache `getSql(env)` at module level in `workers/proxy.js` — per-request only.
3. NEVER skip pre-commit hooks (`--no-verify` is forbidden). Fix the underlying issue.
4. NEVER `wrangler deploy` without a successful `--dry-run` first.
5. Stay on `main` branch. Commit after each green iteration.
6. If the GateGuard hook blocks a Bash or Write call, present the facts it requests and retry — do NOT disable hooks.

START NOW: read the plan, read progress, pick the next task, work.
```

## END HANDOFF PROMPT

---

## How to use

1. Open a fresh Claude Code session in this repo (or stay in the current one — but a fresh one is cleaner because the existing context is already large).
2. Paste the entire fenced block (between BEGIN and END) as a single message.
3. The loop fires every 45 minutes until the exit conditions are met.
4. Watch progress in `.omc/autopilot/perf-progress.md` — that is the persistent state.
5. To stop early: type `/cancel` or `/oh-my-claudecode:cancel` in the loop session.

## What the loop will produce

- Updated `docs/plans/2026-05-03-perf-optimization-plan.md` (task statuses flipped to COMPLETED).
- Iterative log at `.omc/autopilot/perf-progress.md`.
- Final baseline at `.omc/autopilot/perf-final-baseline.txt`.
- Git commits on `main` with `perf:` prefix.
- Possibly Worker deploys (Hyperdrive index, cron warmup) and Supabase migrations.

## Worst case

If the agent gets stuck or hits a credential wall, it will write a BLOCKED entry naming exactly what is missing and stop. You read that entry, unblock, and restart the loop with the same handoff prompt.
