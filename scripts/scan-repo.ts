/**
 * Pre-push hygiene scan over tracked files: likely secrets, private files that must never be
 * tracked, and wording that does not belong in a standalone product repository.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { localVar } from "./lib";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const problems: string[] = [];

// Local state, build output, and private notes. Assistant instructions and development ledgers are local
// working material too, not part of the product.
const FORBIDDEN_PATHS = [
  /^\.dev\.vars$/,
  /^\.env$/,
  /^\.env\.(?!example$)/,
  /^\.local\//,
  /^\.wrangler\//,
  /^node_modules\//,
  /^dist\//,
  /(^|\/)CLAUDE(\.local)?\.md$/,
  /^\.claude\//,
  /^\.agent\//,
];
const SECRET_PATTERNS: [string, RegExp][] = [
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{36,}/],
  ["Cloudflare API token assignment", /CLOUDFLARE_API_TOKEN[ \t]*=[ \t]*\S{20,}/],
  ["credential assignment", /\b(QLOO_API_KEY|GEMINI_API_KEY|CLIENT_KEY_SALT)[ \t]*=[ \t]*[A-Za-z0-9_-]{12,}/],
];
// Key formats change (Gemini keys no longer all start with "AIza"), so we also look for the exact
// local secret values. They are compared in memory and never printed.
const LOCAL_SECRETS = ["QLOO_API_KEY", "GEMINI_API_KEY", "CLIENT_KEY_SALT"]
  .map((name) => [name, localVar(name)] as const)
  .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string" && entry[1].length >= 12);

// Stored reversed so this file does not itself contain the wording it guards against.
const OFF_BRAND_TERMS = ["nohtakcah", "tsopved", "gnigduj", "segduj", "ezirp", "tsetnoc"].map((w) => [...w].reverse().join(""));
const OFF_BRAND = new RegExp(`\\b(${OFF_BRAND_TERMS.join("|")})\\b`, "i");

for (const file of files) {
  if (FORBIDDEN_PATHS.some((p) => p.test(file))) problems.push(`${file}: must not be tracked`);
  if (file === "package-lock.json" || /\.(png|jpe?g|webp|woff2?|ico)$/.test(file)) continue;
  if (statSync(file).size > 1_000_000) {
    problems.push(`${file}: larger than 1 MB`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const [name, pattern] of SECRET_PATTERNS) if (pattern.test(text)) problems.push(`${file}: possible ${name}`);
  for (const [name, value] of LOCAL_SECRETS) if (text.includes(value)) problems.push(`${file}: contains the local ${name} value`);
  if (OFF_BRAND.test(text)) problems.push(`${file}: contains wording that does not belong in the product repository`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `Scanned ${files.length} tracked files (${LOCAL_SECRETS.length} local secret values compared): no secrets, private files, or off-brand wording found.`,
);
