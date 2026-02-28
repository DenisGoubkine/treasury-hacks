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
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">ZK Receipts</h1>
          <p className="text-zinc-400 text-sm">
            Proof of payment without revealing parties or amounts on-chain.
          </p>
        </div>

        {!wallet ? (
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
            <p className="text-sm text-zinc-400">Connect your wallet to view receipts.</p>
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className="w-full md:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white"
            >
              {isConnecting ? "Connecting..." : "Connect MetaMask"}
            </button>
            {error ? (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 p-3 rounded-xl">
                {error}
              </p>
            ) : null}
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
