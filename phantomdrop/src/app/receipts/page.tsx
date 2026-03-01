"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "ethers";
import { useUnlink } from "@unlink-xyz/react";

import Navbar from "@/components/Navbar";
import Receipt from "@/components/Receipt";
import { getOrders } from "@/lib/store";
import { hashWalletIdentity } from "@/lib/identity";
import { Order } from "@/types";

type ReceiptRole = "patient" | "courier";

interface ReceiptEntry {
  order: Order;
  role: ReceiptRole;
}

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
  const { activeAccount } = useUnlink();
  const [wallet, setWallet] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);

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
    if (!wallet && !activeAccount?.address) return;

    const identityCandidates = new Set<string>();
    if (wallet) identityCandidates.add(wallet.toLowerCase());
    if (activeAccount?.address) identityCandidates.add(activeAccount.address.toLowerCase());

    const candidateHashes = new Set<string>();
    for (const candidate of identityCandidates) {
      candidateHashes.add(hashWalletIdentity(candidate).toLowerCase());
    }

    const paidEntries = getOrders()
      .filter((o) => o.status === "paid")
      .flatMap((o) => {
        const patientWallet = (o.patientWallet || "").toLowerCase();
        const patientHash = (o.patientWalletHash || "").toLowerCase();
        const courierWallet = (o.courierWallet || "").toLowerCase();

        const patientMatch =
          identityCandidates.has(patientWallet) ||
          (patientHash.length > 0 && candidateHashes.has(patientHash));
        const courierMatch = identityCandidates.has(courierWallet);

        const matches: ReceiptEntry[] = [];
        if (patientMatch) matches.push({ order: o, role: "patient" });
        if (courierMatch) matches.push({ order: o, role: "courier" });
        return matches;
      })
      .sort((a, b) => (b.order.paidAt || b.order.createdAt) - (a.order.paidAt || a.order.createdAt));

    setReceipts(paidEntries);
  }, [wallet, activeAccount?.address]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Document portal</p>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">ZK Receipts</h1>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wide">
            Patient insurance receipts and courier tax statements from private Unlink settlement.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        {!wallet && !activeAccount?.address ? (
          <div className="border border-zinc-100 p-8 max-w-md space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-2">Connect your wallet</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect MetaMask or initialize your Unlink wallet to view completed transaction documents.
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
            <div className="border border-[#00E100]/30 bg-green-50 px-5 py-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-green-700">Unlink Settlement Flow</p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                MetaMask signs network transactions, Unlink executes private escrow transfers, and PhantomDrop issues
                role-specific records from that settlement trail.
              </p>
              <p className="text-xs text-zinc-500">
                Patient wallets get compliance/insurance receipts. Courier wallets get PhantomDrop payment statements
                for tax documentation.
              </p>
            </div>
            <div className="border border-zinc-100 bg-zinc-50 px-5 py-4 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Privacy Note</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                These receipts prove payments occurred without revealing parties, amounts, or
                medication details on-chain. Download and store securely.
              </p>
            </div>
            {receipts.map((entry) => (
              <Receipt key={`${entry.order.id}-${entry.role}`} order={entry.order} role={entry.role} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
