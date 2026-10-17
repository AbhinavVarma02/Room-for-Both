const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 256 bits of randomness, URL-safe. Used for bearer tokens and unguessable record IDs. */
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** Constant-time comparison of two equal-length hex digests. */
export function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function bearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * The part of an address one client controls. An IPv6 subscriber usually holds a whole /64 and can
 * rotate through it freely, so limits keyed on the full address would be trivial to sidestep.
 */
export function limitSubject(address: string | null | undefined): string {
  if (!address) return "unknown";
  const a = address.trim().toLowerCase();
  if (!a.includes(":")) return a;
  const [head = "", tail = ""] = a.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = a.includes("::") ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/**
 * Rate-limit identity: a hash of the client's address (its /64 for IPv6) and the UTC day. The salt
 * rotates the value daily, so counters cannot be joined across days and the raw address is never stored.
 */
export async function clientKey(address: string | null | undefined, salt: string | undefined, now: number): Promise<string> {
  const day = new Date(now).toISOString().slice(0, 10);
  const hex = await sha256Hex(`${salt ?? "room-for-both"}|${day}|${limitSubject(address)}`);
  return hex.slice(0, 32);
}
