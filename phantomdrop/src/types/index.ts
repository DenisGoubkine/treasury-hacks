export type OrderStatus =
  | "pending"
  | "funded"
  | "in_transit"
  | "delivered"
  | "paid"
  | "disputed";

export interface Order {
  id: string;
  medicationType: string;
  dropLocation: string;
  amount: string; // stored as string (bigint serialization)
  patientWallet?: string; // legacy
  patientWalletHash?: string; // preferred privacy-preserving identity key
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
  payoutTokenSymbol?: string;
  payoutAmount?: string; // base units for payout token (ex: USDC 6 decimals)
  payoutSwapRate?: string; // input token to payout token swap rate
  payoutSwapReference?: string;
  escrowDepositRelayId?: string;
  escrowSendRelayId?: string;
  complianceAttestationId?: string;
  complianceApprovalCode?: string;
  compliancePatientToken?: string;
  complianceDoctorToken?: string;
  complianceSignature?: string;
  complianceExpiresAt?: string;
  totalUsdc?: string;
  pharmacyCostUsdc?: string;
  courierFeeUsdc?: string;
  disputeReason?: string;
  disputeOpenedAt?: number;
  disputeResolvedAt?: number;
  disputeResolution?: "none" | "refunded" | "dismissed";
}
