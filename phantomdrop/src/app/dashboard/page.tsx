"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "ethers";
import Navbar from "@/components/Navbar";
import OrderCard from "@/components/OrderCard";
import { getOrdersByPatient } from "@/lib/store";
import {
  MONAD_CHAIN_ID_HEX,
  MONAD_FINALITY_MS,
  MONAD_TESTNET_EXPLORER_URL,
  MONAD_TESTNET_RPC_URL,
} from "@/lib/constants";
import { Order } from "@/types";
import Link from "next/link";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getEthereumProvider(): Eip1193Provider {
  const provider = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) {
    throw new Error("MetaMask not detected. Install MetaMask to continue.");
  }
  return provider;
}

async function ensureMonadTestnet(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_CHAIN_ID_HEX }],
    });
  } catch (error) {
    const code = Number((error as { code?: number })?.code ?? 0);
    if (code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: MONAD_CHAIN_ID_HEX,
          chainName: "Monad Testnet",
          nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
          rpcUrls: [MONAD_TESTNET_RPC_URL],
          blockExplorerUrls: [MONAD_TESTNET_EXPLORER_URL],
        },
      ],
    });
  }
}

export default function DashboardPage() {
  const [patientWallet, setPatientWallet] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);

  const connectWallet = useCallback(async () => {
    setError("");
    setIsConnecting(true);
    try {
      const provider = getEthereumProvider();
      await ensureMonadTestnet(provider);
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const account = accounts?.[0];
      if (!account) {
        throw new Error("No MetaMask account selected.");
      }
      setPatientWallet(getAddress(account));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not connect MetaMask";
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectSession = useCallback(() => {
    setPatientWallet("");
    setOrders([]);
    setError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const provider = getEthereumProvider();
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        if (cancelled) return;
        if (accounts?.[0]) {
          setPatientWallet(getAddress(accounts[0]));
        }
      } catch {
        // Ignore provider errors during initial detection.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const provider = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
    if (!provider?.on || !provider.removeListener) {
      return;
    }

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = (args?.[0] as string[]) || [];
      if (!accounts[0]) {
        setPatientWallet("");
        setOrders([]);
        return;
      }
      try {
        setPatientWallet(getAddress(accounts[0]));
      } catch {
        setPatientWallet(accounts[0]);
      }
    };

    provider.on("accountsChanged", onAccountsChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!patientWallet) return;
    const refresh = () => setOrders(getOrdersByPatient(patientWallet));
    refresh();
    const interval = setInterval(refresh, MONAD_FINALITY_MS);
    return () => clearInterval(interval);
  }, [patientWallet]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Patient portal</p>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">My Orders</h1>
          </div>
          <Link
            href="/order"
            className="px-6 py-3 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-colors"
          >
            + New Order
          </Link>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {!patientWallet ? (
          <div className="border border-zinc-100 p-8 max-w-md space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-2">Connect your wallet</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect MetaMask to view your order history and track deliveries.
              </p>
            </div>
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className="px-8 py-3.5 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 transition-colors"
            >
              {isConnecting ? "Connecting..." : "Connect MetaMask →"}
            </button>
            {error ? (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 uppercase tracking-wide">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Wallet strip */}
            <div className="border border-zinc-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E100]" />
                <span className="text-xs text-zinc-500 uppercase tracking-widest">Connected</span>
                <span className="text-xs text-zinc-400 font-mono ml-2">{patientWallet.slice(0, 14)}...{patientWallet.slice(-6)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 uppercase tracking-widest transition-colors"
                >
                  {isConnecting ? "..." : "Switch"}
                </button>
                <button
                  type="button"
                  onClick={disconnectSession}
                  className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 uppercase tracking-widest transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="border border-zinc-100 py-20 text-center space-y-4">
                <p className="text-xs uppercase tracking-widest text-zinc-300">No orders yet</p>
                <Link
                  href="/order"
                  className="inline-block px-8 py-3.5 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  Place your first order →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
