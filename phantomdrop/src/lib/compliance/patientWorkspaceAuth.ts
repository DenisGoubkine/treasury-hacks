export const PATIENT_WORKSPACE_AUTH_VERSION = "patient_workspace_v1";

export interface PatientWorkspaceAuthMessageInput {
  patientWallet: string;
  monadWallet: string;
  action: string;
  resource: string;
  requestTs: string;
  requestNonce: string;
}

function compact(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildPatientWorkspaceAuthMessage(
  input: PatientWorkspaceAuthMessageInput
): string {
  return [
    "PHANTOMDROP_PATIENT_WORKSPACE_AUTH",
    `version:${PATIENT_WORKSPACE_AUTH_VERSION}`,
    `patientWallet:${compact(input.patientWallet).toLowerCase()}`,
    `monadWallet:${compact(input.monadWallet).toLowerCase()}`,
    `action:${compact(input.action).toLowerCase()}`,
    `resource:${compact(input.resource)}`,
    `requestTs:${compact(input.requestTs)}`,
    `requestNonce:${compact(input.requestNonce)}`,
  ].join("\n");
}
