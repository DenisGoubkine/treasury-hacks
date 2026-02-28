import { formatUnits, keccak256, toUtf8Bytes } from "ethers";

import {
  COURIER_PAYOUT_DECIMALS,
  COURIER_PAYOUT_SYMBOL,
  COURIER_USDC_SWAP_RATE,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
} from "@/lib/constants";

function pow10(exp: number): bigint {
  return BigInt(10) ** BigInt(exp);
}

function normalizeDecimals(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return amount;
  if (fromDecimals > toDecimals) {
    return amount / pow10(fromDecimals - toDecimals);
  }
  return amount * pow10(toDecimals - fromDecimals);
}

function rateToMicros(rate: number): bigint {
  const scaled = Math.round(rate * 1_000_000);
  return BigInt(Math.max(1, scaled));
}

export interface CourierSwapQuote {
  inputTokenSymbol: string;
  outputTokenSymbol: string;
  inputAmountBaseUnits: string;
  outputAmountBaseUnits: string;
  rate: string;
}

export function quoteCourierPayoutUsdc(inputAmountBaseUnits: string): CourierSwapQuote {
  const inputBase = BigInt(inputAmountBaseUnits);
  const normalized = normalizeDecimals(inputBase, TOKEN_DECIMALS, COURIER_PAYOUT_DECIMALS);
  const rateMicros = rateToMicros(COURIER_USDC_SWAP_RATE);
  const outputBase = (normalized * rateMicros) / BigInt(1_000_000);

  return {
    inputTokenSymbol: TOKEN_SYMBOL,
    outputTokenSymbol: COURIER_PAYOUT_SYMBOL,
    inputAmountBaseUnits: inputBase.toString(),
    outputAmountBaseUnits: outputBase.toString(),
    rate: COURIER_USDC_SWAP_RATE.toString(),
  };
}

export function formatPayoutAmount(baseUnits: string, maxFractionDigits = 2): string {
  const [whole, fraction = ""] = formatUnits(BigInt(baseUnits), COURIER_PAYOUT_DECIMALS).split(".");
  if (maxFractionDigits <= 0) return whole;
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function buildCourierSwapReference(orderId: string, courierWallet: string): string {
  return keccak256(
    toUtf8Bytes(`${orderId}|${courierWallet.toLowerCase()}|${Date.now()}|${Math.random()}`)
  );
}
