export interface DoctorWalletAuthMessageInput {
  doctorWallet: string;
  monadWallet: string;
  action: string;
  resource: string;
  requestTs: string;
  requestNonce: string;
}

function compact(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildDoctorWalletAuthMessage(
  input: DoctorWalletAuthMessageInput
): string {
  return [
    "PHANTOMDROP_DOCTOR_AUTH",
    `doctorWallet:${compact(input.doctorWallet).toLowerCase()}`,
    `monadWallet:${compact(input.monadWallet).toLowerCase()}`,
    `action:${compact(input.action).toLowerCase()}`,
    `resource:${compact(input.resource)}`,
    `requestTs:${compact(input.requestTs)}`,
    `requestNonce:${compact(input.requestNonce)}`,
  ].join("\n");
}
