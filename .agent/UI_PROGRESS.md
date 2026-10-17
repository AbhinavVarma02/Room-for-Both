# UI refinement progress

## #1 Baseline (U0)

- `main` = `61cb9ac`, GitHub Actions 39056532383 success; production serves 61619c8f; `/api/health` live, narrative
  enabled, planner available. Branch `ui/visual-refinement` created from `main`.
- Fixture preview screenshots of all six stages, desktop 1440 px and mobile 375 px, for the fictional example and the
  guided demonstration (private, `.local/ui-shots/before`). Visible words in `main` (desktop): guest 723, discovery
  862, host 892, frontier 1104, reversal 453, brief 1421. Frontier page 4189 px tall on desktop, 7908 px on mobile.
- Main weaknesses observed: on mobile the first screen of every step is the example notice, the guide, and the
  intro paragraph, with no result visible; the Frontier shows a headline card, three explanation cards, the idea
  cards, a chart, a summary, and nine full option cards at once; the status counts sit beside the chart instead
  of leading; Reversal puts the before → after result in small badges; the brief opens with metadata, not a summary.

## #2 Redesign (U1–U5) and tests (U6)

- `ec4e105`: Frontier opens with the answer and three engine counts (tiles filter the explorer), then the
  arrangement closest to agreement as now → proposed change → re-checked; the "after" state is the engine re-run on a
  copy with the change applied, and the change is labelled as not agreed. One recommended idea with the others as
  tabs; an explorer with status filters, a compact list, and one focused detail (side panel at ≥1024 px, inline
  below); the trade-off chart (identical amounts drawn side by side, unplotted options named, selected option
  marked) and method notes in disclosures. Reversal leads with the same transition. Brief leads with "At a glance";
  reference sections collapse on screen and open for printing. Discovery shows Qloo's part as three steps, features
  the top venue, states the taste-only caveat once, and folds the research log once done. Host table shows each
  side's source once, marks unknown cells with a dashed box and shades hypothetical host values. Compact step bar,
  example notice, and guide on every step. No change to `src/shared`, the API, or any verdict.
- `fe6f97f`: README screenshots regenerated from fixture mode; README alt text and one methodology label updated.
- Visible words in `main`, desktop, fictional example (before → after): guest 723 → 702, discovery 862 → 688 (−20%),
  host 892 → 877, frontier 1104 → 538 (−51%), reversal 453 → 397 (−12%), brief 1421 → 722 (−49%). Frontier page
  height 4189 → 2666 px desktop, 7908 → 4518 px mobile.
- Checks: `npm run check` exit 0 (unit 139, integration 81, eval 73/73, build); `scan:secrets` exit 0; Playwright
  fixture 34 passed, 2 skipped (need a model), including axe (no serious or critical issues on eight pages) and
  320/360/375/414 px without horizontal scroll. Keyboard walk on the Frontier at 768 px: logical order, visible
  outline on every stop. Reduced motion: global CSS plus `scrollIntoView` honours the preference.

## #3 Candidate (U7)

- Candidate 916b8a6b (from fe6f97f) on the `candidate` alias, production untouched: `/api/health` live; desktop
  Playwright against it 17/18. The failure was a real defect: when venue-side evidence arrived after the first
  render, the idea tabs kept the earlier default instead of the recommended idea. Fixed in the next commit.
- Candidate a601afbd (from the fix): the fictional-research guided tests pass on desktop, including the idea tabs,
  axe, and 320–414 px. The mobile runs of the same tests hit this app's own 12-runs-per-hour research limit
  ("Please wait before researching again") after the session's earlier runs from one address; not a code defect,
  and the same code passed them locally in fixture mode.
- Live calls this cycle (approximate): Qloo about 18 (two live guided runs), Gemini about 2.
