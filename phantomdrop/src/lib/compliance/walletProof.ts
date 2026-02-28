export const PATIENT_DOCTOR_WALLET_PROOF_VERSION = "doctor_request_v1";

const HEX_EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HEX_ECDSA_SIGNATURE = /^0x[a-fA-F0-9]{130}$/;

export interface PatientDoctorWalletProofMessageInput {
  patientWallet: string;
  doctorWallet: string;
  medicationCode: string;
  requestRelayId: string;
  legalName: string;
  dob: string;
  patientState: string;
  healthCardNumber: string;
  monadWallet: string;
  requestTs: string;
  requestNonce: string;
}

function compactWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeWalletProofAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeWalletProofEvmAddress(value: string): string {
  return value.trim().toLowerCase();
}

function healthCardLast4(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  return compact.slice(-4);
}

export function isHexEvmAddress(value: string): boolean {
  return HEX_EVM_ADDRESS.test(value.trim());
}

export function isHexEcdsaSignature(value: string): boolean {
  return HEX_ECDSA_SIGNATURE.test(value.trim());
}

export function buildPatientDoctorWalletProofMessage(
  input: PatientDoctorWalletProofMessageInput
): string {
  return [
    "PHANTOMDROP_DOCTOR_REQUEST_PROOF",
    `version:${PATIENT_DOCTOR_WALLET_PROOF_VERSION}`,
    `patientWallet:${normalizeWalletProofAddress(input.patientWallet)}`,
    `doctorWallet:${normalizeWalletProofAddress(input.doctorWallet)}`,
    `medicationCode:${compactWhitespace(input.medicationCode).toLowerCase()}`,
    `requestRelayId:${compactWhitespace(input.requestRelayId)}`,
    `monadWallet:${normalizeWalletProofEvmAddress(input.monadWallet)}`,
    `legalName:${compactWhitespace(input.legalName).toUpperCase()}`,
    `dob:${input.dob.trim()}`,
    `patientState:${input.patientState.trim().toUpperCase()}`,
    `healthCardLast4:${healthCardLast4(input.healthCardNumber)}`,
    `requestTs:${input.requestTs.trim()}`,
    `requestNonce:${input.requestNonce.trim()}`,
  ].join("\n");
}
