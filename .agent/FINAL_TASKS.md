# Final improvement cycle: tasks

Status vocabulary: `pending`, `in_progress`, `verified_complete`, `blocked_external`, `failed_needs_fix`, `deferred`.
Evidence for each `verified_complete` item is in `FINAL_PROGRESS.md`.

| ID | Phase | Task | Status |
|----|-------|------|--------|
| F0-01 | Recovery | Verify HEAD, CI, production version, health, baseline checks | verified_complete |
| F1-01 | Audit | Import-graph, unused exports and dependencies, stale docs and scripts | verified_complete |
| F1-02 | Audit | Remove proven-dead code in small commits | verified_complete |
| F2-01 | Defects | One affinity formatter shared by discovery, brief, and JSON export | verified_complete |
| F2-02 | Defects | Skeptical review of state, provenance, and labels across the journey | verified_complete |
| F3-01 | Product | Proposal ideas from distinct evidence, checked against the rules | verified_complete |
| F3-02 | Product | Reference sensitivity (leave-one-out), opt-in, bounded calls | verified_complete |
| F2-03 | Defects | What-if brief lists edited values as unconfirmed proposals | verified_complete |
| F4-01 | Security | Threat model, findings, fixes with regression tests | verified_complete |
| F5-01 | Evaluation | Extend offline evaluation for any new capability; private outreach packet | in_progress |
| F6-01 | Design | First-time-owner review of the live product; clarity fixes | pending |
| F7-01 | Repository | README rewrite, docs consolidation, ledger slimming, About metadata | pending |
| F8-01 | Performance | CPU and request measurements of the candidate | pending |
| F9-01 | Review | Independent re-evaluation (private) | pending |
| F10-01 | Release | Full validation, candidate upload, verification, merge, deploy | pending |
| F11-01 | Handoff | Clean checkout build, final cleanup, report | pending |
