export type OrderStatus =
  | "pending"
  | "funded"
  | "in_transit"
  | "delivered"
  | "paid";

export interface Order {
  id: string;
  medicationType: string;
  dropLocation: string;
  amount: string; // stored as string (bigint serialization)
  patientWallet: string;
  courierWallet?: string;
  status: OrderStatus;
  createdAt: number;
  fundedAt?: number;
  acceptedAt?: number;
  deliveredAt?: number;
  paidAt?: number;
  deliveryPhotoUrl?: string;
  aiVerificationResult?: boolean;
  txHash?: string;
  payoutTxHash?: string;
  complianceAttestationId?: string;
  complianceApprovalCode?: string;
  compliancePatientToken?: string;
  complianceDoctorToken?: string;
  complianceSignature?: string;
  complianceExpiresAt?: string;
}
