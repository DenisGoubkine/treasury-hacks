import { NextRequest, NextResponse } from "next/server";

import {
  DoctorFileAttestationRequest,
  DoctorFileAttestationResponse,
} from "@/lib/compliance/types";
import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { verifyDoctorWalletAuth } from "@/lib/server/compliance/doctorAuth";
import { fileDoctorAttestation } from "@/lib/server/compliance/service";

export async function POST(request: NextRequest) {
  const config = getComplianceConfig();
  const monadWallet = request.headers.get("x-doctor-monad-wallet") || "";
  const requestTs = request.headers.get("x-doctor-request-ts") || "";
  const requestNonce = request.headers.get("x-doctor-request-nonce") || "";
  const requestSignature = request.headers.get("x-doctor-request-signature") || "";
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  let body: DoctorFileAttestationRequest;
  try {
    body = (await request.json()) as DoctorFileAttestationRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const auth = verifyDoctorWalletAuth({
    doctorWallet: body.doctorWallet,
    monadWallet,
    action: "file_attestation",
    resource: `${body.requestId}|${body.patientWallet}|${body.medicationCode}`,
    requestTs,
    requestNonce,
    signature: requestSignature,
    requestWindowMs: config.handoffRequestWindowMs,
  });

  if (!auth.ok) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "doctor_attestation_denied",
      actor: "doctor",
      requestIpHash: ipHash,
      details: {
        reason: auth.reason || "unauthorized",
        doctorWallet: body.doctorWallet,
      },
    });

    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = fileDoctorAttestation(body);
  if (!result.attestation) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "doctor_attestation_rejected",
      actor: "doctor",
      requestIpHash: ipHash,
      details: {
        issueCount: result.issues.length,
      },
    });

    const response: DoctorFileAttestationResponse = {
      ok: false,
      issues: result.issues,
    };
    return NextResponse.json(response, { status: 422 });
  }

  writeAuditEvent({
    at: new Date().toISOString(),
    type: "doctor_attestation_filed",
    actor: "doctor",
    attestationId: result.attestation.attestationId,
    requestIpHash: ipHash,
    details: {
      approvalCode: result.attestation.approvalCode,
      medicationCategory: result.attestation.medicationCategory,
      canPurchase: result.attestation.canPurchase,
      monadWalletSigner: auth.signer || monadWallet,
    },
  });

  const response: DoctorFileAttestationResponse = {
    ok: true,
    attestation: result.attestation,
  };

  return NextResponse.json(response, { status: 200 });
}
