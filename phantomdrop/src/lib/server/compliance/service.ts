import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { MONAD_FINALITY_MS } from "@/lib/constants";
import {
  ComplianceAttestation,
  ComplianceIntakeRequest,
  DoctorConfirmAttestationResponse,
  DoctorFileAttestationRequest,
  DoctorFiledAttestation,
  DoctorRegisterPatientRecord,
  DoctorRegisterPatientRequest,
  PatientApprovedMedication,
  PatientDoctorApprovalRequest,
  PatientDoctorApprovalRequestRecord,
  PharmacyHandoffResponse,
} from "@/lib/compliance/types";
import { getMedicationByCode } from "@/lib/compliance/medications";
import { getComplianceConfig } from "@/lib/server/compliance/config";
import { decryptJson, encryptJson, signPayload, tokenize } from "@/lib/server/compliance/crypto";
import {
  validateComplianceIntake,
  validateDoctorFileAttestationInput,
  validateDoctorRegisterPatientInput,
  validatePatientDoctorApprovalRequestInput,
} from "@/lib/server/compliance/policy";
import {
  getComplianceRecord,
  getDoctorApprovalRequest,
  getDoctorApprovalRequestsByDoctor,
  getDoctorAttestationRecord,
  getDoctorAttestationRecordByAttestationId,
  getDoctorAttestationRecordsByPatient,
  getDoctorVerifiedPatient,
  saveComplianceRecord,
  saveDoctorApprovalRequest,
  saveDoctorAttestationRecord,
  saveDoctorVerifiedPatient,
} from "@/lib/server/compliance/store";

interface PhiPayload {
  patientFullName: string;
  patientDob: string;
  patientState: string;
  doctorNpi: string;
  doctorDea?: string;
  prescriptionId: string;
  medicationCategory: string;
  controlledSchedule: ComplianceIntakeRequest["controlledSchedule"];
  quantity: number;
  pickupWindowIso: string;
}

interface DoctorPrescriptionPayload {
  requestId: string;
  prescriptionHash: string;
  doctorNpi: string;
  doctorDea?: string;
  patientWallet: string;
  doctorWallet: string;
  medicationCode: string;
  medicationCategory: string;
  controlledSchedule: ComplianceIntakeRequest["controlledSchedule"];
  quantity: number;
}

function buildApprovalCode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `DOC-${ts}-${rand}`;
}

function buildRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "")}`;
}

function normalizeLegalIdentity(input: {
  legalName: string;
  dob: string;
  patientState: string;
  healthCardNumber: string;
}): string {
  return [
    input.legalName.trim().toUpperCase(),
    input.dob.trim(),
    input.patientState.trim().toUpperCase(),
    input.healthCardNumber.trim().toUpperCase().replace(/\s+/g, ""),
  ].join("|");
}

function legalIdentityHash(input: {
  legalName: string;
  dob: string;
  patientState: string;
  healthCardNumber: string;
}): string {
  return createHash("sha256").update(normalizeLegalIdentity(input)).digest("hex");
}

function buildChainAnchor(seed: string, secret: string) {
  const anchoredAt = new Date().toISOString();
  const anchorHash = createHash("sha256").update(`${seed}|${secret}`).digest("hex");
  const anchorTxHash = `0x${createHash("sha256").update(`monad:${seed}:${anchoredAt}`).digest("hex")}`;

  return {
    network: "monad-testnet" as const,
    anchorHash,
    anchorTxHash,
    finalityMs: MONAD_FINALITY_MS,
    anchoredAt,
  };
}

export function issueComplianceAttestation(input: ComplianceIntakeRequest): {
  attestation?: ComplianceAttestation;
  issues: ReturnType<typeof validateComplianceIntake>;
} {
  const issues = validateComplianceIntake(input);
  if (issues.length > 0) {
    return { issues };
  }

  const config = getComplianceConfig();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + config.attestationTtlHours * 60 * 60 * 1000);

  const attestation: ComplianceAttestation = {
    attestationId: `att_${randomUUID().replace(/-/g, "")}`,
    status: "validated",
    validationVersion: "v1.0.0",
    patientToken: tokenize(
      `${input.patientFullName}|${input.patientDob}|${input.patientWallet}`,
      config.attestationSecret,
      "ptok"
    ),
    doctorToken: tokenize(
      `${input.doctorNpi}|${input.doctorDea || ""}|${input.patientWallet}`,
      config.attestationSecret,
      "dtok"
    ),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    signature: "",
  };

  attestation.signature = signPayload(
    {
      attestationId: attestation.attestationId,
      status: attestation.status,
      validationVersion: attestation.validationVersion,
      patientToken: attestation.patientToken,
      doctorToken: attestation.doctorToken,
      issuedAt: attestation.issuedAt,
      expiresAt: attestation.expiresAt,
    },
    config.attestationSecret
  );

  const phiPayload: PhiPayload = {
    patientFullName: input.patientFullName,
    patientDob: input.patientDob,
    patientState: input.patientState.toUpperCase(),
    doctorNpi: input.doctorNpi,
    doctorDea: input.doctorDea?.toUpperCase(),
    prescriptionId: input.prescriptionId,
    medicationCategory: input.medicationCategory,
    controlledSchedule: input.controlledSchedule,
    quantity: input.quantity,
    pickupWindowIso: input.pickupWindowIso,
  };

  saveComplianceRecord({
    attestation,
    intake: {
      ...input,
      patientState: input.patientState.toUpperCase(),
      doctorDea: input.doctorDea?.toUpperCase(),
    },
    encryptedPhi: encryptJson(phiPayload, config.encryptionSecret),
    createdAt: Date.now(),
  });

  return { attestation, issues: [] };
}

export function registerDoctorVerifiedPatient(input: DoctorRegisterPatientRequest): {
  record?: DoctorRegisterPatientRecord;
  issues: ReturnType<typeof validateDoctorRegisterPatientInput>;
} {
  const issues = validateDoctorRegisterPatientInput(input);
  if (issues.length > 0) {
    return { issues };
  }

  const config = getComplianceConfig();
  const verifiedAt = new Date().toISOString();

  const record: DoctorRegisterPatientRecord = {
    registryId: `reg_${randomUUID().replace(/-/g, "")}`,
    doctorWallet: input.doctorWallet,
    patientWallet: input.patientWallet,
    registryRelayId: input.registryRelayId,
    patientToken: tokenize(`${input.patientWallet}|${input.legalName}|${input.dob}`, config.attestationSecret, "ptok"),
    legalIdentityHash: legalIdentityHash(input),
    verifiedAt,
    signature: "",
  };

  record.signature = signPayload(
    {
      registryId: record.registryId,
      doctorWallet: record.doctorWallet,
      patientWallet: record.patientWallet,
      registryRelayId: record.registryRelayId,
      patientToken: record.patientToken,
      legalIdentityHash: record.legalIdentityHash,
      verifiedAt: record.verifiedAt,
    },
    config.attestationSecret
  );

  saveDoctorVerifiedPatient(record);
  return { record, issues: [] };
}

export function createDoctorApprovalRequest(input: PatientDoctorApprovalRequest): {
  request?: PatientDoctorApprovalRequestRecord;
  issues: ReturnType<typeof validatePatientDoctorApprovalRequestInput>;
} {
  const issues = validatePatientDoctorApprovalRequestInput(input);
  if (issues.length > 0) {
    return { issues };
  }

  const config = getComplianceConfig();
  const medication = getMedicationByCode(input.medicationCode);
  if (!medication) {
    return {
      issues: [
        {
          field: "medicationCode",
          code: "INVALID_MEDICATION_CODE",
          message: "Selected medication is not in the approved catalog.",
        },
      ],
    };
  }
  const hash = legalIdentityHash(input);
  const registry = getDoctorVerifiedPatient(input.doctorWallet, input.patientWallet);
  const verificationStatus =
    registry && registry.record.legalIdentityHash === hash
      ? "registry_verified"
      : "needs_manual_review";

  const request: PatientDoctorApprovalRequestRecord = {
    requestId: buildRequestId(),
    doctorWallet: input.doctorWallet,
    patientWallet: input.patientWallet,
    patientToken: tokenize(`${input.patientWallet}|${input.requestRelayId}`, config.attestationSecret, "ptok"),
    legalIdentityHash: hash,
    medicationCode: medication.code,
    medicationCategory: medication.label,
    requestRelayId: input.requestRelayId,
    relayStatus: "submitted",
    verificationStatus,
    walletProof: {
      monadWallet: input.walletProof.monadWallet,
      requestTs: input.walletProof.requestTs,
      requestNonce: input.walletProof.requestNonce,
      signature: input.walletProof.signature,
      signerVerified: true,
    },
    createdAt: new Date().toISOString(),
  };

  saveDoctorApprovalRequest(request);
  return { request, issues: [] };
}

export function getDoctorApprovalRequestsForDoctor(doctorWallet: string): PatientDoctorApprovalRequestRecord[] {
  return getDoctorApprovalRequestsByDoctor(doctorWallet).map((record) => record.request);
}

export function fileDoctorAttestation(input: DoctorFileAttestationRequest): {
  attestation?: DoctorFiledAttestation;
  issues: ReturnType<typeof validateDoctorFileAttestationInput>;
} {
  const issues = validateDoctorFileAttestationInput(input);

  const inputRequestId = input.requestId?.trim() || "";
  const requestRecord = inputRequestId ? getDoctorApprovalRequest(inputRequestId) : undefined;
  if (inputRequestId) {
    if (!requestRecord) {
      issues.push({
        field: "requestId",
        code: "REQUEST_NOT_FOUND",
        message: "Doctor request was not found.",
      });
    } else {
      if (requestRecord.request.doctorWallet !== input.doctorWallet) {
        issues.push({
          field: "doctorWallet",
          code: "REQUEST_DOCTOR_MISMATCH",
          message: "Request is not assigned to this doctor wallet.",
        });
      }
      if (requestRecord.request.patientWallet !== input.patientWallet) {
        issues.push({
          field: "patientWallet",
          code: "REQUEST_PATIENT_MISMATCH",
          message: "Request is not linked to this patient wallet.",
        });
      }
      if (requestRecord.request.verificationStatus !== "registry_verified") {
        issues.push({
          field: "requestId",
          code: "REQUEST_NOT_VERIFIED",
          message: "Patient legal identity is not registry-verified for this request.",
        });
      }
      if (requestRecord.request.medicationCode !== input.medicationCode) {
        issues.push({
          field: "medicationCode",
          code: "REQUEST_MEDICATION_MISMATCH",
          message: "Attestation medication must match the medication requested by the patient.",
        });
      }
    }
  } else {
    const registry = getDoctorVerifiedPatient(input.doctorWallet, input.patientWallet);
    if (!registry) {
      issues.push({
        field: "requestId",
        code: "MISSING_REQUEST_OR_VERIFIED_LINK",
        message:
          "No patient request provided. Register this patient in Step 1 first, or file using a request ID.",
      });
    }
  }

  if (issues.length > 0) {
    return { issues };
  }

  const resolvedRequestId =
    inputRequestId || `manual_${randomUUID().replace(/-/g, "").slice(0, 18)}`;

  const config = getComplianceConfig();
  const issuedAt = new Date().toISOString();
  const attestationId = `att_${randomUUID().replace(/-/g, "")}`;
  const approvalCode = buildApprovalCode();
  const medication = getMedicationByCode(input.medicationCode);
  if (!medication) {
    return {
      issues: [
        {
          field: "medicationCode",
          code: "INVALID_MEDICATION_CODE",
          message: "Selected medication is not in the approved catalog.",
        },
      ],
    };
  }
  const prescriptionHash = createHash("sha256")
    .update(
      `${resolvedRequestId}|${input.patientWallet}|${input.doctorWallet}|${input.medicationCode}|${input.quantity}|${input.doctorNpi}`
    )
    .digest("hex");

  const patientToken = tokenize(
    `${input.patientWallet}|${input.medicationCode}|${resolvedRequestId}`,
    config.attestationSecret,
    "ptok"
  );
  const doctorToken = tokenize(
    `${input.doctorWallet}|${input.doctorNpi}|${input.doctorDea || ""}`,
    config.attestationSecret,
    "dtok"
  );

  const chainAnchor = buildChainAnchor(
    `${attestationId}|${input.patientWallet}|${input.medicationCode}|${input.quantity}|${resolvedRequestId}`,
    config.attestationSecret
  );

  const attestation: DoctorFiledAttestation = {
    approvalCode,
    attestationId,
    requestId: resolvedRequestId,
    doctorWallet: input.doctorWallet,
    patientWallet: input.patientWallet,
    patientToken,
    doctorToken,
    medicationCode: input.medicationCode,
    medicationCategory: medication.label,
    prescriptionHash,
    controlledSchedule: input.controlledSchedule,
    quantity: input.quantity,
    canPurchase: input.canPurchase,
    issuedAt,
    validUntilIso: new Date(input.validUntilIso).toISOString(),
    chainAnchor,
    signature: "",
  };

  attestation.signature = signPayload(
    {
      approvalCode: attestation.approvalCode,
      attestationId: attestation.attestationId,
      requestId: attestation.requestId,
      patientToken: attestation.patientToken,
      doctorToken: attestation.doctorToken,
      medicationCode: attestation.medicationCode,
      medicationCategory: attestation.medicationCategory,
      prescriptionHash: attestation.prescriptionHash,
      controlledSchedule: attestation.controlledSchedule,
      quantity: attestation.quantity,
      canPurchase: attestation.canPurchase,
      validUntilIso: attestation.validUntilIso,
      chainAnchor: attestation.chainAnchor,
    },
    config.attestationSecret
  );

  const encryptedPrescription = encryptJson(
    {
      requestId: resolvedRequestId,
      prescriptionHash,
      doctorNpi: input.doctorNpi,
      doctorDea: input.doctorDea,
      patientWallet: input.patientWallet,
      doctorWallet: input.doctorWallet,
      medicationCode: input.medicationCode,
      medicationCategory: medication.label,
      controlledSchedule: input.controlledSchedule,
      quantity: input.quantity,
    } satisfies DoctorPrescriptionPayload,
    config.encryptionSecret
  );

  saveDoctorAttestationRecord({
    attestation,
    encryptedPrescription,
    createdAt: Date.now(),
  });

  return { attestation, issues: [] };
}

export function confirmDoctorAttestation(
  approvalCode: string,
  patientWallet: string
): DoctorConfirmAttestationResponse {
  const record = getDoctorAttestationRecord(approvalCode);
  if (!record) {
    return { ok: false, error: "Approval code was not found. Ask your doctor to re-issue." };
  }

  if (record.attestation.patientWallet !== patientWallet) {
    return { ok: false, error: "This approval code is not linked to your connected wallet." };
  }

  if (!record.attestation.canPurchase) {
    return { ok: false, error: "Doctor marked this prescription as not eligible for purchase." };
  }

  const expiresAtMs = Date.parse(record.attestation.validUntilIso);
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { ok: false, error: "This approval code has expired. Ask your doctor for a new one." };
  }

  const attestation: ComplianceAttestation = {
    attestationId: record.attestation.attestationId,
    status: "validated",
    validationVersion: "doctor-filed-v2",
    patientToken: record.attestation.patientToken,
    doctorToken: record.attestation.doctorToken,
    issuedAt: record.attestation.issuedAt,
    expiresAt: record.attestation.validUntilIso,
    signature: record.attestation.signature,
  };

  return {
    ok: true,
    attestation,
    orderPolicy: {
      medicationCode: record.attestation.medicationCode,
      medicationCategory: record.attestation.medicationCategory,
      controlledSchedule: record.attestation.controlledSchedule,
      quantity: record.attestation.quantity,
      prescriptionHash: record.attestation.prescriptionHash,
    },
  };
}

export function getPatientApprovedMedications(patientWallet: string): PatientApprovedMedication[] {
  const now = Date.now();
  return getDoctorAttestationRecordsByPatient(patientWallet)
    .map((record) => record.attestation)
    .filter((attestation) => {
      if (!attestation.canPurchase) return false;
      const expiry = Date.parse(attestation.validUntilIso);
      if (Number.isNaN(expiry) || expiry <= now) return false;
      return true;
    })
    .map((attestation) => ({
      approvalCode: attestation.approvalCode,
      attestationId: attestation.attestationId,
      doctorWallet: attestation.doctorWallet,
      medicationCode: attestation.medicationCode,
      medicationCategory: attestation.medicationCategory,
      controlledSchedule: attestation.controlledSchedule,
      quantity: attestation.quantity,
      validUntilIso: attestation.validUntilIso,
      patientToken: attestation.patientToken,
      doctorToken: attestation.doctorToken,
      signature: attestation.signature,
    }));
}

export function buildPharmacyHandoff(attestationId: string): PharmacyHandoffResponse {
  const record = getComplianceRecord(attestationId);
  const config = getComplianceConfig();

  if (record) {
    const now = Date.now();
    const expiresAtMs = Date.parse(record.attestation.expiresAt);
    const status: PharmacyHandoffResponse["attestationStatus"] =
      Number.isNaN(expiresAtMs) || expiresAtMs < now ? "expired" : "validated";

    const phi = decryptJson<PhiPayload>(record.encryptedPhi, config.encryptionSecret);

    const payload = {
      ok: true as const,
      attestationId: record.attestation.attestationId,
      attestationStatus: status,
      issuedAt: record.attestation.issuedAt,
      expiresAt: record.attestation.expiresAt,
      prescription: {
        prescriptionId: phi.prescriptionId,
        medicationCode: "legacy_manual",
        prescriptionHash: createHash("sha256").update(phi.prescriptionId).digest("hex"),
        medicationCategory: phi.medicationCategory,
        controlledSchedule: phi.controlledSchedule,
        quantity: phi.quantity,
        pickupWindowIso: phi.pickupWindowIso,
      },
      patient: {
        token: record.attestation.patientToken,
        wallet: record.intake.patientWallet,
        legalVerificationStatus: "manual_review" as const,
        fullName: phi.patientFullName,
        dob: phi.patientDob,
        state: phi.patientState,
      },
      doctor: {
        token: record.attestation.doctorToken,
        wallet: "unlink1redacted",
        providerVerificationStatus: "npi_validated" as const,
        npi: phi.doctorNpi,
        dea: phi.doctorDea,
      },
      signature: "",
    };

    payload.signature = signPayload(
      {
        attestationId: payload.attestationId,
        attestationStatus: payload.attestationStatus,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        prescription: payload.prescription,
        patient: payload.patient,
        doctor: payload.doctor,
      },
      config.attestationSecret
    );

    return payload;
  }

  const doctorRecord =
    getDoctorAttestationRecordByAttestationId(attestationId) || getDoctorAttestationRecord(attestationId);

  if (!doctorRecord) {
    throw new Error("Attestation not found");
  }

  const now = Date.now();
  const expiresAtMs = Date.parse(doctorRecord.attestation.validUntilIso);
  const status: PharmacyHandoffResponse["attestationStatus"] =
    Number.isNaN(expiresAtMs) || expiresAtMs < now ? "expired" : "validated";

  const docPayload = decryptJson<DoctorPrescriptionPayload>(
    doctorRecord.encryptedPrescription,
    config.encryptionSecret
  );
  const requestRecord = getDoctorApprovalRequest(doctorRecord.attestation.requestId);

  const payload = {
    ok: true as const,
    attestationId: doctorRecord.attestation.attestationId,
    attestationStatus: status,
    issuedAt: doctorRecord.attestation.issuedAt,
    expiresAt: doctorRecord.attestation.validUntilIso,
    prescription: {
      prescriptionId: docPayload.prescriptionHash,
      medicationCode: docPayload.medicationCode,
      prescriptionHash: docPayload.prescriptionHash,
      medicationCategory: docPayload.medicationCategory,
      controlledSchedule: docPayload.controlledSchedule,
      quantity: docPayload.quantity,
      pickupWindowIso: doctorRecord.attestation.validUntilIso,
    },
    patient: {
      token: doctorRecord.attestation.patientToken,
      wallet: doctorRecord.attestation.patientWallet,
      legalVerificationStatus:
        requestRecord?.request.verificationStatus === "registry_verified"
          ? ("registry_verified" as const)
          : ("manual_review" as const),
      legalIdentityHash: requestRecord?.request.legalIdentityHash,
    },
    doctor: {
      token: doctorRecord.attestation.doctorToken,
      wallet: doctorRecord.attestation.doctorWallet,
      providerVerificationStatus: "npi_validated" as const,
      npi: docPayload.doctorNpi,
      dea: docPayload.doctorDea,
    },
    signature: "",
  };

  payload.signature = signPayload(
    {
      attestationId: payload.attestationId,
      attestationStatus: payload.attestationStatus,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      prescription: payload.prescription,
      patient: payload.patient,
      doctor: payload.doctor,
    },
    config.attestationSecret
  );

  return payload;
}
