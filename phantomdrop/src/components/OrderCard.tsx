"use client";

import { Order } from "@/types";
import EscrowStatus from "./EscrowStatus";
import DisputeForm from "./DisputeForm";
import { useState } from "react";
import { DISPUTE_WINDOW_MS, TOKEN_SYMBOL } from "@/lib/constants";
import { formatTokenAmount } from "@/lib/tokenFormat";

interface Props {
  order: Order;
  onDisputeSubmitted?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    "border border-zinc-200 text-zinc-500",
  funded:     "border border-blue-200 text-blue-600 bg-blue-50",
  in_transit: "border border-amber-200 text-amber-600 bg-amber-50",
  delivered:  "border border-green-200 text-green-600 bg-green-50",
  paid:       "border border-[#00E100]/40 text-[#00E100] bg-green-50",
  disputed:   "border border-red-300 text-red-600 bg-red-50",
};

export default function OrderCard({ order, onDisputeSubmitted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const fee = formatTokenAmount(order.amount, 6);
  const date = new Date(order.createdAt).toLocaleDateString();

  const canDispute =
    (order.status === "delivered" || order.status === "paid") &&
    order.deliveredAt != null &&
    Date.now() - order.deliveredAt < DISPUTE_WINDOW_MS;

  const disputeWindowDays = order.deliveredAt
    ? Math.max(0, Math.ceil((order.deliveredAt + DISPUTE_WINDOW_MS - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return (
    <div
      className={`border overflow-hidden cursor-pointer hover:border-zinc-300 transition-colors ${
        order.status === "disputed" ? "border-red-200" : "border-zinc-100"
      }`}
      onClick={() => setExpanded((x) => !x)}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-400">{order.id}</span>
            <span
              className={`text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold ${STATUS_COLORS[order.status]}`}
            >
              {order.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">{order.medicationType}</p>
          <p className="text-xs text-zinc-400">
            {date} · {fee} {TOKEN_SYMBOL} escrowed
          </p>
        </div>
        <span className="text-zinc-400 text-xs uppercase tracking-widest">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-zinc-100 pt-4">
          <EscrowStatus status={order.status} />

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-zinc-400 uppercase tracking-widest">Drop location</span>
              <span className="text-xs text-zinc-700">{order.dropLocation}</span>
            </div>
            {order.complianceAttestationId && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400 uppercase tracking-widest">Compliance</span>
                <span className="font-mono text-xs text-[#00E100]">
                  {order.complianceAttestationId.slice(0, 16)}...
                </span>
              </div>
            )}
            {order.complianceApprovalCode && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400 uppercase tracking-widest">Approval code</span>
                <span className="font-mono text-xs text-zinc-600">{order.complianceApprovalCode}</span>
              </div>
            )}
            {order.courierWallet && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400 uppercase tracking-widest">Courier</span>
                <span className="font-mono text-xs text-zinc-600">
                  {order.courierWallet.slice(0, 12)}...
                </span>
              </div>
            )}
            {order.txHash && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400 uppercase tracking-widest">Escrow tx</span>
                <span className="font-mono text-xs text-zinc-500">
                  {order.txHash.slice(0, 14)}...
                </span>
              </div>
            )}
          </div>

          {/* Dispute banner */}
          {order.status === "disputed" && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-widest text-red-700">Dispute open</p>
              <p className="text-xs text-zinc-600">{order.disputeReason}</p>
              <p className="text-xs text-zinc-400">
                Opened {order.disputeOpenedAt ? new Date(order.disputeOpenedAt).toLocaleString() : "—"}
              </p>
              {order.disputeResolution && order.disputeResolution !== "none" && (
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-700">
                  Resolution: {order.disputeResolution}
                </p>
              )}
            </div>
          )}

          {order.status === "paid" && (
            <a
              href={`/receipts`}
              onClick={(e) => e.stopPropagation()}
              className="block text-center py-2.5 border border-zinc-200 text-xs text-zinc-600 uppercase tracking-widest hover:border-zinc-900 hover:text-zinc-900 transition-colors"
            >
              View ZK Receipt →
            </a>
          )}

          {/* Report issue button */}
          {canDispute && !showDispute && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowDispute(true); }}
              className="w-full py-2.5 border border-red-200 text-xs text-red-600 uppercase tracking-widest hover:border-red-400 hover:bg-red-50 transition-colors"
            >
              Report Issue — {disputeWindowDays}d left to dispute
            </button>
          )}

          {/* Inline dispute form */}
          {showDispute && (
            <div onClick={(e) => e.stopPropagation()}>
              <DisputeForm
                orderId={order.id}
                onSuccess={() => {
                  setShowDispute(false);
                  onDisputeSubmitted?.();
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
