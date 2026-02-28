import "server-only";

import {
  ComplianceIntakeRequest,
  ComplianceIssue,
  DoctorRegisterPatientRequest,
  DoctorFileAttestationRequest,
  LegalIdentityInput,
  PatientDoctorApprovalRequest,
} from "@/lib/compliance/types";
import { getMedicationByCode } from "@/lib/compliance/medications";
import {
  PATIENT_DOCTOR_WALLET_PROOF_VERSION,
  isHexEcdsaSignature,
  isHexEvmAddress,
} from "@/lib/compliance/walletProof";

const US_STATE = /^[A-Z]{2}$/;
const DEA = /^[A-Z]{2}\d{7}$/;
const UNLINK_WALLET = /^unlink1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/;
const EVM_WALLET = /^0x[a-fA-F0-9]{40}$/;
const RELAY_ID = /^[a-zA-Z0-9_-]{6,120}$/;
const NONCE = /^[a-zA-Z0-9_-]{12,120}$/;

function isClientWallet(value: string): boolean {
  const normalized = value.trim();
  return UNLINK_WALLET.test(normalized) || EVM_WALLET.test(normalized);
}

function yearsBetween(from: Date, to: Date): number {
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const beforeBirthday =
    to.getUTCMonth() < from.getUTCMonth() ||
    (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate());
  return beforeBirthday ? years - 1 : years;
}

function validateCorePrescriptionFields(input: {
  controlledSchedule: ComplianceIntakeRequest["controlledSchedule"];
  doctorNpi: string;
  doctorDea?: string;
  prescriptionId?: string;
  quantity: number;
  medicationCategory: string;
  requirePrescriptionId?: boolean;
}): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const requirePrescriptionId = input.requirePrescriptionId !== false;

  if (!input.doctorNpi.trim()) {
    issues.push({
      field: "doctorNpi",
      code: "INVALID_NPI",
      message: "Prescriber ID is required.",
    });
  }

  if (input.controlledSchedule !== "non_controlled") {
    if (!input.doctorDea || !DEA.test(input.doctorDea.trim().toUpperCase())) {
      issues.push({
        field: "doctorDea",
        code: "INVALID_DEA",
        message: "For controlled prescriptions, add the prescriber controlled-med ID (DEA).",
      });
    }
  }

  if (requirePrescriptionId && (!input.prescriptionId || input.prescriptionId.trim().length < 6)) {
    issues.push({
      field: "prescriptionId",
      code: "INVALID_RX_ID",
      message: "Please enter a valid prescription number.",
    });
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 365) {
    issues.push({
      field: "quantity",
      code: "INVALID_QUANTITY",
      message: "Quantity must be between 1 and 365.",
    });
  }

  if (!input.medicationCategory.trim()) {
    issues.push({
      field: "medicationCategory",
      code: "MISSING_MEDICATION_CATEGORY",
      message: "Medication category is required.",
    });
  }

  return issues;
}

function validateLegalIdentityFields(input: LegalIdentityInput): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (input.legalName.trim().length < 3) {
    issues.push({
      field: "legalName",
      code: "INVALID_LEGAL_NAME",
      message: "Legal name is required.",
    });
  }

  const dob = new Date(`${input.dob}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime())) {
    issues.push({
      field: "dob",
      code: "INVALID_DOB",
      message: "DOB must be in YYYY-MM-DD format.",
    });
  } else {
    const age = yearsBetween(dob, new Date());
    if (age < 18) {
      issues.push({
        field: "dob",
        code: "UNDERAGE",
        message: "Patient must be at least 18 for this delivery workflow.",
      });
    }
  }

  if (!US_STATE.test(input.patientState.trim().toUpperCase())) {
    issues.push({
      field: "patientState",
      code: "INVALID_STATE",
      message: "State must be a 2-letter code.",
    });
  }

  if (input.healthCardNumber.trim().length < 5) {
    issues.push({
      field: "healthCardNumber",
      code: "INVALID_HEALTH_CARD",
      message: "Health card number appears invalid.",
    });
  }

  return issues;
}

export function validateComplianceIntake(input: ComplianceIntakeRequest): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (!isClientWallet(input.patientWallet)) {
    issues.push({
      field: "patientWallet",
      code: "INVALID_WALLET",
      message: "Use a valid client wallet: unlink1... or 0x...",
    });
  }

  issues.push(
    ...validateLegalIdentityFields({
      legalName: input.patientFullName,
      dob: input.patientDob,
      patientState: input.patientState,
      healthCardNumber: "masked",
    }).map((issue) => {
      if (issue.field === "legalName") return { ...issue, field: "patientFullName" };
      if (issue.field === "dob") return { ...issue, field: "patientDob" };
      return issue;
    })
  );

  issues.push(
    ...validateCorePrescriptionFields({
      controlledSchedule: input.controlledSchedule,
      doctorNpi: input.doctorNpi,
      doctorDea: input.doctorDea,
      prescriptionId: input.prescriptionId,
      quantity: input.quantity,
      medicationCategory: input.medicationCategory,
      requirePrescriptionId: true,
    })
  );

  const pickup = new Date(input.pickupWindowIso);
  if (Number.isNaN(pickup.getTime())) {
    issues.push({
      field: "pickupWindowIso",
      code: "INVALID_PICKUP_WINDOW",
      message: "Pickup window must be a valid ISO date.",
    });
  } else {
    const now = Date.now();
    if (pickup.getTime() <= now) {
      issues.push({
        field: "pickupWindowIso",
        code: "PICKUP_IN_PAST",
        message: "Pickup window must be in the future.",
      });
    }

    const max = now + 1000 * 60 * 60 * 24 * 45;
    if (pickup.getTime() > max) {
      issues.push({
        field: "pickupWindowIso",
        code: "PICKUP_TOO_FAR",
        message: "Pickup window must be within 45 days.",
      });
    }
  }

  return issues;
}

export function validateDoctorFileAttestationInput(
  input: DoctorFileAttestationRequest
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  const requestId = input.requestId?.trim() || "";
  if (requestId && requestId.length < 8) {
    issues.push({
      field: "requestId",
      code: "INVALID_REQUEST_ID",
      message: "Doctor request reference must be at least 8 characters when provided.",
    });
  }

  if (!isClientWallet(input.doctorWallet)) {
    issues.push({
      field: "doctorWallet",
      code: "INVALID_DOCTOR_WALLET",
      message: "Doctor wallet must be unlink1... or 0x... format.",
    });
  }

  if (!isClientWallet(input.patientWallet)) {
    issues.push({
      field: "patientWallet",
      code: "INVALID_PATIENT_WALLET",
      message: "Patient wallet must be unlink1... or 0x... format.",
    });
  }

  if (!input.canPurchase) {
    issues.push({
      field: "canPurchase",
      code: "NOT_APPROVED",
      message: "Attestation must explicitly mark patient as eligible.",
    });
  }

  issues.push(
    ...validateCorePrescriptionFields({
      controlledSchedule: input.controlledSchedule,
      doctorNpi: input.doctorNpi,
      doctorDea: input.doctorDea,
      quantity: input.quantity,
      medicationCategory: input.medicationCategory,
      requirePrescriptionId: false,
    })
  );

  if (!input.medicationCode.trim()) {
    issues.push({
      field: "medicationCode",
      code: "MISSING_MEDICATION_CODE",
      message: "Medication selection is required.",
    });
  } else if (!getMedicationByCode(input.medicationCode)) {
    issues.push({
      field: "medicationCode",
      code: "INVALID_MEDICATION_CODE",
      message: "Selected medication is not in the approved catalog.",
    });
  }

  const validUntil = new Date(input.validUntilIso);
  if (Number.isNaN(validUntil.getTime())) {
    issues.push({
      field: "validUntilIso",
      code: "INVALID_VALID_UNTIL",
      message: "validUntilIso must be a valid ISO date.",
    });
  } else {
    const now = Date.now();
    if (validUntil.getTime() <= now) {
      issues.push({
        field: "validUntilIso",
        code: "ALREADY_EXPIRED",
        message: "Attestation expiry must be in the future.",
      });
    }

    const max = now + 1000 * 60 * 60 * 24 * 90;
    if (validUntil.getTime() > max) {
      issues.push({
        field: "validUntilIso",
        code: "EXPIRY_TOO_FAR",
        message: "Attestation validity window cannot exceed 90 days.",
      });
    }
  }

  return issues;
}

export function validateDoctorRegisterPatientInput(
  input: DoctorRegisterPatientRequest
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (!isClientWallet(input.doctorWallet)) {
    issues.push({
      field: "doctorWallet",
      code: "INVALID_DOCTOR_WALLET",
      message: "Doctor wallet must be unlink1... or 0x... format.",
    });
  }

  if (!isClientWallet(input.patientWallet)) {
    issues.push({
      field: "patientWallet",
      code: "INVALID_PATIENT_WALLET",
      message: "Patient wallet must be unlink1... or 0x... format.",
    });
  }

  if (!RELAY_ID.test(input.registryRelayId.trim())) {
    issues.push({
      field: "registryRelayId",
      code: "INVALID_REGISTRY_RELAY_ID",
      message: "On-chain registry proof relay id is required.",
    });
  }

  issues.push(...validateLegalIdentityFields(input));
  return issues;
}

export function validatePatientDoctorApprovalRequestInput(
  input: PatientDoctorApprovalRequest
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (!isClientWallet(input.doctorWallet)) {
    issues.push({
      field: "doctorWallet",
      code: "INVALID_DOCTOR_WALLET",
      message: "Doctor wallet must be unlink1... or 0x... format.",
    });
  }

  if (!isClientWallet(input.patientWallet)) {
    issues.push({
      field: "patientWallet",
      code: "INVALID_PATIENT_WALLET",
      message: "Patient wallet must be unlink1... or 0x... format.",
    });
  }

  if (!RELAY_ID.test(input.requestRelayId.trim())) {
    issues.push({
      field: "requestRelayId",
      code: "INVALID_RELAY_ID",
      message: "A valid wallet transaction relay id is required.",
    });
  }

  if (!input.medicationCode.trim()) {
    issues.push({
      field: "medicationCode",
      code: "MISSING_MEDICATION_CODE",
      message: "Select a medication from the dropdown list.",
    });
  } else if (!getMedicationByCode(input.medicationCode)) {
    issues.push({
      field: "medicationCode",
      code: "INVALID_MEDICATION_CODE",
      message: "Selected medication is not in the approved catalog.",
    });
  }

  if (!input.walletProof || typeof input.walletProof !== "object") {
    issues.push({
      field: "walletProof",
      code: "MISSING_WALLET_PROOF",
      message: "A wallet signature proof is required for doctor request submission.",
    });
  } else {
    if (input.walletProof.version !== PATIENT_DOCTOR_WALLET_PROOF_VERSION) {
      issues.push({
        field: "walletProof.version",
        code: "INVALID_WALLET_PROOF_VERSION",
        message: "Wallet proof version is invalid.",
      });
    }

    if (!isHexEvmAddress(input.walletProof.monadWallet)) {
      issues.push({
        field: "walletProof.monadWallet",
        code: "INVALID_MONAD_WALLET",
        message: "Monad wallet must be a 0x-prefixed EVM address.",
      });
    }

    if (!NONCE.test(input.walletProof.requestNonce.trim())) {
      issues.push({
        field: "walletProof.requestNonce",
        code: "INVALID_WALLET_PROOF_NONCE",
        message: "Wallet proof nonce is invalid.",
      });
    }

    const proofTs = Number(input.walletProof.requestTs);
    if (!Number.isFinite(proofTs)) {
      issues.push({
        field: "walletProof.requestTs",
        code: "INVALID_WALLET_PROOF_TS",
        message: "Wallet proof timestamp is invalid.",
      });
    }

    if (!isHexEcdsaSignature(input.walletProof.signature)) {
      issues.push({
        field: "walletProof.signature",
        code: "INVALID_WALLET_PROOF_SIGNATURE",
        message: "Wallet proof signature must be a 65-byte hex signature.",
      });
    }
  }

  issues.push(...validateLegalIdentityFields(input));
  return issues;
}
