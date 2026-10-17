import type { Party, ProvenanceKind } from "../schemas/common";
import type { GuestProfile, HostProfile } from "../schemas/profiles";
import type { InputUse, ProfileField } from "./types";

export function guestProvenance(guest: GuestProfile, value: unknown): ProvenanceKind {
  if (value === null || value === undefined) return "unknown";
  return guest.origin;
}

export function hostProvenance(host: HostProfile, value: unknown): ProvenanceKind {
  if (value === null || value === undefined) return "unknown";
  return host.source === "fictional_example" || host.source === "hypothetical_scenario" ? "synthetic_demo" : "party_supplied";
}

export function guestInput<K extends keyof GuestProfile & ProfileField>(guest: GuestProfile, field: K): InputUse {
  const value = guest[field];
  return { party: "guest", field, value, provenance: guestProvenance(guest, value) };
}

export function hostInput<K extends keyof HostProfile & ProfileField>(host: HostProfile, field: K): InputUse {
  const value = host[field];
  return { party: "host", field, value, provenance: hostProvenance(host, value) };
}

export function partyLabel(party: Party): string {
  return party === "guest" ? "Guest" : "Host";
}
