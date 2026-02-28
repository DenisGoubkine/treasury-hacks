import "server-only";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import {
  ComplianceAttestation,
  ComplianceIntakeRequest,
  DoctorRegisterPatientRecord,
  DoctorFiledAttestation,
  PatientDoctorApprovalRequestRecord,
} from "@/lib/compliance/types";

export interface ComplianceRecord {
  attestation: ComplianceAttestation;
  intake: ComplianceIntakeRequest;
  encryptedPhi: string;
  createdAt: number;
}

export interface DoctorAttestationRecord {
  attestation: DoctorFiledAttestation;
  encryptedPrescription: string;
  createdAt: number;
}

export interface DoctorVerifiedPatientRecord {
  record: DoctorRegisterPatientRecord;
  createdAt: number;
}

export interface DoctorApprovalRequestRecord {
  request: PatientDoctorApprovalRequestRecord;
  createdAt: number;
}

interface PersistedComplianceStoreV1 {
  version: 1;
  complianceRecords: Array<[string, ComplianceRecord]>;
  doctorAttestations: Array<[string, DoctorAttestationRecord]>;
  doctorVerifiedPatients: Array<[string, DoctorVerifiedPatientRecord]>;
  doctorApprovalRequests: Array<[string, DoctorApprovalRequestRecord]>;
}

declare global {
  var __phantomdrop_compliance_records: Map<string, ComplianceRecord> | undefined;
  var __phantomdrop_doctor_attestations: Map<string, DoctorAttestationRecord> | undefined;
  var __phantomdrop_doctor_verified_patients: Map<string, DoctorVerifiedPatientRecord> | undefined;
  var __phantomdrop_doctor_approval_requests: Map<string, DoctorApprovalRequestRecord> | undefined;
  var __phantomdrop_compliance_store_loaded: boolean | undefined;
}

function getStoreFilePath(): string {
  const configured = process.env.COMPLIANCE_STORE_FILE?.trim();
  if (configured) {
    return configured.startsWith("/") ? configured : resolve(process.cwd(), configured);
  }
  return resolve(process.cwd(), ".data", "compliance-store.json");
}

function hydrateStoreIfNeeded(): void {
  if (global.__phantomdrop_compliance_store_loaded) {
    return;
  }

  global.__phantomdrop_compliance_records = new Map();
  global.__phantomdrop_doctor_attestations = new Map();
  global.__phantomdrop_doctor_verified_patients = new Map();
  global.__phantomdrop_doctor_approval_requests = new Map();

  const filePath = getStoreFilePath();
  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as PersistedComplianceStoreV1;
      if (parsed && parsed.version === 1) {
        global.__phantomdrop_compliance_records = new Map(parsed.complianceRecords || []);
        global.__phantomdrop_doctor_attestations = new Map(parsed.doctorAttestations || []);
        global.__phantomdrop_doctor_verified_patients = new Map(parsed.doctorVerifiedPatients || []);
        global.__phantomdrop_doctor_approval_requests = new Map(parsed.doctorApprovalRequests || []);
      }
    } catch {
      // Ignore malformed persistence file and start with empty in-memory maps.
    }
  }

  global.__phantomdrop_compliance_store_loaded = true;
}

function persistStore(): void {
  hydrateStoreIfNeeded();

  const filePath = getStoreFilePath();
  const tmpPath = `${filePath}.tmp`;
  const payload: PersistedComplianceStoreV1 = {
    version: 1,
    complianceRecords: Array.from(getRecordMap().entries()),
    doctorAttestations: Array.from(getDoctorRecordMap().entries()),
    doctorVerifiedPatients: Array.from(getVerifiedPatientMap().entries()),
    doctorApprovalRequests: Array.from(getApprovalRequestMap().entries()),
  };

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
  renameSync(tmpPath, filePath);
}

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}

function getRecordMap(): Map<string, ComplianceRecord> {
  hydrateStoreIfNeeded();
  if (!global.__phantomdrop_compliance_records) {
    global.__phantomdrop_compliance_records = new Map();
  }
  return global.__phantomdrop_compliance_records;
}

function getDoctorRecordMap(): Map<string, DoctorAttestationRecord> {
  hydrateStoreIfNeeded();
  if (!global.__phantomdrop_doctor_attestations) {
    global.__phantomdrop_doctor_attestations = new Map();
  }
  return global.__phantomdrop_doctor_attestations;
}

function getVerifiedPatientMap(): Map<string, DoctorVerifiedPatientRecord> {
  hydrateStoreIfNeeded();
  if (!global.__phantomdrop_doctor_verified_patients) {
    global.__phantomdrop_doctor_verified_patients = new Map();
  }
  return global.__phantomdrop_doctor_verified_patients;
}

function getApprovalRequestMap(): Map<string, DoctorApprovalRequestRecord> {
  hydrateStoreIfNeeded();
  if (!global.__phantomdrop_doctor_approval_requests) {
    global.__phantomdrop_doctor_approval_requests = new Map();
  }
  return global.__phantomdrop_doctor_approval_requests;
}

export function saveComplianceRecord(record: ComplianceRecord): void {
  getRecordMap().set(record.attestation.attestationId, record);
  persistStore();
}

export function getComplianceRecord(attestationId: string): ComplianceRecord | undefined {
  return getRecordMap().get(attestationId);
}

export function saveDoctorAttestationRecord(record: DoctorAttestationRecord): void {
  getDoctorRecordMap().set(record.attestation.approvalCode, record);
  persistStore();
}

export function getDoctorAttestationRecord(approvalCode: string): DoctorAttestationRecord | undefined {
  return getDoctorRecordMap().get(approvalCode);
}

export function getDoctorAttestationRecordByAttestationId(
  attestationId: string
): DoctorAttestationRecord | undefined {
  return Array.from(getDoctorRecordMap().values()).find(
    (record) => record.attestation.attestationId === attestationId
  );
}

export function getDoctorAttestationRecordsByDoctor(doctorWallet: string): DoctorAttestationRecord[] {
  const normalized = normalizeWallet(doctorWallet);
  return Array.from(getDoctorRecordMap().values())
    .filter((record) => normalizeWallet(record.attestation.doctorWallet) === normalized)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getDoctorAttestationRecordsByPatient(patientWallet: string): DoctorAttestationRecord[] {
  const normalized = normalizeWallet(patientWallet);
  return Array.from(getDoctorRecordMap().values())
    .filter((record) => normalizeWallet(record.attestation.patientWallet) === normalized)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function verifiedPatientKey(doctorWallet: string, patientWallet: string): string {
  return `${normalizeWallet(doctorWallet)}::${normalizeWallet(patientWallet)}`;
}

export function saveDoctorVerifiedPatient(record: DoctorRegisterPatientRecord): void {
  getVerifiedPatientMap().set(verifiedPatientKey(record.doctorWallet, record.patientWallet), {
    record,
    createdAt: Date.now(),
  });
  persistStore();
}

export function getDoctorVerifiedPatient(
  doctorWallet: string,
  patientWallet: string
): DoctorVerifiedPatientRecord | undefined {
  return getVerifiedPatientMap().get(verifiedPatientKey(doctorWallet, patientWallet));
}

export function getDoctorVerifiedPatientsByDoctor(
  doctorWallet: string
): DoctorVerifiedPatientRecord[] {
  const normalized = normalizeWallet(doctorWallet);
  return Array.from(getVerifiedPatientMap().values())
    .filter((record) => normalizeWallet(record.record.doctorWallet) === normalized)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function saveDoctorApprovalRequest(request: PatientDoctorApprovalRequestRecord): void {
  getApprovalRequestMap().set(request.requestId, { request, createdAt: Date.now() });
  persistStore();
}

export function getDoctorApprovalRequest(
  requestId: string
): DoctorApprovalRequestRecord | undefined {
  return getApprovalRequestMap().get(requestId);
}

export function getDoctorApprovalRequestsByDoctor(
  doctorWallet: string
): DoctorApprovalRequestRecord[] {
  const normalized = normalizeWallet(doctorWallet);
  return Array.from(getApprovalRequestMap().values())
    .filter((record) => normalizeWallet(record.request.doctorWallet) === normalized)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function updateDoctorVerifiedPatientWallet(
  doctorWallet: string,
  oldPatientWallet: string,
  newPatientWallet: string
): DoctorVerifiedPatientRecord | undefined {
  const oldKey = verifiedPatientKey(doctorWallet, oldPatientWallet);
  const existing = getVerifiedPatientMap().get(oldKey);
  if (!existing) return undefined;

  // Remove old key
  getVerifiedPatientMap().delete(oldKey);

  // Save under new key with updated wallet
  const updated: DoctorVerifiedPatientRecord = {
    ...existing,
    record: { ...existing.record, patientWallet: newPatientWallet },
  };
  const newKey = verifiedPatientKey(doctorWallet, newPatientWallet);
  getVerifiedPatientMap().set(newKey, updated);

  persistStore();
  return updated;
}

export function updateAttestationPatientWallet(
  doctorWallet: string,
  oldPatientWallet: string,
  newPatientWallet: string
): number {
  const normalizedDoctor = normalizeWallet(doctorWallet);
  const normalizedOld = normalizeWallet(oldPatientWallet);
  let count = 0;

  for (const [key, record] of getDoctorRecordMap().entries()) {
    if (
      normalizeWallet(record.attestation.doctorWallet) === normalizedDoctor &&
      normalizeWallet(record.attestation.patientWallet) === normalizedOld
    ) {
      record.attestation = { ...record.attestation, patientWallet: newPatientWallet };
      getDoctorRecordMap().set(key, record);
      count++;
    }
  }

  if (count > 0) persistStore();
  return count;
}

export function resetComplianceStore(): void {
  global.__phantomdrop_compliance_records = new Map();
  global.__phantomdrop_doctor_attestations = new Map();
  global.__phantomdrop_doctor_verified_patients = new Map();
  global.__phantomdrop_doctor_approval_requests = new Map();
  global.__phantomdrop_compliance_store_loaded = true;
  persistStore();
}
