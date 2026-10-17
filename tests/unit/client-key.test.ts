import { describe, expect, it } from "vitest";
import { clientKey, limitSubject } from "../../src/worker/security/crypto";

describe("rate-limit identity", () => {
  it("keeps IPv4 addresses whole", () => {
    expect(limitSubject("203.0.113.7")).toBe("203.0.113.7");
  });

  it("groups an IPv6 client by its /64, however the address is written", () => {
    const a = limitSubject("2001:db8:aa:bb:1111:2222:3333:4444");
    expect(a).toBe("2001:db8:aa:bb::/64");
    expect(limitSubject("2001:0db8:00aa:00bb::1")).toBe(a);
    expect(limitSubject("2001:DB8:AA:BB:ffff::")).toBe(a);
    expect(limitSubject("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });

  it("gives rotated addresses in one /64 the same key, and other networks a different one", async () => {
    const now = Date.UTC(2026, 0, 1);
    const k1 = await clientKey("2001:db8:aa:bb::1", "salt", now);
    expect(await clientKey("2001:db8:aa:bb:9:8:7:6", "salt", now)).toBe(k1);
    expect(await clientKey("2001:db8:aa:bc::1", "salt", now)).not.toBe(k1);
    expect(await clientKey(null, "salt", now)).toBe(await clientKey(undefined, "salt", now));
  });
});
