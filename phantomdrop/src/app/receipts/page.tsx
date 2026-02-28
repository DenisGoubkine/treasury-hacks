"use client";

import { useEffect, useState } from "react";
import { useUnlink } from "@unlink-xyz/react";
import Navbar from "@/components/Navbar";
import Receipt from "@/components/Receipt";
import WalletConnect from "@/components/WalletConnect";
import { getOrders } from "@/lib/store";
import { Order } from "@/types";

export default function ReceiptsPage() {
  const { activeAccount, ready } = useUnlink();
  const [receipts, setReceipts] = useState<Order[]>([]);

  useEffect(() => {
    if (!activeAccount) return;
    const paid = getOrders().filter(
      (o) =>
        o.status === "paid" &&
        (o.patientWallet === activeAccount.address ||
          o.courierWallet === activeAccount.address)
    );
    setReceipts(paid);
  }, [activeAccount]);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">ZK Receipts</h1>
          <p className="text-zinc-400 text-sm">
            Proof of payment without revealing parties or amounts on-chain.
          </p>
        </div>

        {!ready ? (
          <div className="text-center py-16 text-zinc-500 animate-pulse">Initializing...</div>
        ) : !activeAccount ? (
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
            <p className="text-sm text-zinc-400">Connect your wallet to view receipts.</p>
            <WalletConnect />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-4xl">🧾</p>
            <p className="text-zinc-500">No completed transactions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900/50 border border-purple-900/30 rounded-xl text-xs text-zinc-400 space-y-1">
              <p className="text-purple-400 font-medium">🔒 Privacy Note</p>
              <p>
                These receipts prove payments occurred without revealing parties, amounts,
                or medication details on-chain. Download and store securely.
              </p>
            </div>
            {receipts.map((order) => (
              <Receipt key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
