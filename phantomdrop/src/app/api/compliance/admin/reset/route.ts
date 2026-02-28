import { NextRequest, NextResponse } from "next/server";

import { resetAuditEvents, writeAuditEvent, hashIp } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { resetNonceCache } from "@/lib/server/compliance/nonce";
import { resetComplianceStore } from "@/lib/server/compliance/store";

export async function POST(request: NextRequest) {
  const config = getComplianceConfig();
  const key = request.headers.get("x-compliance-admin-key") || "";
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  if (!key || key !== config.adminApiKey) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "compliance_reset_denied",
      actor: "platform",
      requestIpHash: ipHash,
      details: {
        reason: "bad_admin_key",
      },
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  resetComplianceStore();
  resetNonceCache();
  resetAuditEvents();

  writeAuditEvent({
    at: new Date().toISOString(),
    type: "compliance_reset_executed",
    actor: "platform",
    requestIpHash: ipHash,
    details: {
      scope: "server-compliance-store+nonce+audit",
    },
  });

  return NextResponse.json(
    {
      ok: true,
      resetAt: new Date().toISOString(),
    },
    { status: 200 }
  );
}
