"use client";

import { use, useEffect, useState } from "react";
import { useUnlink } from "@unlink-xyz/react";
import Navbar from "@/components/Navbar";
import DeliveryVerifier from "@/components/DeliveryVerifier";
import { getOrderById } from "@/lib/store";
import { Order } from "@/types";
import Link from "next/link";

export default function VerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { activeAccount } = useUnlink();
  const [order, setOrder] = useState<Order | null>(null);
  const [done, setDone] = useState(false);
  const [payoutTx, setPayoutTx] = useState<string | undefined>();

  useEffect(() => {
    const o = getOrderById(id);
    setOrder(o || null);
  }, [id]);

  if (!order) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
          <p className="text-4xl">🔍</p>
          <p className="text-zinc-400">Order not found.</p>
          <Link href="/courier" className="text-purple-400 underline text-sm">
            ← Back to Courier Dashboard
          </Link>
        </main>
      </div>
    );
  }

  const isCourier = activeAccount?.address === order.courierWallet;

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-12 space-y-8">
        <div className="space-y-1">
          <Link href="/courier" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Courier Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Verify Delivery</h1>
          <p className="font-mono text-sm text-zinc-500">{order.id}</p>
        </div>

        {/* Order summary */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Drop location</span>
            <span className="text-zinc-200">{order.dropLocation}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Payout</span>
            <span className="text-green-400 font-semibold">
              {(Number(order.amount) / 1_000_000).toFixed(2)} USDC
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Status</span>
            <span className="text-amber-300">{order.status.replace("_", " ")}</span>
          </div>
        </div>

        {order.status === "paid" || done ? (
          <div className="space-y-4 text-center py-8">
            <div className="text-6xl">✅</div>
            <h2 className="text-2xl font-bold text-green-400">Delivered & Paid!</h2>
            <p className="text-zinc-400">
              Payment has been released to your Unlink wallet.
            </p>
            {payoutTx && (
              <p className="font-mono text-xs text-zinc-500 break-all bg-zinc-900 p-3 rounded-xl">
                {payoutTx}
              </p>
            )}
            <Link
              href="/receipts"
              className="inline-block px-6 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-medium transition-colors mt-2"
            >
              View Receipt
            </Link>
          </div>
        ) : order.status !== "in_transit" ? (
          <div className="text-center py-8 text-zinc-500">
            <p>This order is not in transit yet.</p>
          </div>
        ) : !isCourier ? (
          <div className="text-center py-8 text-zinc-500 space-y-2">
            <p className="text-4xl">🔒</p>
            <p>Only the assigned courier can verify this delivery.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Upload Delivery Photo</h2>
              <p className="text-sm text-zinc-400">
                Take a photo of the package at the doorstep. AI will confirm delivery
                and release payment automatically.
              </p>
            </div>
            <DeliveryVerifier
              orderId={order.id}
              courierWallet={order.courierWallet!}
              onSuccess={(tx) => {
                setPayoutTx(tx);
                setDone(true);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
