"use client";

import Navbar from "@/components/Navbar";
import OrderForm from "@/components/OrderForm";
import WalletConnect from "@/components/WalletConnect";
import { useUnlink } from "@unlink-xyz/react";

export default function OrderPage() {
  const { activeAccount, ready } = useUnlink();

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Place Anonymous Order</h1>
          <p className="text-zinc-400 text-sm">
            No account required. No name attached. Private stablecoin escrow.
          </p>
        </div>

        {!ready ? (
          <div className="text-center py-16 text-zinc-500 animate-pulse">
            Initializing...
          </div>
        ) : !activeAccount ? (
          <div className="space-y-4">
            <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
              <p className="text-sm text-zinc-400">
                Connect an anonymous wallet to place your order. No email, no ID required.
              </p>
              <WalletConnect />
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <OrderForm />
          </div>
        )}
      </main>
    </div>
  );
}
