import "server-only";

const DEFAULT_ATTESTATION_TTL_HOURS = 24 * 30;

export interface ComplianceConfig {
  attestationSecret: string;
  encryptionSecret: string;
  transportSecret: string;
  doctorApiKey: string;
  pharmacyApiKey: string;
  adminApiKey: string;
  attestationTtlHours: number;
  handoffRequestWindowMs: number;
}

function readSecret(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function getComplianceConfig(): ComplianceConfig {
  const doctorApiKey = readSecret("COMPLIANCE_DOCTOR_API_KEY", "dev-doctor-key-change-me");
  const pharmacyApiKey = readSecret("COMPLIANCE_PHARMACY_API_KEY", "dev-pharmacy-key-change-me");
  return {
    attestationSecret: readSecret("COMPLIANCE_ATTESTATION_SECRET", "dev-attestation-secret-change-me"),
    encryptionSecret: readSecret("COMPLIANCE_ENCRYPTION_SECRET", "dev-encryption-secret-change-me"),
    transportSecret: readSecret("COMPLIANCE_TRANSPORT_SECRET", "dev-transport-secret-change-me"),
    doctorApiKey,
    pharmacyApiKey,
    adminApiKey: readSecret("COMPLIANCE_ADMIN_API_KEY", pharmacyApiKey),
    attestationTtlHours: Number(process.env.COMPLIANCE_ATTESTATION_TTL_HOURS || DEFAULT_ATTESTATION_TTL_HOURS),
    handoffRequestWindowMs: Number(process.env.COMPLIANCE_HANDOFF_REQUEST_WINDOW_MS || 5 * 60 * 1000),
  };
}
