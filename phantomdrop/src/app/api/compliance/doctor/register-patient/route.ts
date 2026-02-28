import { NextRequest, NextResponse } from "next/server";

import {
  DoctorRegisterPatientRequest,
  DoctorRegisterPatientResponse,
} from "@/lib/compliance/types";
import { hashIp, writeAuditEvent } from "@/lib/server/compliance/audit";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { verifyDoctorWalletAuth } from "@/lib/server/compliance/doctorAuth";
import { registerDoctorVerifiedPatient } from "@/lib/server/compliance/service";

export async function POST(request: NextRequest) {
  try {
    const config = getComplianceConfig();
    const monadWallet = request.headers.get("x-doctor-monad-wallet") || "";
    const requestTs = request.headers.get("x-doctor-request-ts") || "";
    const requestNonce = request.headers.get("x-doctor-request-nonce") || "";
    const requestSignature = request.headers.get("x-doctor-request-signature") || "";
    const ipHash = hashIp(request.headers.get("x-forwarded-for"), config.attestationSecret);

    let body: DoctorRegisterPatientRequest;
    try {
      body = (await request.json()) as DoctorRegisterPatientRequest;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    const auth = verifyDoctorWalletAuth({
      doctorWallet: body.doctorWallet,
      monadWallet,
      action: "register_patient",
      resource: `${body.patientWallet}|${body.dob}|${body.registryRelayId}`,
      requestTs,
      requestNonce,
      signature: requestSignature,
      requestWindowMs: config.handoffRequestWindowMs,
    });

    if (!auth.ok) {
      writeAuditEvent({
        at: new Date().toISOString(),
        type: "doctor_registry_denied",
        actor: "doctor",
        requestIpHash: ipHash,
        details: {
          reason: auth.reason || "unauthorized",
          doctorWallet: body.doctorWallet,
        },
      });

      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = registerDoctorVerifiedPatient(body);
    if (!result.record) {
      writeAuditEvent({
        at: new Date().toISOString(),
        type: "doctor_registry_rejected",
        actor: "doctor",
        requestIpHash: ipHash,
        details: {
          issueCount: result.issues.length,
        },
      });

      const response: DoctorRegisterPatientResponse = {
        ok: false,
        issues: result.issues,
      };
      return NextResponse.json(response, { status: 422 });
    }

    writeAuditEvent({
      at: new Date().toISOString(),
      type: "doctor_registry_verified_patient",
      actor: "doctor",
      requestIpHash: ipHash,
      details: {
        registryId: result.record.registryId,
        doctorWallet: result.record.doctorWallet,
        patientWallet: result.record.patientWallet,
        registryRelayId: result.record.registryRelayId,
        monadWalletSigner: auth.signer || monadWallet,
      },
    });

    const response: DoctorRegisterPatientResponse = {
      ok: true,
      record: result.record,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
