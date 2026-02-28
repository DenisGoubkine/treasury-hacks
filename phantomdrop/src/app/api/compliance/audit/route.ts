import { NextRequest, NextResponse } from "next/server";

import { getRecentAuditEvents, hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";

export async function GET(request: NextRequest) {
  const config = getComplianceConfig();
  const key = request.headers.get("x-compliance-admin-key") || "";
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  if (!key || key !== config.adminApiKey) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "compliance_audit_denied",
      actor: "platform",
      requestIpHash: ipHash,
      details: {
        reason: "bad_admin_key",
      },
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") || "100");
  const events = getRecentAuditEvents(limit);

  return NextResponse.json(
    {
      ok: true,
      count: events.length,
      events,
    },
    { status: 200 }
  );
}
