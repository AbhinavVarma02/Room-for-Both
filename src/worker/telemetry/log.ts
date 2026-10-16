/**
 * Structured, privacy-safe logging. We log route names, stage timings, counts, and error
 * classes. We never log request bodies, tokens, API keys, client addresses, or upstream payloads.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const FORBIDDEN_KEYS = /(api_?key|token|secret|password|authorization|cookie|email|body|address|^ip$)/i;

function sanitise(fields: LogFields | undefined): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    out[k] = typeof v === "string" && v.length > 200 ? `${v.slice(0, 200)}…` : v;
  }
  return out;
}

export function createLogger(requestId: string, sink: (line: string) => void = (line) => console.log(line)): Logger {
  const write = (level: string, event: string, fields?: LogFields) =>
    sink(JSON.stringify({ level, event, requestId, ts: new Date().toISOString(), ...sanitise(fields) }));
  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
