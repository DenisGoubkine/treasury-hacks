"use client";

import { Order } from "@/types";
import EscrowStatus from "./EscrowStatus";
import { useState } from "react";
import { TOKEN_SYMBOL } from "@/lib/constants";
import { formatTokenAmount } from "@/lib/tokenFormat";

interface Props {
  order: Order;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-zinc-700 text-zinc-300",
  funded:     "bg-blue-900/60 text-blue-300",
  in_transit: "bg-amber-900/60 text-amber-300",
  delivered:  "bg-green-900/60 text-green-300",
  paid:       "bg-purple-900/60 text-purple-300",
};

export default function OrderCard({ order }: Props) {
  const [expanded, setExpanded] = useState(false);
  const fee = formatTokenAmount(order.amount, 6);
  const date = new Date(order.createdAt).toLocaleDateString();

  return (
    <div
      className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer hover:border-zinc-600 transition-colors"
      onClick={() => setExpanded((x) => !x)}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-zinc-400">{order.id}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}
            >
              {order.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-white font-medium">{order.medicationType}</p>
          <p className="text-xs text-zinc-500">
            {date} · {fee} {TOKEN_SYMBOL} escrowed
          </p>
        </div>
        <span className="text-zinc-600 text-sm">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-zinc-800 pt-4">
          <EscrowStatus status={order.status} />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Drop location</span>
              <span className="text-zinc-300">{order.dropLocation}</span>
            </div>
            {order.complianceAttestationId && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Compliance</span>
                <span className="font-mono text-green-400 text-xs">
                  {order.complianceAttestationId.slice(0, 16)}...
                </span>
              </div>
            )}
            {order.complianceApprovalCode && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Approval code</span>
                <span className="font-mono text-zinc-300 text-xs">{order.complianceApprovalCode}</span>
              </div>
            )}
            {order.courierWallet && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Courier</span>
                <span className="font-mono text-zinc-300 text-xs">
                  {order.courierWallet.slice(0, 12)}...
                </span>
              </div>
            )}
            {order.txHash && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Escrow tx</span>
                <span className="font-mono text-zinc-400 text-xs">
                  {order.txHash.slice(0, 14)}...
                </span>
              </div>
            )}
          </div>

          {order.status === "paid" && (
            <a
              href={`/receipts`}
              onClick={(e) => e.stopPropagation()}
              className="block text-center py-2 bg-purple-600/20 border border-purple-600/40 text-purple-400 rounded-xl text-sm hover:bg-purple-600/30 transition-colors"
            >
              View ZK Receipt →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
