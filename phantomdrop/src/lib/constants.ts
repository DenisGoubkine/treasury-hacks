import { ETH_TOKEN } from "@unlink-xyz/core";

// Monad Testnet (Chain ID 10143)
export const CHAIN = "monad-testnet" as const;
export const MONAD_CHAIN_ID = 10143;
export const MONAD_CHAIN_ID_HEX = "0x279f";
export const MONAD_TESTNET_RPC_URL = "https://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_EXPLORER_URL = "https://testnet.monadscan.com";
export const MONAD_BLOCK_TIME_MS = 400;
export const MONAD_FINALITY_MS = 800;

// Platform escrow wallet — replace with your deployed Unlink address
export const PLATFORM_UNLINK_ADDRESS =
  process.env.NEXT_PUBLIC_PLATFORM_UNLINK_ADDRESS || "unlink1placeholder";

// Token used by private transfers.
// Default is native MON via ETH_TOKEN sentinel.
export const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_ADDRESS || ETH_TOKEN;
export const TOKEN_IS_NATIVE =
  TOKEN_ADDRESS.toLowerCase() === ETH_TOKEN.toLowerCase();
export const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || (TOKEN_IS_NATIVE ? "MON" : "TOKEN");
export const TOKEN_DECIMALS = Number(
  process.env.NEXT_PUBLIC_TOKEN_DECIMALS || (TOKEN_IS_NATIVE ? "18" : "6")
);

// Delivery cost in base units for TOKEN_ADDRESS.
export const DELIVERY_FEE = BigInt(process.env.NEXT_PUBLIC_DELIVERY_FEE || "5000000");
export const REQUEST_SIGNAL_AMOUNT = BigInt(process.env.NEXT_PUBLIC_REQUEST_SIGNAL_AMOUNT || "1");
export const REGISTRY_SIGNAL_AMOUNT = BigInt(
  process.env.NEXT_PUBLIC_REGISTRY_SIGNAL_AMOUNT ||
    process.env.NEXT_PUBLIC_REQUEST_SIGNAL_AMOUNT ||
    "1"
);

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
