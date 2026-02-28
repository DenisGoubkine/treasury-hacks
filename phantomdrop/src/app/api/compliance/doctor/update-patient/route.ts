import { NextRequest, NextResponse } from "next/server";

import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { verifyDoctorWalletAuth } from "@/lib/server/compliance/doctorAuth";
import {
  getDoctorVerifiedPatient,
  updateAttestationPatientWallet,
  updateDoctorVerifiedPatientWallet,
} from "@/lib/server/compliance/store";

interface UpdatePatientBody {
  doctorWallet: string;
  oldPatientWallet: string;
  newPatientWallet: string;
}

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export async function PUT(request: NextRequest) {
  const config = getComplianceConfig();
  const monadWallet = request.headers.get("x-doctor-monad-wallet") || "";
  const requestTs = request.headers.get("x-doctor-request-ts") || "";
  const requestNonce = request.headers.get("x-doctor-request-nonce") || "";
  const requestSignature = request.headers.get("x-doctor-request-signature") || "";
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  let body: UpdatePatientBody;
  try {
    body = (await request.json()) as UpdatePatientBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.doctorWallet || !body.oldPatientWallet || !body.newPatientWallet) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  if (!WALLET_RE.test(body.newPatientWallet)) {
    return NextResponse.json({ ok: false, error: "Invalid wallet address format" }, { status: 400 });
  }

  if (body.oldPatientWallet.toLowerCase() === body.newPatientWallet.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "New wallet is the same as the old wallet" }, { status: 400 });
  }

  const auth = verifyDoctorWalletAuth({
    doctorWallet: body.doctorWallet,
    monadWallet,
    action: "update_patient",
    resource: `${body.oldPatientWallet}|${body.newPatientWallet}`,
    requestTs,
    requestNonce,
    signature: requestSignature,
    requestWindowMs: config.handoffRequestWindowMs,
  });

  if (!auth.ok) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "doctor_update_patient_denied",
      actor: "doctor",
      requestIpHash: ipHash,
      details: { reason: auth.reason || "unauthorized", doctorWallet: body.doctorWallet },
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Verify the old patient record exists
  const existing = getDoctorVerifiedPatient(body.doctorWallet, body.oldPatientWallet);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Patient record not found" }, { status: 404 });
  }

  // Update the verified patient wallet
  const updated = updateDoctorVerifiedPatientWallet(
    body.doctorWallet,
    body.oldPatientWallet,
    body.newPatientWallet
  );

  // Also update any attestations referencing the old wallet
  const attestationsUpdated = updateAttestationPatientWallet(
    body.doctorWallet,
    body.oldPatientWallet,
    body.newPatientWallet
  );

  writeAuditEvent({
    at: new Date().toISOString(),
    type: "doctor_update_patient_wallet",
    actor: "doctor",
    requestIpHash: ipHash,
    details: {
      doctorWallet: body.doctorWallet,
      oldPatientWallet: body.oldPatientWallet,
      newPatientWallet: body.newPatientWallet,
      attestationsUpdated,
    },
  });

  return NextResponse.json({
    ok: true,
    record: updated?.record,
    attestationsUpdated,
  });
}
