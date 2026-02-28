import { NextRequest, NextResponse } from "next/server";

import { ComplianceAttestResponse, ComplianceIntakeRequest } from "@/lib/compliance/types";
import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { issueComplianceAttestation } from "@/lib/server/compliance/service";

export async function POST(request: NextRequest) {
  const config = getComplianceConfig();
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  let body: ComplianceIntakeRequest;
  try {
    body = (await request.json()) as ComplianceIntakeRequest;
  } catch {
    const response: ComplianceAttestResponse = {
      ok: false,
      error: "Invalid JSON payload",
    };
    return NextResponse.json(response, { status: 400 });
  }

  const result = issueComplianceAttestation(body);
  if (!result.attestation) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "compliance_attest_failed",
      actor: "patient",
      requestIpHash: ipHash,
      details: {
        issueCount: result.issues.length,
      },
    });

    const response: ComplianceAttestResponse = {
      ok: false,
      issues: result.issues,
    };
    return NextResponse.json(response, { status: 422 });
  }

  writeAuditEvent({
    at: new Date().toISOString(),
    type: "compliance_attest_issued",
    actor: "platform",
    attestationId: result.attestation.attestationId,
    requestIpHash: ipHash,
    details: {
      status: result.attestation.status,
      validationVersion: result.attestation.validationVersion,
    },
  });

  const response: ComplianceAttestResponse = {
    ok: true,
    attestation: result.attestation,
  };

  return NextResponse.json(response, { status: 200 });
}
