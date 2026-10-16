# Release checklist

Each row: `verified`, `blocked`, or `not_yet_tested`, with evidence.

| Category | Required proof | Status | Evidence |
|----------|----------------|--------|----------|
| Business | A specific two-party conflict, a feasible alternative, all unknowns identified | verified | Fictional example: weekend guest vs weeknight host; 2 conditional shelf options; exclusivity question ranked first; e2e + eval E02 |
| Cultural data | Authenticated Qloo discovery in the public app, traceable signals, stated limitations | blocked | Pipeline verified against synthetic upstream (integration) and fixture mode (e2e); live needs EXT-QLOO-KEY, EXT-QLOO-ACCESS |
| Agent | Conditional research plan, bounded tool calls, documented re-planning and fallback | verified (offline) | Integration tests: exact-match policy, broaden location, skip on unmatched tag, budget stop, retry; eval R01–R09 |
| Decision engine | Deterministic hard constraints, frontier, tested reversal | verified | 57 unit tests incl. monotonicity; eval 40/40; mutation check detected |
| UX | Anonymous journey on mobile and desktop, keyboard, errors, fast first render | verified (local) | Playwright 22/22 (Desktop Chrome, Pixel 7); skip link; error states; main chunk 82 KB gzip. Public URL pending |
| Security | No client secrets, no cross-session leakage, no open model proxy, safe host token | verified (local) | Integration tests: key never echoed, trusted host check, token separation and isolation, edit limits, expiry, revocation, consent and output guards; scan:secrets clean |
| Quality | Typecheck, lint, unit, integration, e2e, eval green; measured metrics | verified (local) | `npm run check` exit 0; e2e 22/22; CI on GitHub not yet run |
| Infrastructure | Free tier verified, public endpoint reachable, no paid dependencies | blocked | EXT-CF-AUTH; design fits documented Workers Free and D1 Free limits |
| Open source | Public repo, detectable licence, setup instructions, clean history | blocked | MIT LICENSE and README present locally; EXT-GH-CLI |
| Documentation | README, architecture, business case, evaluation, limitations, demo guide | verified | docs/ set committed (9cbbc0d); public URL to add |
| Audit | Last pushed commit and deployed version recorded; no blocked release-critical gates | blocked | No remote yet; no deployment yet |

## Known limitations
See `docs/limitations.md`. Highlights: three formats only; weekly availability; minimal changes are per-lever minima;
cultural data never changes feasibility; fixture mode without a credential; optional map not shipped.
