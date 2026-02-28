"use client";

import { Order } from "@/types";
import { useUnlink } from "@unlink-xyz/react";
import { updateOrderStatus } from "@/lib/store";

interface Props {
  order: Order;
  onAccepted: () => void;
}

export default function CourierJobCard({ order, onAccepted }: Props) {
  const { activeAccount } = useUnlink();
  const fee = (Number(order.amount) / 1_000_000).toFixed(2);

  function handleAccept() {
    if (!activeAccount) return;
    updateOrderStatus(order.id, {
      status: "in_transit",
      courierWallet: activeAccount.address,
      acceptedAt: Date.now(),
    });
    onAccepted();
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-zinc-500 font-mono">{order.id}</p>
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <span className="text-white font-medium">Sealed Package</span>
          </div>
          <p className="text-xs text-zinc-500">Contents unknown · Sealed at pharmacy</p>
        </div>
        <div className="text-right">
          <p className="text-green-400 font-bold text-lg">{fee} USDC</p>
          <p className="text-xs text-zinc-500">payout on delivery</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-zinc-800 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">📍 Drop-off</p>
          <p className="text-sm text-zinc-200">{order.dropLocation}</p>
        </div>
        <div className="p-3 bg-zinc-800 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">⏰ Posted</p>
          <p className="text-sm text-zinc-200">
            {new Date(order.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="p-3 bg-zinc-800/50 rounded-xl text-xs text-zinc-400 border border-zinc-700/50">
        🔒 Patient identity is not disclosed. Payment releases automatically when AI confirms delivery.
      </div>

      <button
        onClick={handleAccept}
        disabled={!activeAccount}
        className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-colors"
      >
        Accept Delivery
      </button>
    </div>
  );
}
