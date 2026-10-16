# Release checklist

Each row: `verified`, `blocked`, or `not_yet_tested`, with evidence.

| Category | Required proof | Status | Evidence |
|----------|----------------|--------|----------|
| Business | A specific two-party conflict, a feasible alternative, all unknowns identified | not_yet_tested | |
| Cultural data | Authenticated Qloo discovery used in the public app, traceable signals, stated limitations | blocked | EXT-QLOO-KEY |
| Agent | Conditional research plan, bounded real tool calls, documented re-planning and fallback | not_yet_tested | |
| Decision engine | Deterministic hard constraints, Agreement Frontier, tested decision reversal | not_yet_tested | |
| UX | Anonymous sample journey on mobile and desktop, keyboard, error states, fast first render | not_yet_tested | |
| Security | No client secrets, no cross-session leakage, no open model proxy, safe host token | not_yet_tested | |
| Quality | Typecheck, lint, unit, integration, e2e, evaluation green; measured metrics | not_yet_tested | |
| Infrastructure | Free tier verified, public endpoint reachable, no paid dependencies | blocked | EXT-CF-AUTH |
| Open source | Public repo, detectable licence, setup instructions, clean history | blocked | EXT-GH-CLI |
| Documentation | README, architecture, business case, evaluation, limitations, demo guide | not_yet_tested | |
| Audit | Last pushed commit and deployed version recorded; no blocked release-critical gates | blocked | |

## Known limitations
- To be filled from `docs/limitations.md`.
