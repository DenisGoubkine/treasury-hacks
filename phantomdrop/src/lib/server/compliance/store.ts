import "server-only";

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

declare global {
  var __phantomdrop_compliance_records: Map<string, ComplianceRecord> | undefined;
  var __phantomdrop_doctor_attestations: Map<string, DoctorAttestationRecord> | undefined;
  var __phantomdrop_doctor_verified_patients: Map<string, DoctorVerifiedPatientRecord> | undefined;
  var __phantomdrop_doctor_approval_requests: Map<string, DoctorApprovalRequestRecord> | undefined;
}

function getRecordMap(): Map<string, ComplianceRecord> {
  if (!global.__phantomdrop_compliance_records) {
    global.__phantomdrop_compliance_records = new Map();
  }
  return global.__phantomdrop_compliance_records;
}

function getDoctorRecordMap(): Map<string, DoctorAttestationRecord> {
  if (!global.__phantomdrop_doctor_attestations) {
    global.__phantomdrop_doctor_attestations = new Map();
  }
  return global.__phantomdrop_doctor_attestations;
}

function getVerifiedPatientMap(): Map<string, DoctorVerifiedPatientRecord> {
  if (!global.__phantomdrop_doctor_verified_patients) {
    global.__phantomdrop_doctor_verified_patients = new Map();
  }
  return global.__phantomdrop_doctor_verified_patients;
}

function getApprovalRequestMap(): Map<string, DoctorApprovalRequestRecord> {
  if (!global.__phantomdrop_doctor_approval_requests) {
    global.__phantomdrop_doctor_approval_requests = new Map();
  }
  return global.__phantomdrop_doctor_approval_requests;
}

export function saveComplianceRecord(record: ComplianceRecord): void {
  getRecordMap().set(record.attestation.attestationId, record);
}

export function getComplianceRecord(attestationId: string): ComplianceRecord | undefined {
  return getRecordMap().get(attestationId);
}

export function saveDoctorAttestationRecord(record: DoctorAttestationRecord): void {
  getDoctorRecordMap().set(record.attestation.approvalCode, record);
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
  return Array.from(getDoctorRecordMap().values())
    .filter((record) => record.attestation.doctorWallet === doctorWallet)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function verifiedPatientKey(doctorWallet: string, patientWallet: string): string {
  return `${doctorWallet.toLowerCase()}::${patientWallet.toLowerCase()}`;
}

export function saveDoctorVerifiedPatient(record: DoctorRegisterPatientRecord): void {
  getVerifiedPatientMap().set(verifiedPatientKey(record.doctorWallet, record.patientWallet), {
    record,
    createdAt: Date.now(),
  });
}

export function getDoctorVerifiedPatient(
  doctorWallet: string,
  patientWallet: string
): DoctorVerifiedPatientRecord | undefined {
  return getVerifiedPatientMap().get(verifiedPatientKey(doctorWallet, patientWallet));
}

export function saveDoctorApprovalRequest(request: PatientDoctorApprovalRequestRecord): void {
  getApprovalRequestMap().set(request.requestId, { request, createdAt: Date.now() });
}

export function getDoctorApprovalRequest(
  requestId: string
): DoctorApprovalRequestRecord | undefined {
  return getApprovalRequestMap().get(requestId);
}

export function getDoctorApprovalRequestsByDoctor(
  doctorWallet: string
): DoctorApprovalRequestRecord[] {
  return Array.from(getApprovalRequestMap().values())
    .filter((record) => record.request.doctorWallet === doctorWallet)
    .sort((a, b) => b.createdAt - a.createdAt);
}
