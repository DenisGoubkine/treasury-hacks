import { NextRequest, NextResponse } from "next/server";

import {
  DoctorConfirmAttestationRequest,
  DoctorConfirmAttestationResponse,
} from "@/lib/compliance/types";
import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { verifyPatientWalletConfirmAuth } from "@/lib/server/compliance/patientAuth";
import { confirmDoctorAttestation } from "@/lib/server/compliance/service";

export async function POST(request: NextRequest) {
  const config = getComplianceConfig();
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  let body: DoctorConfirmAttestationRequest;
  try {
    body = (await request.json()) as DoctorConfirmAttestationRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const auth = verifyPatientWalletConfirmAuth({
    patientWallet: body.patientWallet,
    approvalCode: body.approvalCode,
    walletProof: body.walletProof,
    requestWindowMs: config.handoffRequestWindowMs,
  });
  if (!auth.ok) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "doctor_attestation_confirm_denied",
      actor: "patient",
      requestIpHash: ipHash,
      details: {
        approvalCode: body.approvalCode,
        reason: auth.reason || "invalid_wallet_auth",
      },
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Wallet signature verification failed for approval confirmation.",
      },
      { status: 401 }
    );
  }

  const result = confirmDoctorAttestation(body.approvalCode, body.patientWallet);
  if (!result.ok) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "doctor_attestation_confirm_failed",
      actor: "patient",
      requestIpHash: ipHash,
      details: {
        approvalCode: body.approvalCode,
        reason: result.error || "unknown",
      },
    });

    const response: DoctorConfirmAttestationResponse = {
      ok: false,
      error: result.error,
    };
    return NextResponse.json(response, { status: 422 });
  }

  writeAuditEvent({
    at: new Date().toISOString(),
    type: "doctor_attestation_confirmed",
    actor: "patient",
    attestationId: result.attestation?.attestationId,
    requestIpHash: ipHash,
    details: {
      approvalCode: body.approvalCode,
      monadWalletSigner: auth.signer || body.walletProof.monadWallet,
    },
  });

  return NextResponse.json(result, { status: 200 });
}
