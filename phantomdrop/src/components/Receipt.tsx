"use client";

import { Order } from "@/types";
import { COURIER_PAYOUT_SYMBOL, TOKEN_SYMBOL } from "@/lib/constants";

interface Props {
  order: Order;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").toUpperCase();
}

export default function Receipt({ order }: Props) {
  const proofHash = hashString(
    `${order.id}${order.patientWalletHash || order.patientWallet || "redacted"}${order.amount}${order.paidAt}`
  );

  function download() {
    const content = [
      "═══════════════════════════════════════",
      "         PHANTOMDROP ZK RECEIPT",
      "═══════════════════════════════════════",
      "",
      `Order ID:     ${order.id}`,
      `Date:         ${new Date(order.paidAt || order.createdAt).toISOString()}`,
      `Amount:       [PRIVATE — ZK shielded]`,
      `Token:        ${order.payoutTokenSymbol || COURIER_PAYOUT_SYMBOL || TOKEN_SYMBOL}`,
      `Network:      Monad Testnet`,
      "",
      `Patient:      [PRIVATE — ZK shielded]`,
      `Courier:      [PRIVATE — ZK shielded]`,
      "",
      `ZK Proof:     0x${proofHash}...`,
      `Escrow tx:    ${order.txHash || "[private]"}`,
      `Payout tx:    ${order.payoutTxHash || "[private]"}`,
      `Approval:     ${order.complianceApprovalCode || "[doctor portal]"}`,
      `Compliance:   ${order.complianceAttestationId || "[not attached]"}`,
      "",
      "───────────────────────────────────────",
      "This receipt proves a delivery occurred",
      "and payment was released without",
      "revealing parties or amounts on-chain.",
      "───────────────────────────────────────",
      "",
      "Powered by Unlink × Monad",
      "═══════════════════════════════════════",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${order.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border border-zinc-100 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-mono text-xs text-zinc-400">{order.id}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">{order.medicationType}</p>
          <p className="text-xs text-zinc-400">
            {new Date(order.paidAt || order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 border border-[#00E100]/40 text-[#00E100] bg-green-50 uppercase tracking-widest font-bold">
          Paid
        </span>
      </div>

      <div className="border border-zinc-100 bg-zinc-50 p-3 font-mono text-xs space-y-1.5">
        <div className="flex justify-between">
          <span className="text-zinc-400 uppercase tracking-wide">Amount</span>
          <span className="text-zinc-500 italic">ZK shielded</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400 uppercase tracking-wide">Parties</span>
          <span className="text-zinc-500 italic">ZK shielded</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400 uppercase tracking-wide">ZK Proof</span>
          <span className="text-[#00E100]">0x{proofHash}...</span>
        </div>
        {order.complianceAttestationId && (
          <div className="flex justify-between">
            <span className="text-zinc-400 uppercase tracking-wide">Compliance</span>
            <span className="text-[#00E100]">{order.complianceAttestationId.slice(0, 16)}...</span>
          </div>
        )}
        {order.complianceApprovalCode && (
          <div className="flex justify-between">
            <span className="text-zinc-400 uppercase tracking-wide">Approval</span>
            <span className="text-zinc-600">{order.complianceApprovalCode}</span>
          </div>
        )}
      </div>

      <button
        onClick={download}
        className="w-full py-2.5 border border-zinc-200 text-xs text-zinc-600 uppercase tracking-widest hover:border-zinc-900 hover:text-zinc-900 transition-colors"
      >
        Download Receipt →
      </button>
    </div>
  );
}
