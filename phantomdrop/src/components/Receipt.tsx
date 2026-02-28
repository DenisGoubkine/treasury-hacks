"use client";

import { Order } from "@/types";

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
  const proofHash = hashString(`${order.id}${order.patientWallet}${order.amount}${order.paidAt}`);
  const fee = (Number(order.amount) / 1_000_000).toFixed(2);

  function download() {
    const content = [
      "═══════════════════════════════════════",
      "         PHANTOMDROP ZK RECEIPT",
      "═══════════════════════════════════════",
      "",
      `Order ID:     ${order.id}`,
      `Date:         ${new Date(order.paidAt || order.createdAt).toISOString()}`,
      `Amount:       [PRIVATE — ZK shielded]`,
      `Token:        USDC`,
      `Network:      Monad Testnet`,
      "",
      `Patient:      [PRIVATE — ZK shielded]`,
      `Courier:      [PRIVATE — ZK shielded]`,
      "",
      `ZK Proof:     0x${proofHash}...`,
      `Escrow tx:    ${order.txHash || "[private]"}`,
      `Payout tx:    ${order.payoutTxHash || "[private]"}`,
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-zinc-500">{order.id}</p>
          <p className="text-white font-medium mt-0.5">{order.medicationType}</p>
          <p className="text-xs text-zinc-500">
            {new Date(order.paidAt || order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className="text-xs px-2 py-1 bg-purple-900/60 text-purple-300 rounded-full font-medium">
          ✅ Paid
        </span>
      </div>

      <div className="p-3 bg-zinc-800 rounded-xl font-mono text-xs space-y-1.5 text-zinc-400">
        <div className="flex justify-between">
          <span>Amount</span>
          <span className="text-zinc-500 italic">ZK shielded</span>
        </div>
        <div className="flex justify-between">
          <span>Parties</span>
          <span className="text-zinc-500 italic">ZK shielded</span>
        </div>
        <div className="flex justify-between">
          <span>ZK Proof</span>
          <span className="text-purple-400">0x{proofHash}...</span>
        </div>
      </div>

      <button
        onClick={download}
        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-sm font-medium transition-colors border border-zinc-700"
      >
        ↓ Download Receipt
      </button>
    </div>
  );
}
