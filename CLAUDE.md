# Room for Both — engineering constitution

Room for Both is a two-sided partnership decision tool for small independent retail and
direct-to-consumer businesses. Tagline: **Find common ground. Build a better deal.**
Repository slug: `room-for-both`. Never rename the product.

## Start of every session

1. Read, in order: this file, `.agent/STATE.json`, `.agent/NEXT.md`, `.agent/BLOCKERS.md`,
   `.agent/TASKS.md`, and the tail of `.agent/PROGRESS.md`.
2. Run `git status` and `git log --oneline -15`; check remotes. Verify ledger claims against
   the code and test output instead of trusting them.
3. Pick the highest-priority unblocked task from `.agent/NEXT.md` and keep going.
4. Retry a blocked task only after detecting the missing capability (credential, login,
   network), starting with the smallest safe smoke test.

## Current state

The application is deployed with live Qloo cultural discovery and the optional Gemini summary, both verified
locally and on the public URL (`.agent/PROGRESS.md` #7). Live access uses a time-limited Qloo credential on the
host named in its issuing guide; when it ends, follow `.agent/NEXT.md`. Owner confirmations (Cloudflare Free plan,
the credential email) are recorded (`.agent/PROGRESS.md` #8); the credential's actual end is unknown and is never
assumed. Open: the RISK-CPU and RISK-CREDENTIAL-END watch items in `.agent/BLOCKERS.md`.

## Targeted upgrade (complete)

A one-time, owner-authorised upgrade added the selected-venue journey, category-only and language-model
comparisons, a two-sided cultural bridge, a bounded model-assisted planner with the rules as fallback, and a guided
demonstration. It is verified and deployed (`.agent/UPGRADE_PROGRESS.md` #11; history in `.agent/UPGRADE_*`). Scope
is frozen again: only monitoring, defect fixes, and the credential transition in `.agent/NEXT.md`.

## Final improvement cycle (active)

An owner-authorised final cycle (audit, defect fixes, security review, documentation, one bounded product
improvement) runs on branch `final/product-excellence`. Recover from `.agent/FINAL_NEXT.md`, `FINAL_STATE.json`,
`FINAL_TASKS.md`, and `FINAL_PROGRESS.md`, then the real Git and deployment state.

## Non-negotiable rules

- **Truthful status.** Status vocabulary: `pending`, `in_progress`, `implemented_unverified`,
  `blocked_external`, `verified_complete`, `failed`. Nothing is `verified_complete` until its
  gate test has passed and the evidence is recorded in `.agent/PROGRESS.md`.
- **No fabricated data.** No invented partners, Qloo affinities, addresses, availability, prices,
  audiences, revenue, or metrics. Synthetic data is allowed only when visibly labelled
  `synthetic_demo` / "Fictional example".
- **Provenance on every key field:** `qloo_observed`, `party_supplied`, `synthetic_demo`,
  `derived_rule`, `llm_interpretation`, or `unknown`. Generated prose can never upgrade provenance.
- **Two-sided means two parties.** Host preferences are never inferred; missing host values make an
  option `conditional`, not approved. Cultural affinity is never a proxy for space, traffic, rent,
  permission, or commercial benefit.
- **Deterministic decisions.** Hard constraints, the Agreement Frontier, and Decision Reversal are
  pure functions in `src/shared/domain`. A language model may only draft bounded prose from
  already-computed facts. No revenue, footfall, or probability forecasts.
- **Verified integrations only.** Qloo routes, headers, and response fields come from official docs
  or authenticated observation, and the API base URL and key live only in secrets
  (`QLOO_BASE_URL`, `QLOO_API_KEY`). Never commit raw upstream responses, and never commit the
  credential's host name (it carries programme wording). Spend live quota sparingly: the key allows
  5 calls per second and 10,000 per month.
- **$0 additional spend.** Workers Free, D1 Free, free public GitHub Actions runners, open-source
  packages. Never upgrade a plan, add billing, or provision paid resources.
- **Repository hygiene.** No secrets, `.dev.vars`, `.env`, personal data, or raw API payloads in Git.
  Private notes go in `.local/` (ignored). All tracked text reads as a standalone commercial product.
- **Comments** explain *why*, in first-person plural, sparingly.
- **Git.** Small conventional commits after each coherent change; run the relevant checks and scan the
  staged diff for secrets first. Never force-push, rewrite published history, or delete remote data.
- **No dates in plans.** Track milestones (P0–P10) and dependencies, not calendars.

## Layout

- `src/shared/` — Zod schemas, types, constants, and the deterministic domain engine (runs in browser and Worker).
- `src/worker/` — Hono API on Cloudflare Workers: routes, Qloo/Gemini adapters, orchestration, persistence, security, telemetry.
- `src/client/` — React + Vite single-page app.
- `db/migrations/` — D1 schema.
- `tests/{unit,integration,e2e,evaluation,fixtures}` — fixtures are original and synthetic.
- `docs/` — public product and engineering documentation.
- `.agent/` — recovery ledger (tracked, contains no secrets).

## Commands

See `package.json`. Key scripts: `npm run dev`, `npm run typecheck`, `npm run lint`, `npm test`,
`npm run test:integration`, `npm run test:e2e`, `npm run eval`, `npm run build`, `npm run check`
(everything offline), `npm run deploy`, `npm run smoke:live`, `npm run verify:public`.
