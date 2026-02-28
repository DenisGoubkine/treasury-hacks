import { formatUnits } from "ethers";
import { TOKEN_DECIMALS } from "@/lib/constants";

export function formatTokenAmount(amount: bigint | string, maxFractionDigits = 6): string {
  const value = typeof amount === "string" ? BigInt(amount) : amount;
  const [whole, fraction = ""] = formatUnits(value, TOKEN_DECIMALS).split(".");

  if (maxFractionDigits <= 0) {
    return whole;
  }

  const trimmedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}
