"use client";

import { useEffect, useState } from "react";
import { useUnlink } from "@unlink-xyz/react";
import Navbar from "@/components/Navbar";
import CourierJobCard from "@/components/CourierJobCard";
import WalletConnect from "@/components/WalletConnect";
import DeliveryVerifier from "@/components/DeliveryVerifier";
import { getAvailableOrders, getOrdersByCourier } from "@/lib/store";
import { MONAD_FINALITY_MS, TOKEN_SYMBOL } from "@/lib/constants";
import { formatTokenAmount } from "@/lib/tokenFormat";
import { Order } from "@/types";

export default function CourierPage() {
  const { activeAccount, ready } = useUnlink();
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [available, setAvailable] = useState<Order[]>([]);
  const [myJobs, setMyJobs] = useState<Order[]>([]);
  const [activeVerify, setActiveVerify] = useState<string | null>(null);

  useEffect(() => {
    if (!activeAccount) return;
    const refresh = () => {
      setAvailable(getAvailableOrders());
      setMyJobs(getOrdersByCourier(activeAccount.address));
    };
    refresh();
    const interval = setInterval(refresh, MONAD_FINALITY_MS);
    return () => clearInterval(interval);
  }, [activeAccount]);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Courier Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Deliver anonymously. Get paid automatically.
          </p>
        </div>

        {!ready ? (
          <div className="text-center py-16 text-zinc-500 animate-pulse">Initializing...</div>
        ) : !activeAccount ? (
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
            <p className="text-sm text-zinc-400">
              Connect your Unlink wallet to see available deliveries and receive payments.
            </p>
            <WalletConnect />
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setTab("available")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === "available"
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Available ({available.length})
              </button>
              <button
                onClick={() => setTab("mine")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === "mine"
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                My Deliveries ({myJobs.length})
              </button>
            </div>

            {/* Available deliveries */}
            {tab === "available" && (
              <div className="space-y-4">
                {available.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <p className="text-4xl">🏙️</p>
                    <p className="text-zinc-500">No deliveries available right now.</p>
                    <p className="text-xs text-zinc-600">Orders appear here once funded by patients.</p>
                  </div>
                ) : (
                  available.map((order) => (
                    <CourierJobCard
                      key={order.id}
                      order={order}
                      onAccepted={() => {
                        setAvailable(getAvailableOrders());
                        setMyJobs(getOrdersByCourier(activeAccount.address));
                        setTab("mine");
                      }}
                    />
                  ))
                )}
              </div>
            )}

            {/* My deliveries */}
            {tab === "mine" && (
              <div className="space-y-4">
                {myJobs.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <p className="text-4xl">📭</p>
                    <p className="text-zinc-500">No accepted deliveries yet.</p>
                  </div>
                ) : (
                  myJobs.map((order) => (
                    <div
                      key={order.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-xs text-zinc-500">{order.id}</p>
                          <p className="text-white font-medium mt-0.5">
                            📍 {order.dropLocation}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Payout: {formatTokenAmount(order.amount, 6)} {TOKEN_SYMBOL}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            order.status === "paid"
                              ? "bg-purple-900/60 text-purple-300"
                              : order.status === "delivered"
                              ? "bg-green-900/60 text-green-300"
                              : "bg-amber-900/60 text-amber-300"
                          }`}
                        >
                          {order.status.replace("_", " ")}
                        </span>
                      </div>

                      {order.status === "in_transit" && (
                        <>
                          {activeVerify === order.id ? (
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-zinc-300">
                                Upload delivery photo
                              </p>
                              <DeliveryVerifier
                                orderId={order.id}
                                courierWallet={activeAccount.address}
                                onSuccess={() => {
                                  setActiveVerify(null);
                                  setMyJobs(getOrdersByCourier(activeAccount.address));
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => setActiveVerify(order.id)}
                              className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-white transition-colors"
                            >
                              📸 Mark as Delivered
                            </button>
                          )}
                        </>
                      )}

                      {order.status === "paid" && (
                        <div className="p-3 bg-green-900/20 border border-green-800/40 rounded-xl text-sm text-green-400">
                          ✅ Payment received in your Unlink wallet
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
