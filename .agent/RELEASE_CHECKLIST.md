# Release checklist

Each row: `verified`, `blocked`, or `not_yet_tested`, with evidence.

| Category | Required proof | Status | Evidence |
|----------|----------------|--------|----------|
| Business | A specific two-party conflict, a feasible alternative, all unknowns identified | verified | Fictional example: weekend guest vs weeknight host; 2 conditional shelf options; exclusivity question ranked first; e2e + eval E02 |
| Cultural data | Authenticated Qloo discovery in the public app, traceable signals, stated limitations | blocked | Pipeline verified against synthetic upstream (integration) and fixture mode (e2e); live needs EXT-QLOO-KEY, EXT-QLOO-ACCESS |
| Agent | Conditional research plan, bounded tool calls, documented re-planning and fallback | verified (offline) | Integration tests: exact-match policy, broaden location, skip on unmatched tag, budget stop, retry; eval R01–R09 |
| Decision engine | Deterministic hard constraints, frontier, tested reversal | verified | 57 unit tests incl. monotonicity; eval 40/40; mutation check detected |
| UX | Anonymous journey on mobile and desktop, keyboard, errors, fast first render | verified | Playwright 22/22 against the public URL (Desktop Chrome, Pixel 7) |
| Security | No client secrets, no cross-session leakage, no open model proxy, safe host token | verified (local) | Integration tests: key never echoed, trusted host check, token separation and isolation, edit limits, expiry, revocation, consent and output guards; scan:secrets clean |
| Quality | Typecheck, lint, unit, integration, e2e, eval green; measured metrics | verified | GitHub Actions run 38855382520 (27a2ad6) green; local check, eval 40/40, e2e 22/22 re-run in PROGRESS #6 |
| Infrastructure | Free tier verified, public endpoint reachable, no paid dependencies | verified (partly) | https://room-for-both.room-for-both.workers.dev reachable; verify:public 9/10; fixture-mode CPU 2–21 ms (warm 4–5 ms); bindings are D1, cron, and observability only; plan tier not visible via CLI, no billing change made |
| Open source | Public repo, detectable licence, setup instructions, clean history | verified | https://github.com/AbhinavVarma02/Room-for-Both (public, MIT) |
| Documentation | README, architecture, business case, evaluation, limitations, demo guide | verified | docs/ set committed (9cbbc0d); README links the public URL |
| Audit | Last pushed commit and deployed version recorded; no blocked release-critical gates | blocked | Deployed version recorded in STATE.json; live Qloo gate pending (EXT-QLOO-KEY) |

## Known limitations
See `docs/limitations.md`. Highlights: three formats only; weekly availability; minimal changes are per-lever minima;
cultural data never changes feasibility; fixture mode without a credential; optional map not shipped.
