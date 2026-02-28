// Monad Testnet (Chain ID 10143)
export const CHAIN = "monad-testnet" as const;

// Platform escrow wallet — replace with your deployed Unlink address
export const PLATFORM_UNLINK_ADDRESS =
  process.env.NEXT_PUBLIC_PLATFORM_UNLINK_ADDRESS || "unlink1placeholder";

// Testnet USDC/stablecoin address — get from Unlink team or testnet faucet
// Unlink SDK resolves token addresses from chain config under the hood
export const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";

// Delivery cost in token units (6 decimals = USDC-style)
// e.g. 5_000_000n = 5.00 USDC
export const DELIVERY_FEE = BigInt(process.env.NEXT_PUBLIC_DELIVERY_FEE || "5000000");

export const MEDICATION_CATEGORIES = [
  "Prescription Refill",
  "Mental Health",
  "Reproductive Health",
  "HIV/PrEP",
  "Other",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending:    "Order Placed",
  funded:     "Escrow Funded",
  in_transit: "In Transit",
  delivered:  "Delivered",
  paid:       "Courier Paid",
};

export const STATUS_STEPS = [
  "pending",
  "funded",
  "in_transit",
  "delivered",
  "paid",
] as const;
