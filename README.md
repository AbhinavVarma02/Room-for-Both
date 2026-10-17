# Room for Both

**Find common ground. Build a better deal.**

Room for Both helps two independent businesses, a brand (the *guest*) and a venue (the *host*), work out a
collaboration that works for both of them. It suggests culturally aligned partners and themes with Qloo's
taste intelligence. It then checks every pop-up, shelf placement, and co-hosted event against both sides'
actual terms, and shows the smallest negotiable change that would turn a no into a maybe.

**Live app:** https://room-for-both.room-for-both.workers.dev, with live Qloo cultural discovery under a
time-limited Qloo developer credential. When that credential ends, the app switches to a clearly labelled
fictional demonstration; see [data sources and licensing](docs/data-licensing.md).

![Room for Both home page](docs/images/landing.png)

## Why

Small-business collaborations usually stall on details: the brand wants a weekend, the venue only does
weeknights; the fee fits but the brand's own costs do not; nobody knows what to propose instead. Room for
Both replaces "this won't work" with "this would work if…", and is honest about what is still unknown.

## What it does

| | |
|---|---|
| **Cultural Bridge** | Matches the guest's cultural references to Qloo entities and ranks venues in their market by affinity, with a collaboration theme such as a co-curated reading list. Every signal shows where it came from and what it does not prove. |
| **Two-sided inputs** | The host states its own fees, days, space, staff time, and house rules, privately through an expiring link if wanted. Nothing about the host is inferred. |
| **Agreement Frontier** | Nine arrangement options marked *feasible on stated requirements*, *conditional*, or *no-go*, each with every check, input, provenance label, assumption, and unknown. Options not beaten on every stated priority are highlighted. No compatibility score. |
| **Decision Reversal** | "Why is this blocked?" plus the smallest negotiable change, verified by re-running the same rules. Sliders and toggles recompute every decision instantly, and a trace records what flipped and why. |
| **Decision brief** | A printable draft for both parties: proposed starting point, each side's value hypothesis, the first three questions to ask, cultural evidence with sources, and inputs grouped by provenance. |

<p>
  <img src="docs/images/discovery.png" alt="Cultural discovery with venue candidates and a cultural bridge" width="49%" />
  <img src="docs/images/frontier.png" alt="Agreement Frontier trade-off chart and summary" width="49%" />
</p>

![Decision Reversal showing why an option is blocked and the what-if controls](docs/images/reversal.png)

*Screenshots show the fictional example in fixture mode. Both businesses are invented, and fixture cultural
data is labelled fictional throughout the app. In live mode the same screens show Qloo results labelled
"Observed in Qloo" with their source request and retrieval time.*

## Principles

- **Deterministic decisions.** Feasibility, the frontier, and reversals are pure functions of the inputs
  ([decision method](docs/decision-method.md)). A language model may only rephrase computed facts, and only on request.
- **Provenance everywhere.** Every value is labelled as party-supplied, fictional example, observed in Qloo,
  derived by a rule, language-model draft, or unknown. Missing host terms stay unknown and keep an option conditional.
- **No forecasts.** No revenue, foot-traffic, or demand predictions. Value statements are hypotheses.
- **Cultural affinity is not permission.** Qloo data suggests which relationship to explore. It never stands in for
  rent, traffic, space, or a venue's willingness to partner.

## Try it

Choose **Try the fictional example** on the home page for the complete journey in about 90 seconds
([demo guide](docs/demo-guide.md)), or **Start your own scenario**.

## Architecture

One Cloudflare Worker serves the React app and a Hono API on the Workers Free plan, with a D1 database for
private host links and rate-limit counters. The decision engine in `src/shared/domain` runs in both the
browser and the Worker. See [architecture](docs/architecture.md).

```text
src/shared   Zod schemas, vocabularies, deterministic engine, fictional example
src/worker   Hono API, Qloo and Gemini adapters, research planner, D1 persistence, security, telemetry
src/client   React + Vite + Tailwind single-page app
db           D1 migrations
tests        unit, integration, e2e, evaluation, synthetic fixtures
docs         product and engineering documentation
```

## Run locally

Requires Node.js 22 or later.

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Without a Qloo credential the app runs in a clearly labelled **fixture mode** with fictional cultural data, so
every feature works offline. For live research, put `QLOO_API_KEY` and `QLOO_BASE_URL` (the host named in your
credential's instructions) in `.dev.vars`, which is git-ignored, then run `npm run smoke:live`: one probe call,
a field check of real responses, and one bounded research run. For the optional summary, add `GEMINI_API_KEY`
(a Google AI Studio key) and `GEMINI_MODEL`, then run `npm run smoke:gemini` (two calls). Keys stay
server-side; nothing is exposed to the browser bundle.

## Quality

| Command | What it runs |
|---------|--------------|
| `npm run typecheck` | Strict TypeScript for client, Worker, tests, and tooling |
| `npm run lint` | ESLint |
| `npm test` | Unit tests for every constraint, frontier rule, reversal property, and schema bound |
| `npm run test:integration` | The real API against a local D1, with a synthetic Qloo upstream shaped like real responses |
| `npm run test:e2e` | Playwright journeys on desktop and mobile against the production build |
| `npm run eval` | 40-case offline evaluation; results in [docs/evaluation-results.md](docs/evaluation-results.md) |
| `npm run eval -- --live` | Five fixed live Qloo scenarios, aggregate metrics only (needs a credential) |
| `npm run scan:secrets` | Tracked-file scan for secrets, private files, and the exact local secret values |
| `npm run check` | Everything offline, as CI runs it |

See [evaluation](docs/evaluation.md) for what is and is not measured, including the live Qloo results.

## Deploy

Free-tier deployment to Cloudflare Workers with D1 is covered step by step in [deployment](docs/deployment.md),
including secrets, migrations, and `npm run verify:public` to check a live URL from the outside.

## Documentation

- [Business case](docs/business-case.md)
- [Decision method](docs/decision-method.md)
- [Architecture](docs/architecture.md)
- [API and Qloo routes](docs/api.md)
- [Data sources, licensing, and operating modes](docs/data-licensing.md)
- [Security](docs/security.md)
- [Privacy and data use](docs/privacy.md)
- [Limitations](docs/limitations.md)
- [Evaluation](docs/evaluation.md)
- [Deployment](docs/deployment.md)
- [Demo guide](docs/demo-guide.md)

## Data and attribution

Cultural data, when live, comes from the [Qloo Insights API](https://docs.qloo.com/) and is shown with its
source and limits. It is used under Qloo's terms for the current credential, is not stored beyond what
[data sources and licensing](docs/data-licensing.md) lists, and is never included in this repository.
Optional summaries are drafted with Google's Gemini API after visitor consent. Fonts are Inter and Fraunces (SIL Open Font License) via Fontsource. Icons are from Lucide
(ISC).

## Licence

[MIT](LICENSE)
