import { NextRequest, NextResponse } from "next/server";

import {
  PatientDoctorApprovalRequest,
  PatientDoctorApprovalRequestResponse,
} from "@/lib/compliance/types";
import { buildPatientDoctorWalletProofMessage } from "@/lib/compliance/walletProof";
import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { consumeNonce } from "@/lib/server/compliance/nonce";
import { createDoctorApprovalRequest } from "@/lib/server/compliance/service";
import { getAddress, verifyMessage } from "ethers";

function verifyWalletProof(
  body: PatientDoctorApprovalRequest,
  requestWindowMs: number
): {
  ok: boolean;
  reason?: string;
  signerAddress?: string;
} {
  if (!body.walletProof || typeof body.walletProof !== "object") {
    return { ok: false, reason: "missing_wallet_proof" };
  }

  if (!body.walletProof.requestTs || !body.walletProof.requestNonce || !body.walletProof.signature) {
    return { ok: false, reason: "incomplete_wallet_proof" };
  }

  const now = Date.now();
  const proofTs = Number(body.walletProof.requestTs);
  const isTsValid = Number.isFinite(proofTs);
  const isFresh = isTsValid && Math.abs(now - proofTs) <= requestWindowMs;
  if (!isFresh) {
    return { ok: false, reason: "expired_or_invalid_wallet_proof_ts" };
  }

  const nonce = body.walletProof.requestNonce.trim();
  const nonceOk = nonce.length >= 12 && consumeNonce(`patient-proof:${nonce}`, now, requestWindowMs);
  if (!nonceOk) {
    return { ok: false, reason: "replay_or_bad_wallet_proof_nonce" };
  }

  try {
    const expectedMessage = buildPatientDoctorWalletProofMessage({
      patientWallet: body.patientWallet,
      doctorWallet: body.doctorWallet,
      medicationCode: body.medicationCode,
      requestRelayId: body.requestRelayId,
      legalName: body.legalName,
      dob: body.dob,
      patientState: body.patientState,
      healthCardNumber: body.healthCardNumber,
      monadWallet: body.walletProof.monadWallet,
      requestTs: body.walletProof.requestTs,
      requestNonce: body.walletProof.requestNonce,
    });

    const recovered = getAddress(verifyMessage(expectedMessage, body.walletProof.signature));
    const claimed = getAddress(body.walletProof.monadWallet);
    if (recovered !== claimed) {
      return { ok: false, reason: "wallet_proof_signer_mismatch" };
    }

    return { ok: true, signerAddress: recovered };
  } catch {
    return { ok: false, reason: "wallet_proof_verification_failed" };
  }
}

export async function POST(request: NextRequest) {
  const config = getComplianceConfig();
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  let body: PatientDoctorApprovalRequest;
  try {
    body = (await request.json()) as PatientDoctorApprovalRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const proof = verifyWalletProof(body, config.handoffRequestWindowMs);
  if (!proof.ok) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "patient_doctor_request_denied",
      actor: "patient",
      requestIpHash: ipHash,
      details: {
        reason: proof.reason || "invalid_wallet_proof",
        doctorWallet: body.doctorWallet || null,
        patientWallet: body.patientWallet || null,
        medicationCode: body.medicationCode || null,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Wallet signature verification failed for this doctor request.",
      },
      { status: 401 }
    );
  }

  const result = createDoctorApprovalRequest(body);
  if (!result.request) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "patient_doctor_request_rejected",
      actor: "patient",
      requestIpHash: ipHash,
      details: {
        issueCount: result.issues.length,
      },
    });

    const response: PatientDoctorApprovalRequestResponse = {
      ok: false,
      issues: result.issues,
    };
    return NextResponse.json(response, { status: 422 });
  }

  writeAuditEvent({
    at: new Date().toISOString(),
    type: "patient_doctor_request_submitted",
    actor: "patient",
    requestIpHash: ipHash,
    details: {
      requestId: result.request.requestId,
      doctorWallet: result.request.doctorWallet,
      patientWallet: result.request.patientWallet,
      verificationStatus: result.request.verificationStatus,
      medicationCode: result.request.medicationCode,
      monadWalletSigner: proof.signerAddress || body.walletProof.monadWallet,
    },
  });

  const response: PatientDoctorApprovalRequestResponse = {
    ok: true,
    request: result.request,
  };

  return NextResponse.json(response, { status: 200 });
}
