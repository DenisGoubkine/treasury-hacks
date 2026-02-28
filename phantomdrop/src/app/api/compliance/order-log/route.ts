import { NextRequest, NextResponse } from "next/server";

import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { DoctorOrderAuditLog, saveDoctorOrderAuditLog } from "@/lib/server/compliance/store";

const WALLET = /^(0x[a-fA-F0-9]{40}|unlink1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+)$/;

export async function POST(request: NextRequest) {
  const config = getComplianceConfig();
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  let body: Partial<DoctorOrderAuditLog>;
  try {
    body = (await request.json()) as Partial<DoctorOrderAuditLog>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const orderId = body.orderId?.trim() || "";
  const doctorWallet = body.doctorWallet?.trim() || "";
  const patientWallet = body.patientWallet?.trim() || "";
  const medicationCategory = body.medicationCategory?.trim() || "";
  const amount = (body.amount || "").toString();
  const dropLocation = body.dropLocation?.trim() || "";
  const status = body.status?.trim() || "funded";
  const createdAt = body.createdAt?.trim() || new Date().toISOString();

  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 422 });
  }
  if (!WALLET.test(doctorWallet)) {
    return NextResponse.json({ ok: false, error: "doctorWallet is invalid" }, { status: 422 });
  }
  if (!WALLET.test(patientWallet)) {
    return NextResponse.json({ ok: false, error: "patientWallet is invalid" }, { status: 422 });
  }
  if (!medicationCategory) {
    return NextResponse.json({ ok: false, error: "medicationCategory is required" }, { status: 422 });
  }
  if (!amount) {
    return NextResponse.json({ ok: false, error: "amount is required" }, { status: 422 });
  }
  if (!dropLocation) {
    return NextResponse.json({ ok: false, error: "dropLocation is required" }, { status: 422 });
  }

  const order: DoctorOrderAuditLog = {
    orderId,
    doctorWallet,
    patientWallet,
    patientWalletHash: body.patientWalletHash?.trim() || undefined,
    medicationCode: body.medicationCode?.trim() || undefined,
    medicationCategory,
    amount,
    dropLocation,
    complianceAttestationId: body.complianceAttestationId?.trim() || undefined,
    complianceApprovalCode: body.complianceApprovalCode?.trim() || undefined,
    status,
    createdAt,
  };

  saveDoctorOrderAuditLog(order);

  writeAuditEvent({
    at: new Date().toISOString(),
    type: "doctor_order_logged",
    actor: "platform",
    requestIpHash: ipHash,
    attestationId: order.complianceAttestationId,
    details: {
      orderId: order.orderId,
      doctorWallet: order.doctorWallet,
      patientWallet: order.patientWallet,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
