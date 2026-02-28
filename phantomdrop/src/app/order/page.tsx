"use client";

import Navbar from "@/components/Navbar";
import OrderForm from "@/components/OrderForm";
import WalletConnect from "@/components/WalletConnect";
import FundWalletCard from "@/components/FundWalletCard";
import { useUnlink } from "@unlink-xyz/react";

export default function OrderPage() {
  const { activeAccount, ready } = useUnlink();

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Book a private delivery</h1>
          <p className="text-zinc-400 text-sm">
            Send wallet request to doctor, receive approval code, then checkout in escrow.
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
                Connect your wallet to start. You can place an order in a few steps.
              </p>
              <WalletConnect />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FundWalletCard />
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <OrderForm />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
