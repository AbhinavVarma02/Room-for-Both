# Deployment

Room for Both deploys as a single Cloudflare Worker with static assets and one D1 database, all within the
Workers Free plan. No step below requires a paid plan or a payment method.

## Prerequisites

- Node.js 22 or later (CI uses 24) and npm.
- A Cloudflare account on the Free plan.
- Optional: a Qloo API credential you are authorised to use from a server (see
  [data sources and licensing](data-licensing.md)), and a Gemini API key created in Google AI Studio for a
  project without billing, so the free tier applies and no charge is possible.

## 1. Install and check locally

```bash
npm ci
npm run check
```

`npm run check` runs typecheck, lint, unit and integration tests, the evaluation suite, and the production build.

## 2. Run locally

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Leave `QLOO_API_KEY` empty to use the labelled fixture mode. To test live research, add your key to
`.dev.vars` (never commit it) and run `npm run smoke:live`. It works in three stages:

1. **Host probe.** One minimal authenticated call per candidate host: `QLOO_BASE_URL`, any hosts in
   `QLOO_CANDIDATE_BASE_URLS`, then Qloo's documented production host. It reports which host accepts the key. Do
   not assume a credential works on every host; use the host named in your credential instructions.
2. **Response structure.** Reports which fields real payloads carry, against the fields the normaliser reads.
3. **Bounded run.** One complete research run (at most 7 calls). It prints counts only, never values or keys.

Set `QLOO_BASE_URL` to the accepted host locally and as a Worker secret (step 5).

For the optional summary, add `GEMINI_API_KEY` and `GEMINI_MODEL` and run `npm run smoke:gemini`. It makes two
calls through the production adapter (one normal, one with an injection attempt inside the facts) and reports
whether the output passed the checks, with latency and token counts. To confirm a key's project has no
billing account, `gcloud billing projects describe <project-id>` should show `billingEnabled: false`.

## 3. Sign in to Cloudflare

```bash
npx wrangler login
npx wrangler whoami
```

## 4. Create the database and apply migrations

```bash
npx wrangler d1 create room-for-both
```

Copy the printed `database_id` into the `d1_databases` entry in `wrangler.jsonc`, then:

```bash
npm run db:migrate:remote
```

## 5. Set secrets

Enter each value at the interactive prompt so it never appears in shell history or logs:

```bash
npx wrangler secret put CLIENT_KEY_SALT
npx wrangler secret put QLOO_BASE_URL
npx wrangler secret put QLOO_API_KEY
```

Optional:

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GEMINI_MODEL
```

Every secret change creates a new Worker version immediately. Set `QLOO_BASE_URL` before `QLOO_API_KEY`, so the
key is never live without its host. To change several secrets in one version, pipe a JSON object to
`npx wrangler secret bulk` from a script that reads your local `.dev.vars`, so no value is typed on a command
line. `npx wrangler secret list` shows names only.

Deploy the code first and set secrets second: a secret change re-activates the code that is currently deployed.

## 6. Deploy

```bash
npm run deploy
```

To show the repository link in the footer, build with `VITE_REPOSITORY_URL` set (for example in `.env`).

## 7. Verify from the outside

```bash
npm run verify:public -- https://room-for-both.<your-subdomain>.workers.dev
```

The script checks the home page and security headers, client routes, health, a deterministic evaluation, a
complete research stream, that live mode is active, and that cross-origin writes are refused.

To measure CPU time per route on the deployed Worker (Workers Free allows 10 ms per request):

```bash
npm run measure:cpu -- https://room-for-both.<your-subdomain>.workers.dev
```

## Rotating or revoking credentials

- **Rotate** a key: create the new key with the provider, `npx wrangler secret put <NAME>` with the new value,
  run `npm run verify:public`, then revoke the old key with the provider. Update your local `.dev.vars` too.
- **Revoke** live research: `npx wrangler secret delete QLOO_API_KEY`. The app immediately serves the labelled
  fictional demonstration. Do the same with `GEMINI_API_KEY` to turn summaries off.
- **Suspected exposure:** revoke the key with the provider first, then delete or replace the secret, then check
  `npm run scan:secrets` and the Git history. Never paste a key into an issue, a log, or a commit.
- **When a time-limited credential ends,** follow [data sources and licensing](data-licensing.md#after-the-credential-ends).
  The app degrades safely on its own, but deleting the secret makes fixture mode explicit from the first screen.

## Confirm the plan

Wrangler's sign-in cannot read billing details. Confirm the account is on the Free plan in the Cloudflare dashboard
under **Workers & Pages → Plans** (or **Manage account → Billing → Subscriptions**). Never upgrade to remove a limit; reduce the work per request instead.

## Tuning limits

`wrangler.jsonc` `vars` control the bounds: `QLOO_MAX_CALLS_PER_RUN` (default 7), `QLOO_DAILY_CALL_CEILING`
(300), `RESEARCH_RUNS_PER_HOUR_PER_CLIENT` (12), and `QLOO_TIMEOUT_MS` (8,000). Set the daily ceiling to your
credential's monthly allowance divided by the days in the period you need to cover; Qloo reports the
allowance in the `x-month-ratelimit-limit` response header.

## Rollback

```bash
npx wrangler deployments list
npx wrangler rollback <version-id>
```

Rollback restores an earlier code version with the current secrets. D1 data and migrations are not touched;
migrations are additive, so an earlier version still reads the current schema. After a rollback, run
`npm run verify:public` again.
