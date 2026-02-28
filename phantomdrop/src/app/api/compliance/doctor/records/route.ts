import { NextRequest, NextResponse } from "next/server";

import { hashIp } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { getDoctorApprovalRequestsForDoctor } from "@/lib/server/compliance/service";
import {
  getDoctorAttestationRecordsByDoctor,
  getDoctorVerifiedPatientsByDoctor,
} from "@/lib/server/compliance/store";

export async function GET(request: NextRequest) {
  const config = getComplianceConfig();
  const doctorWallet = request.nextUrl.searchParams.get("doctorWallet") || "";
  hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  if (!doctorWallet) {
    return NextResponse.json({ ok: false, error: "doctorWallet query param required" }, { status: 400 });
  }

  const records = getDoctorAttestationRecordsByDoctor(doctorWallet).slice(0, 50);
  const requests = getDoctorApprovalRequestsForDoctor(doctorWallet).slice(0, 100);
  const verifiedPatients = getDoctorVerifiedPatientsByDoctor(doctorWallet).slice(0, 100);

  return NextResponse.json(
    {
      ok: true,
      records: records.map((record) => record.attestation),
      requests,
      verifiedPatients: verifiedPatients.map((record) => record.record),
    },
    { status: 200 }
  );
}
