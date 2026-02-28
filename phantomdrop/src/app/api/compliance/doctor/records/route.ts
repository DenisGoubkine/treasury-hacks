import { NextRequest, NextResponse } from "next/server";

import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { verifyDoctorWalletAuth } from "@/lib/server/compliance/doctorAuth";
import { getDoctorApprovalRequestsForDoctor } from "@/lib/server/compliance/service";
import { getDoctorAttestationRecordsByDoctor } from "@/lib/server/compliance/store";

export async function GET(request: NextRequest) {
  const config = getComplianceConfig();
  const monadWallet = request.headers.get("x-doctor-monad-wallet") || "";
  const requestTs = request.headers.get("x-doctor-request-ts") || "";
  const requestNonce = request.headers.get("x-doctor-request-nonce") || "";
  const requestSignature = request.headers.get("x-doctor-request-signature") || "";
  const doctorWallet = request.nextUrl.searchParams.get("doctorWallet") || "";
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  if (!doctorWallet) {
    return NextResponse.json({ ok: false, error: "doctorWallet query param required" }, { status: 400 });
  }

  const auth = verifyDoctorWalletAuth({
    doctorWallet,
    monadWallet,
    action: "list_records",
    resource: "doctor_workspace",
    requestTs,
    requestNonce,
    signature: requestSignature,
    requestWindowMs: config.handoffRequestWindowMs,
  });

  if (!auth.ok) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "doctor_records_denied",
      actor: "doctor",
      requestIpHash: ipHash,
      details: {
        reason: auth.reason || "unauthorized",
        doctorWallet,
      },
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const records = getDoctorAttestationRecordsByDoctor(doctorWallet).slice(0, 50);
  const requests = getDoctorApprovalRequestsForDoctor(doctorWallet).slice(0, 100);

  return NextResponse.json(
    {
      ok: true,
      records: records.map((record) => record.attestation),
      requests,
    },
    { status: 200 }
  );
}
