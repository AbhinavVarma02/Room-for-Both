import { existsSync, readFileSync } from "node:fs";

/** Reads KEY=value pairs from .dev.vars without printing them. Environment variables win. */
export function localVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".dev.vars")) return undefined;
  for (const line of readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && match[1] === name) {
      const value = (match[2] ?? "").replace(/^["']|["']$/g, "");
      return value === "" ? undefined : value;
    }
  }
  return undefined;
}

export function table(rows: [string, boolean, string?][]): boolean {
  const width = Math.max(...rows.map((r) => r[0].length));
  for (const [name, ok, detail] of rows) console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(width)}  ${detail ?? ""}`);
  return rows.every((r) => r[1]);
}
