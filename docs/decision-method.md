# Decision method

Room for Both makes feasibility decisions with explicit rules, not statistical prediction. Given the same
inputs it always returns the same options, statuses, explanations, and suggested changes. The code lives in
`src/shared/domain` and is covered by unit tests, integration tests, and the evaluation suite.

## Inputs

Each party supplies its own profile (`src/shared/schemas/profiles.ts`). Money is whole US dollars, time is
weekly windows in whole hours, and every categorical field uses a controlled vocabulary so matching is exact.
Any field can be left empty; empty means **unknown**, never zero and never guessed.

Every value the engine reads is reported with its provenance:

| Label | Meaning |
|-------|---------|
| `party_supplied` | Entered by the guest, or by the host through a response link |
| `synthetic_demo` | Invented for the fictional example |
| `qloo_observed` | Returned by Qloo in this research run |
| `derived_rule` | Computed by a rule stated in this document |
| `llm_interpretation` | Drafted by a language model from computed facts |
| `unknown` | Not provided |

A scenario is **two-sided** only when host values come from the host (response link), or when both profiles
are explicitly fictional. Host values typed in by the guest are labelled one-sided and unconfirmed.

## Arrangement templates

| Format | Lengths compared | Host fee | Structural requirements |
|--------|------------------|----------|-------------------------|
| One-day pop-up | 2, 4, 6 hours | day rate | shared window ≥ length; guest footprint ≤ host floor space; ≥1 guest staff; sampling rule if guest samples |
| Curated shelf placement | 2, 4, 8 weeks | weekly fee × weeks | weeks ≥ host minimum; guest shelf need ≤ host shelf space |
| Co-hosted event | 1, 2, 3 hours | hourly fee × hours | shared window ≥ length; hours ≥ host minimum; host staff hours ≥ length; ≥1 guest staff; audience minimum ≤ capacity; sampling rule |

Templates hold no prices or capacities of their own. The lengths are the options compared, not facts.
Their structural assumptions (for example, "a co-hosted event needs host staff for its full length") are
shown in the UI and the brief as `derived_rule` items to confirm.

## Hard constraints

Every option is checked against twelve constraints: guest format acceptance, host format permission,
budget, minimum length, shared time, space, host staffing, guest staffing, category exclusions, sampling,
and two guest conditions (alcohol on premises, exclusivity). Each returns `pass`, `fail`, `unknown`, or
`not_applicable`, the inputs it used with their provenance, and for `unknown` the exact value a missing input
would need for the check to pass (for example, "the host's hourly event fee must be at most $300 to fit a $1,000 budget" for a two-hour event when the guest's own costs are $400).

Some checks can fail before every value is known: if the guest's own costs already exceed the budget, or the
partner fee alone does, no missing value could rescue the option.

**Option status:** `no_go` if any check fails; otherwise `conditional` if any check is unknown; otherwise
`feasible` (on stated requirements). Feasible is not an agreement.

## Agreement Frontier

Each party may rank priorities: the guest from lower outlay, fewer guest staff hours, more customer-facing
hours; the host from a higher fee and fewer host staff hours. Among options that are not no-go, an option is
on the frontier if no other option is at least as good on every stated criterion and strictly better on one.

This is Pareto dominance over the parties' own **ordinal** rankings. It never adds one party's gain to the
other's or invents a common utility scale, so it does not claim economic optimality. Unknown metrics make a pair
incomparable, ties are not dominance, and with no stated priorities the frontier is simply every viable option.

## Decision Reversal

For each no-go option the engine lists, per failed check, the changes that would clear it:

- **Numbers:** the exact threshold, for example a budget of $2,250, a host rate of at most $83 per hour, or a
  footprint of 30 sq ft. Rates are rounded down so the result still fits.
- **Time:** the smallest extension of an existing shared window, or a new window on a day the other party
  already offers.
- **Categorical:** adding a format, lifting a category exclusion, allowing sampling, or dropping a condition.

Changes are ranked by relative size (|change| ÷ original value; categorical changes count as 1). The minimal
change set takes the cheapest **negotiable** change for each failed check, applies them together, and re-runs
the same evaluation. Only combinations confirmed to lift the no-go status are reported. Fields a party marks
non-negotiable are never suggested; if a failed check has no negotiable fix, the option is reported as
blocked by non-negotiable terms.

In the what-if panel every edit re-runs the engine and the decision trace records which options changed
status and why.

## Question ranking

Missing inputs on conditional options are ranked first by how many options they alone would decide (the
input is the only gap), then by how many options depend on them. This is a count of observable dependencies,
not a probability and not a value-of-information estimate.

## How this differs from prediction

A forecasting model would estimate how likely a partnership is to succeed or how much it would earn.
Room for Both does neither. It answers a narrower question with certainty: given what each party said, which
structures are possible, what blocks the rest, and what exactly would have to change. Uncertainty is shown as
named unknowns, not folded into a score.

## Correctness limits

- The model covers only the constraints above. Payment terms, restocking, insurance, and contracts are out of scope.
- Weekly windows cannot express specific dates, holidays, or one-off closures.
- Minimal changes are minimal within the candidate changes generated per check (one per lever), not a global
  optimum over all possible edits.
- Value statements in the brief are hypotheses tied to stated goals, never forecasts.
