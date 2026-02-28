import { COURIER_COMMISSION_PERCENT, ORDER_TOTAL_USDC } from "./constants";

export interface OrderBreakdown {
  totalDisplay: string;
  courierFeeDisplay: string;
  pharmacyCostDisplay: string;
  courierPercent: number;
}

export function computeOrderBreakdown(
  totalUsdc: string = ORDER_TOTAL_USDC,
  courierPercent: number = COURIER_COMMISSION_PERCENT,
): OrderBreakdown {
  const total = parseFloat(totalUsdc);
  const courierFee = total * (courierPercent / 100);
  const pharmacyCost = total - courierFee;
  return {
    totalDisplay: total.toFixed(2),
    courierFeeDisplay: courierFee.toFixed(2),
    pharmacyCostDisplay: pharmacyCost.toFixed(2),
    courierPercent,
  };
}
