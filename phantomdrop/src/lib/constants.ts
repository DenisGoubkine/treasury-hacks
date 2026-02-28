import { ETH_TOKEN } from "@unlink-xyz/core";

// Monad Testnet (Chain ID 10143)
export const CHAIN = "monad-testnet" as const;
export const MONAD_CHAIN_ID = 10143;
export const MONAD_CHAIN_ID_HEX = "0x279f";
export const MONAD_TESTNET_RPC_URL = "https://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_EXPLORER_URL = "https://testnet.monadscan.com";
export const MONAD_BLOCK_TIME_MS = 400;
export const MONAD_FINALITY_MS = 800;

// Platform Unlink escrow account (unlink1... bech32m format).
// Patient funds are privately sent here via useSend() — never exposed on-chain.
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

const parsedCourierSwapRate = Number(process.env.NEXT_PUBLIC_COURIER_USDC_SWAP_RATE || "1");
export const COURIER_USDC_SWAP_RATE =
  Number.isFinite(parsedCourierSwapRate) && parsedCourierSwapRate > 0
    ? parsedCourierSwapRate
    : 1;
export const COURIER_PAYOUT_SYMBOL =
  process.env.NEXT_PUBLIC_COURIER_PAYOUT_SYMBOL || "USDC";
export const COURIER_PAYOUT_DECIMALS = Number(
  process.env.NEXT_PUBLIC_COURIER_PAYOUT_DECIMALS || "6"
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
  funded:     "Unlink Escrow Funded",
  in_transit: "In Transit",
  delivered:  "Delivered",
  paid:       "Settled via Unlink",
};

export const STATUS_STEPS = [
  "pending",
  "funded",
  "in_transit",
  "delivered",
  "paid",
] as const;

// Alchemy Pay fiat on-ramp
export const ALCHEMY_PAY_APP_ID = process.env.NEXT_PUBLIC_ALCHEMY_PAY_APP_ID || "";
export const ALCHEMY_PAY_ENV = (process.env.NEXT_PUBLIC_ALCHEMY_PAY_ENV || "test") as "test" | "production";
export const ALCHEMY_PAY_RAMP_URL =
  ALCHEMY_PAY_ENV === "production"
    ? "https://ramp.alchemypay.org"
    : "https://ramptest.alchemypay.org";
