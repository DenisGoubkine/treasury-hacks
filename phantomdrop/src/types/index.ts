export type OrderStatus =
  | "pending"
  | "funded"
  | "in_transit"
  | "delivered"
  | "paid";

export type MedicationCategory =
  | "Prescription Refill"
  | "Mental Health"
  | "Reproductive Health"
  | "HIV/PrEP"
  | "Other";

export interface Order {
  id: string;
  medicationType: MedicationCategory;
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
}
