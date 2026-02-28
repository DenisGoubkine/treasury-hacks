import { NextRequest, NextResponse } from "next/server";

import { getComplianceConfig } from "@/lib/server/compliance/config";
import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import {
  getDoctorAttestationRecordsByDoctor,
  getDoctorOrderAuditLogsByDoctor,
  getDoctorVerifiedPatientsByDoctor,
} from "@/lib/server/compliance/store";

export async function GET(request: NextRequest) {
  const config = getComplianceConfig();
  const key = request.headers.get("x-compliance-admin-key") || "";
  const doctorWallet = request.nextUrl.searchParams.get("doctorWallet")?.trim() || "";
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  if (!key || key !== config.adminApiKey) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "doctor_audit_denied",
      actor: "platform",
      requestIpHash: ipHash,
      details: {
        reason: "bad_admin_key",
      },
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!doctorWallet) {
    return NextResponse.json(
      { ok: false, error: "doctorWallet query param required" },
      { status: 400 }
    );
  }

  const prescriptions = getDoctorAttestationRecordsByDoctor(doctorWallet).map((entry) => entry.attestation);
  const orders = getDoctorOrderAuditLogsByDoctor(doctorWallet).map((entry) => entry.order);
  const verifiedPatients = getDoctorVerifiedPatientsByDoctor(doctorWallet).map((entry) => entry.record);
  const patientNameByWallet = new Map<string, string>();
  for (const patient of verifiedPatients) {
    if (patient.patientLegalName?.trim()) {
      patientNameByWallet.set(patient.patientWallet.trim().toLowerCase(), patient.patientLegalName.trim());
    }
  }
  const doctorName = verifiedPatients.find((record) => record.doctorName?.trim())?.doctorName?.trim();
  const patientSet = new Set<string>();
  for (const rx of prescriptions) {
    patientSet.add(rx.patientWallet);
  }
  for (const order of orders) {
    patientSet.add(order.patientWallet);
  }

  writeAuditEvent({
    at: new Date().toISOString(),
    type: "doctor_audit_served",
    actor: "platform",
    requestIpHash: ipHash,
    details: {
      doctorWallet,
      prescriptionCount: prescriptions.length,
      orderCount: orders.length,
      patientCount: patientSet.size,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      doctorWallet,
      doctorName,
      summary: {
        prescriptionCount: prescriptions.length,
        orderCount: orders.length,
        patientCount: patientSet.size,
      },
      prescriptions: prescriptions.map((rx) => ({
        approvalCode: rx.approvalCode,
        attestationId: rx.attestationId,
        patientWallet: rx.patientWallet,
        patientName: patientNameByWallet.get(rx.patientWallet.trim().toLowerCase()) || null,
        medicationCode: rx.medicationCode,
        medicationCategory: rx.medicationCategory,
        quantity: rx.quantity,
        canPurchase: rx.canPurchase,
        issuedAt: rx.issuedAt,
        validUntilIso: rx.validUntilIso,
      })),
      orders: orders.map((order) => ({
        ...order,
        patientName: patientNameByWallet.get(order.patientWallet.trim().toLowerCase()) || null,
      })),
    },
    { status: 200 }
  );
}
