export type ControlledSchedule = "non_controlled" | "schedule_iii_v" | "schedule_ii";

export interface LegalIdentityInput {
  legalName: string;
  dob: string; // YYYY-MM-DD
  patientState: string; // 2-letter
  healthCardNumber: string;
}

export interface ComplianceIntakeRequest {
  patientWallet: string;
  patientFullName: string;
  patientDob: string; // YYYY-MM-DD
  patientState: string; // 2-letter US state code
  doctorNpi: string; // 10 digits
  doctorDea?: string;
  prescriptionId: string;
  quantity: number;
  pickupWindowIso: string;
  medicationCategory: string;
  controlledSchedule: ControlledSchedule;
}

export interface ComplianceAttestation {
  attestationId: string;
  status: "validated";
  validationVersion: string;
  patientToken: string;
  doctorToken: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export interface ComplianceIssue {
  field: string;
  code: string;
  message: string;
}

export interface ComplianceAttestResponse {
  ok: boolean;
  attestation?: ComplianceAttestation;
  issues?: ComplianceIssue[];
  error?: string;
}

export interface DoctorFileAttestationRequest {
  requestId?: string;
  doctorWallet: string;
  doctorNpi: string;
  doctorDea?: string;
  patientWallet: string;
  medicationCode: string;
  medicationCategory: string;
  medicationSource?: "local" | "fda" | "custom";
  ndc?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  controlledSchedule: ControlledSchedule;
  quantity: number;
  validUntilIso: string;
  canPurchase: boolean;
}

export interface DoctorFiledAttestation {
  approvalCode: string;
  attestationId: string;
  requestId: string;
  doctorWallet: string;
  patientWallet: string;
  patientToken: string;
  doctorToken: string;
  medicationCode: string;
  medicationCategory: string;
  medicationSource?: "local" | "fda" | "custom";
  ndc?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  prescriptionHash: string;
  controlledSchedule: ControlledSchedule;
  quantity: number;
  canPurchase: boolean;
  issuedAt: string;
  validUntilIso: string;
  chainAnchor: {
    network: "monad-testnet";
    anchorHash: string;
    anchorTxHash: string;
    finalityMs: number;
    anchoredAt: string;
  };
  signature: string;
}

export interface DoctorFileAttestationResponse {
  ok: boolean;
  attestation?: DoctorFiledAttestation;
  issues?: ComplianceIssue[];
  error?: string;
}

export interface DoctorConfirmAttestationRequest {
  approvalCode: string;
  patientWallet: string;
  walletProof: {
    version: string;
    monadWallet: string;
    requestTs: string;
    requestNonce: string;
    signature: string;
  };
}

export interface DoctorConfirmAttestationResponse {
  ok: boolean;
  attestation?: ComplianceAttestation;
  orderPolicy?: {
    medicationCode: string;
    medicationCategory: string;
    controlledSchedule: ControlledSchedule;
    quantity: number;
    prescriptionHash: string;
  };
  error?: string;
}

export interface PatientWorkspaceWalletProof {
  version: string;
  monadWallet: string;
  action: string;
  resource: string;
  requestTs: string;
  requestNonce: string;
  signature: string;
}

export interface PatientApprovedMedication {
  approvalCode: string;
  attestationId: string;
  doctorWallet: string;
  medicationCode: string;
  medicationCategory: string;
  medicationSource?: "local" | "fda" | "custom";
  ndc?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  controlledSchedule: ControlledSchedule;
  quantity: number;
  validUntilIso: string;
  patientToken: string;
  doctorToken: string;
  signature: string;
}

export interface PatientApprovedMedicationsResponse {
  ok: boolean;
  patientWallet?: string;
  approvals?: PatientApprovedMedication[];
  error?: string;
}

export interface DoctorRegisterPatientRequest extends LegalIdentityInput {
  doctorWallet: string;
  doctorName?: string;
  patientWallet: string;
  registryRelayId: string;
}

export interface DoctorRegisterPatientRecord {
  registryId: string;
  doctorWallet: string;
  doctorName?: string;
  patientWallet: string;
  patientLegalName?: string;
  registryRelayId: string;
  patientToken: string;
  legalIdentityHash: string;
  verifiedAt: string;
  signature: string;
}

export interface DoctorRegisterPatientResponse {
  ok: boolean;
  record?: DoctorRegisterPatientRecord;
  issues?: ComplianceIssue[];
  error?: string;
}

export interface DoctorLinkPharmacyRequest {
  doctorWallet: string;
  pharmacyWallet: string;
  pharmacyName: string;
  pharmacyLicenseId: string;
}

export interface DoctorLinkedPharmacyRecord {
  linkId: string;
  doctorWallet: string;
  pharmacyWallet: string;
  pharmacyName: string;
  pharmacyLicenseId: string;
  linkedAt: string;
  signature: string;
}

export interface DoctorLinkPharmacyResponse {
  ok: boolean;
  record?: DoctorLinkedPharmacyRecord;
  records?: DoctorLinkedPharmacyRecord[];
  issues?: ComplianceIssue[];
  error?: string;
}

export interface PatientWalletProof {
  version: string;
  monadWallet: string;
  requestTs: string;
  requestNonce: string;
  signature: string;
}

export interface PatientDoctorApprovalRequest extends LegalIdentityInput {
  doctorWallet: string;
  patientWallet: string;
  medicationCode: string;
  requestRelayId: string;
  walletProof: PatientWalletProof;
}

export interface PatientDoctorApprovalRequestRecord {
  requestId: string;
  doctorWallet: string;
  patientWallet: string;
  patientToken: string;
  legalIdentityHash: string;
  medicationCode: string;
  medicationCategory: string;
  requestRelayId: string;
  relayStatus: "submitted";
  verificationStatus: "registry_verified" | "needs_manual_review";
  walletProof: {
    monadWallet: string;
    requestTs: string;
    requestNonce: string;
    signature: string;
    signerVerified: true;
  };
  createdAt: string;
}

export interface PatientDoctorApprovalRequestResponse {
  ok: boolean;
  request?: PatientDoctorApprovalRequestRecord;
  issues?: ComplianceIssue[];
  error?: string;
}

export interface PharmacyHandoffResponse {
  ok: boolean;
  attestationId: string;
  attestationStatus: "validated" | "expired";
  issuedAt: string;
  expiresAt: string;
  prescription: {
    prescriptionId: string;
    medicationCode: string;
    prescriptionHash?: string;
    medicationCategory: string;
    controlledSchedule: ControlledSchedule;
    quantity: number;
    pickupWindowIso: string;
  };
  patient: {
    token: string;
    wallet: string;
    legalVerificationStatus: "registry_verified" | "manual_review";
    legalIdentityHash?: string;
    fullName?: string;
    dob?: string;
    state?: string;
  };
  doctor: {
    token: string;
    wallet: string;
    providerVerificationStatus: "npi_validated";
    npi?: string;
    dea?: string;
  };
  signature: string;
}

export interface PharmacyHandoffEnvelope {
  ok: true;
  transport: "sealed-v1";
  keyId: "platform-transport-v1";
  attestationId: string;
  sealedPayload: string;
  signature: string;
}
