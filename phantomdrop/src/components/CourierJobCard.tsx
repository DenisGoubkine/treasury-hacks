"use client";

import { Order } from "@/types";
import { updateOrderStatus } from "@/lib/store";
import { COURIER_PAYOUT_SYMBOL } from "@/lib/constants";
import { formatPayoutAmount, quoteCourierPayoutUsdc } from "@/lib/courierSwap";

interface Props {
  order: Order;
  courierWallet: string;
  onAccepted: () => void;
}

export default function CourierJobCard({ order, courierWallet, onAccepted }: Props) {
  const payoutQuote = quoteCourierPayoutUsdc(order.amount);
  const payoutDisplay = formatPayoutAmount(payoutQuote.outputAmountBaseUnits, 2);

  function handleAccept() {
    if (!courierWallet) return;
    updateOrderStatus(order.id, {
      status: "in_transit",
      courierWallet,
      acceptedAt: Date.now(),
      payoutTokenSymbol: COURIER_PAYOUT_SYMBOL,
      payoutAmount: payoutQuote.outputAmountBaseUnits,
      payoutSwapRate: payoutQuote.rate,
    });
    onAccepted();
  }

  return (
    <div className="border border-zinc-100 p-5 space-y-4 hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-zinc-400 font-mono">{order.id}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Sealed Package</p>
          <p className="text-xs text-zinc-400 uppercase tracking-wide">Contents unknown · Sealed at pharmacy</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-[#00E100]">
            {payoutDisplay} {COURIER_PAYOUT_SYMBOL}
          </p>
          <p className="text-xs text-zinc-400 uppercase tracking-wide">est. payout on delivery</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-zinc-100 bg-zinc-50 p-3">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Drop-off</p>
          <p className="text-xs text-zinc-700">{order.dropLocation}</p>
        </div>
        <div className="border border-zinc-100 bg-zinc-50 p-3">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Posted</p>
          <p className="text-xs text-zinc-700">
            {new Date(order.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 uppercase tracking-wide">
        Patient identity not disclosed. Payment releases automatically when AI confirms delivery.
      </div>

      <button
        onClick={handleAccept}
        disabled={!courierWallet}
        className="w-full py-3 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Accept Delivery
      </button>
    </div>
  );
}
