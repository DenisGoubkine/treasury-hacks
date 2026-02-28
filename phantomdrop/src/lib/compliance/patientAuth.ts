export const PATIENT_CONFIRM_WALLET_PROOF_VERSION = "patient_confirm_v1";

export interface PatientConfirmWalletAuthMessageInput {
  patientWallet: string;
  approvalCode: string;
  monadWallet: string;
  requestTs: string;
  requestNonce: string;
}

function compact(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildPatientConfirmWalletAuthMessage(
  input: PatientConfirmWalletAuthMessageInput
): string {
  return [
    "PHANTOMDROP_PATIENT_CONFIRM_AUTH",
    `version:${PATIENT_CONFIRM_WALLET_PROOF_VERSION}`,
    `patientWallet:${compact(input.patientWallet).toLowerCase()}`,
    `approvalCode:${compact(input.approvalCode).toUpperCase()}`,
    `monadWallet:${compact(input.monadWallet).toLowerCase()}`,
    `requestTs:${compact(input.requestTs)}`,
    `requestNonce:${compact(input.requestNonce)}`,
  ].join("\n");
}
