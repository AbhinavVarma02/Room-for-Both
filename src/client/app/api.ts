import { CreateHostRequestResponse, HostRequestView, OwnerRequestView, PublicConfig, type SharedSummary } from "@shared/schemas/api";
import {
  BaselineResult,
  LlmBaselineResult,
  ResearchEvent,
  SensitivityResult,
  VenueBridge,
  type BaselineRequest,
  type LlmBaselineRequest,
  type ResearchRequest,
  type SensitivityRequest,
  type VenueBridgeRequest,
} from "@shared/schemas/evidence";
import { NarrativeResponse, type NarrativeFacts } from "@shared/schemas/narrative";
import type { HostProfile } from "@shared/schemas/profiles";
import type { z } from "zod";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function parseJson(text: string): unknown {
  try {
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

async function call<S extends z.ZodType>(schema: S, path: string, init: RequestInit = {}): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  } catch {
    throw new ApiRequestError(0, "offline", "Could not reach Room for Both. Check your connection and try again.");
  }
  const body = parseJson(await res.text());
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiRequestError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status}).`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiRequestError(res.status, "unexpected_response", "The server sent an unexpected response.");
  return parsed.data;
}

export const getConfig = () => call(PublicConfig, "/api/config");

/** Reads the NDJSON research stream and reports each validated event as it arrives. */
export async function streamResearch(request: ResearchRequest, onEvent: (e: ResearchEvent) => void, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiRequestError(0, "offline", "Could not reach Room for Both. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    let message = `Research could not start (${res.status}).`;
    let code = "http_error";
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      message = body.error?.message ?? message;
      code = body.error?.code ?? code;
    } catch {
      // Keep the generic message.
    }
    throw new ApiRequestError(res.status, code, message);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        const parsed = ResearchEvent.safeParse(JSON.parse(line));
        if (parsed.success) onEvent(parsed.data);
      }
      newline = buffer.indexOf("\n");
    }
    if (done) break;
  }
}

export const createHostLink = (summary: SharedSummary) =>
  call(CreateHostRequestResponse, "/api/host-requests", { method: "POST", body: JSON.stringify({ summary }) });

export const getOwnerView = (requestId: string, ownerToken: string) =>
  call(OwnerRequestView, `/api/host-requests/${encodeURIComponent(requestId)}`, { headers: { Authorization: `Bearer ${ownerToken}` } });

export const revokeHostLink = (requestId: string, ownerToken: string) =>
  fetch(`/api/host-requests/${encodeURIComponent(requestId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${ownerToken}` } });

export const getHostView = (hostToken: string) =>
  call(HostRequestView, "/api/host-requests/respond", { headers: { Authorization: `Bearer ${hostToken}` } });

export async function submitHostResponse(hostToken: string, host: Omit<HostProfile, "source">) {
  const res = await fetch("/api/host-requests/respond", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({ host }),
  });
  const body = (await res.json().catch(() => null)) as { editsRemaining?: number; error?: { code?: string; message?: string } } | null;
  if (!res.ok) throw new ApiRequestError(res.status, body?.error?.code ?? "http_error", body?.error?.message ?? "Could not save your answers.");
  return { editsRemaining: body?.editsRemaining ?? 0 };
}

export const draftNarrative = (facts: NarrativeFacts) =>
  call(NarrativeResponse, "/api/narrative", { method: "POST", body: JSON.stringify({ facts, consent: true }) });

export const runBaseline = (request: BaselineRequest) => call(BaselineResult, "/api/research/baseline", { method: "POST", body: JSON.stringify(request) });

export const fetchVenueBridge = (request: VenueBridgeRequest) => call(VenueBridge, "/api/research/venue-bridge", { method: "POST", body: JSON.stringify(request) });

export const runLlmBaseline = (request: LlmBaselineRequest) => call(LlmBaselineResult, "/api/research/llm-baseline", { method: "POST", body: JSON.stringify(request) });

export const runSensitivity = (request: SensitivityRequest) => call(SensitivityResult, "/api/research/sensitivity", { method: "POST", body: JSON.stringify(request) });
