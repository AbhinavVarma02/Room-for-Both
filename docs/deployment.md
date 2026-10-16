# Deployment

Room for Both deploys as a single Cloudflare Worker with static assets and one D1 database, all within the
Workers Free plan. No step below requires a paid plan or a payment method.

## Prerequisites

- Node.js 22 or later (CI uses 24) and npm.
- A Cloudflare account on the Free plan.
- Optional: a Qloo API credential you are authorised to use from a server, and a Gemini API key for a model
  that is free for your account.

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
`.dev.vars` (never commit it) and run `npm run smoke:live`, which makes one bounded run and prints counts only.

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
npx wrangler secret put QLOO_API_KEY
npx wrangler secret put CLIENT_KEY_SALT
```

Optional:

```bash
npx wrangler secret put QLOO_BASE_URL
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GEMINI_MODEL
```

`npx wrangler secret list` shows names only.

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

## Tuning limits

`wrangler.jsonc` `vars` control the bounds: `QLOO_MAX_CALLS_PER_RUN` (default 7), `QLOO_DAILY_CALL_CEILING`
(1,500), `RESEARCH_RUNS_PER_HOUR_PER_CLIENT` (12), and `QLOO_TIMEOUT_MS` (8,000). Lower them to match your
Qloo quota.

## Rollback

```bash
npx wrangler deployments list
npx wrangler rollback
```
