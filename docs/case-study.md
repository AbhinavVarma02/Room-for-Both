# Case study: honest cultural intelligence for a two-sided decision

This is an engineering case study built from what was implemented and measured. It reports no customer outcomes,
because there are none yet.

## The problem

Two small businesses considering a collaboration face two different questions: whether they are a good cultural
match, and whether any arrangement fits both sets of terms. Tools that answer the first with a score tend to
blur it into the second. Room for Both keeps them apart: Qloo's taste data proposes *whom to approach and what to
propose*; deterministic rules decide *what the stated terms permit*; commercial success stays unknown.

## Decisions that shaped the product

| Decision | Why | Evidence |
|----------|-----|----------|
| Feasibility is a pure function in shared TypeScript | Same answer in browser and Worker; instant what-if edits; reproducible | 27 of 27 evaluation cases give identical decisions with or without cultural data attached |
| Missing host terms stay unknown | A venue's fees and willingness cannot be inferred from taste | Options with unknown host terms are conditional, never feasible |
| Show the counterfactual in the product | "Qloo helps" should be visible, not asserted | Category-only comparison on every run; in four live scenarios the taste signal swapped one to four of five venues, and once only reordered them |
| Use the venue's own Qloo entity as a second signal | Make the bridge two-sided instead of guest-only | A three-call capability test confirmed place entities work as signals; live venue-side lists shared taste tags but no titles with the guest side, and the product says so |
| A model may choose, never decide | Agency without unpredictability or invented facts | Allow-listed actions, validation before execution, rules as fallback; tests for nine failure modes; two live planning calls validated, injection ignored |
| Fictional terms on a real venue are labelled everywhere | Exploring the method must not imply a real business agreed | Hypothetical labels in the workspace, frontier, brief title, brief warning, and JSON export, all asserted in end-to-end tests |
| Measure CPU on an undeployed version | Release-critical limit on the free plan without risking production | Per-route CPU from Cloudflare analytics on a preview URL; cold-start cost dominates the tail, so splitting research was rejected on evidence |

## What the numbers say, and do not say

- 117 unit tests, 73 integration tests, 32 end-to-end checks on desktop and mobile, 40 evaluation cases, and axe
  checks with no serious or critical issues.
- Five live scenarios: every exactly matched reference was used, every scored venue was explained, all evidence was
  labelled as observed in Qloo, and no generated sentence matched the unsupported-claim patterns.
- None of this shows that taste-informed venues make better partners, that the brief saves time, or that venues
  will answer a host link. Those are hypotheses for user research, which has not started.

## What we would do next

Interview brands, venues, and one intermediary with the script prepared for it; run one pilot on real pairings;
and only then decide whether the product's value per programme justifies paid access to the data it depends on.
