"use client";

import { useEffect, useState } from "react";
import { useUnlink } from "@unlink-xyz/react";
import Navbar from "@/components/Navbar";
import OrderCard from "@/components/OrderCard";
import WalletConnect from "@/components/WalletConnect";
import { getOrdersByPatient } from "@/lib/store";
import { Order } from "@/types";
import Link from "next/link";

export default function DashboardPage() {
  const { activeAccount, ready } = useUnlink();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!activeAccount) return;
    const refresh = () => setOrders(getOrdersByPatient(activeAccount.address));
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [activeAccount]);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">My Orders</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Track your anonymous deliveries
            </p>
          </div>
          <Link
            href="/order"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-medium transition-colors"
          >
            + New Order
          </Link>
        </div>

        {!ready ? (
          <div className="text-center py-16 text-zinc-500 animate-pulse">
            Initializing...
          </div>
        ) : !activeAccount ? (
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
            <p className="text-sm text-zinc-400">
              Connect your wallet to see your orders.
            </p>
            <WalletConnect />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-4xl">📋</p>
            <p className="text-zinc-500">No orders yet.</p>
            <Link
              href="/order"
              className="inline-block px-6 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-medium transition-colors"
            >
              Place your first order
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
