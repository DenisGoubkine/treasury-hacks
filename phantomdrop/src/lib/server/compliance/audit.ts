import "server-only";

import { createHash } from "node:crypto";

type AuditEvent = {
  at: string;
  type: string;
  actor: "patient" | "platform" | "pharmacy" | "doctor";
  attestationId?: string;
  requestIpHash?: string;
  details: Record<string, string | number | boolean | null>;
};

declare global {
  var __phantomdrop_audit_events: AuditEvent[] | undefined;
}

function getAuditBuffer(): AuditEvent[] {
  if (!global.__phantomdrop_audit_events) {
    global.__phantomdrop_audit_events = [];
  }
  return global.__phantomdrop_audit_events;
}

export function hashIp(ip: string | null, secret: string): string | undefined {
  if (!ip) return undefined;
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex").slice(0, 24);
}

export function writeAuditEvent(event: AuditEvent): void {
  const buffer = getAuditBuffer();
  buffer.unshift(event);
  if (buffer.length > 2000) {
    buffer.length = 2000;
  }
}

export function getRecentAuditEvents(limit = 100): AuditEvent[] {
  return getAuditBuffer().slice(0, Math.max(1, Math.min(limit, 500)));
}

export function resetAuditEvents(): void {
  global.__phantomdrop_audit_events = [];
}
