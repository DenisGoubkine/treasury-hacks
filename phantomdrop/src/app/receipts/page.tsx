"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "ethers";

import Navbar from "@/components/Navbar";
import Receipt from "@/components/Receipt";
import { getOrders } from "@/lib/store";
import { hashWalletIdentity } from "@/lib/identity";
import { Order } from "@/types";

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

export default function ReceiptsPage() {
  const [wallet, setWallet] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [receipts, setReceipts] = useState<Order[]>([]);

  const connectWallet = useCallback(async () => {
    setError("");
    setIsConnecting(true);
    try {
      const provider = getEthereumProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts?.[0];
      if (!account) {
        throw new Error("No MetaMask account selected.");
      }
      setWallet(getAddress(account));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not connect MetaMask";
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const provider = getEthereumProvider();
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        if (cancelled) return;
        if (accounts?.[0]) {
          setWallet(getAddress(accounts[0]));
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
        setWallet("");
        setReceipts([]);
        return;
      }
      try {
        setWallet(getAddress(accounts[0]));
      } catch {
        setWallet(accounts[0]);
      }
    };

    provider.on("accountsChanged", onAccountsChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!wallet) return;
    const normalized = wallet.toLowerCase();
    const walletHash = hashWalletIdentity(normalized).toLowerCase();
    const paid = getOrders().filter((o) => {
      if (o.status !== "paid") return false;
      const patientMatch =
        (o.patientWallet || "").toLowerCase() === normalized ||
        (o.patientWalletHash || "").toLowerCase() === walletHash;
      const courierMatch = (o.courierWallet || "").toLowerCase() === normalized;
      return patientMatch || courierMatch;
    });
    setReceipts(paid);
  }, [wallet]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Patient portal</p>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">ZK Receipts</h1>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wide">
            Proof of payment without revealing parties or amounts on-chain.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        {!wallet ? (
          <div className="border border-zinc-100 p-8 max-w-md space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-2">Connect your wallet</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect MetaMask to view your ZK receipts for completed transactions.
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
        ) : receipts.length === 0 ? (
          <div className="border border-zinc-100 py-20 text-center">
            <p className="text-xs uppercase tracking-widest text-zinc-300">No completed transactions yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-zinc-100 bg-zinc-50 px-5 py-4 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Privacy Note</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                These receipts prove payments occurred without revealing parties, amounts, or
                medication details on-chain. Download and store securely.
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
