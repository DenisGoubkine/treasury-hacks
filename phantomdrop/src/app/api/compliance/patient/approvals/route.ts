import { NextRequest, NextResponse } from "next/server";

import { PatientApprovedMedicationsResponse } from "@/lib/compliance/types";
import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { verifyPatientWorkspaceAuth } from "@/lib/server/compliance/patientWorkspaceAuth";
import { getPatientApprovedMedications } from "@/lib/server/compliance/service";

export async function GET(request: NextRequest) {
  const config = getComplianceConfig();
  hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  const patientWallet = request.nextUrl.searchParams.get("patientWallet")?.trim() || "";
  if (!patientWallet) {
    return NextResponse.json({ ok: false, error: "patientWallet query param required" }, { status: 400 });
  }

  const approvals = getPatientApprovedMedications(patientWallet);
  const response: PatientApprovedMedicationsResponse = {
    ok: true,
    patientWallet,
    approvals,
  };

  return NextResponse.json(response, { status: 200 });
}

export async function POST(request: NextRequest) {
  const config = getComplianceConfig();
  const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

  let body: {
    patientWallet: string;
    walletProof: {
      version: string;
      monadWallet: string;
      action: string;
      resource: string;
      requestTs: string;
      requestNonce: string;
      signature: string;
    };
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const patientWallet = body.patientWallet?.trim() || "";
  if (!patientWallet) {
    return NextResponse.json({ ok: false, error: "patientWallet is required" }, { status: 400 });
  }

  const auth = verifyPatientWorkspaceAuth({
    patientWallet,
    walletProof: body.walletProof,
    requestWindowMs: config.handoffRequestWindowMs,
  });
  if (!auth.ok) {
    writeAuditEvent({
      at: new Date().toISOString(),
      type: "patient_workspace_denied",
      actor: "patient",
      requestIpHash: ipHash,
      details: {
        patientWallet,
        reason: auth.reason || "unauthorized",
      },
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const approvals = getPatientApprovedMedications(patientWallet);
  const response: PatientApprovedMedicationsResponse = {
    ok: true,
    patientWallet,
    approvals,
  };

  return NextResponse.json(response, { status: 200 });
}
