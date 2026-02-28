"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "ethers";

import Navbar from "@/components/Navbar";
import OrderForm from "@/components/OrderForm";
import {
  MONAD_CHAIN_ID_HEX,
  MONAD_TESTNET_EXPLORER_URL,
  MONAD_TESTNET_RPC_URL,
} from "@/lib/constants";

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

export default function OrderPage() {
  const [patientWallet, setPatientWallet] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Patient portal</p>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">Order Approved Medication</h1>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-12">

          {/* Left: steps guide */}
          <div className="space-y-8">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-400 mb-6">How it works</p>
              <div className="space-y-6">
                {[
                  { n: "01", title: "Connect wallet", desc: "Authenticate with MetaMask on Monad Testnet." },
                  { n: "02", title: "Select medication", desc: "Choose from medications your doctor has pre-approved." },
                  { n: "03", title: "Place order", desc: "One click. Escrow is funded privately behind the scenes." },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex gap-4">
                    <span className="text-xs text-[#00E100] uppercase tracking-widest shrink-0 pt-0.5">{n}</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-1">{title}</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-6">
              <p className="text-xs uppercase tracking-widest text-zinc-400 mb-3">Privacy</p>
              <p className="text-xs text-zinc-400 leading-relaxed">Your identity is never stored. Wallet used for authentication only. All payment amounts are ZK-shielded on-chain.</p>
            </div>
          </div>

          {/* Right: connect + form */}
          <div className="md:col-span-2">
            {!patientWallet ? (
              <div className="border border-zinc-100 p-8 space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-2">Connect MetaMask</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Connect your wallet to load your approved medications. We&apos;ll switch you to Monad Testnet automatically.
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
              <div className="space-y-0">
                {/* Wallet banner */}
                <div className="border border-zinc-100 border-b-0 px-6 py-4 flex items-center justify-between">
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

                {/* Order form */}
                <div className="border border-zinc-100 p-8">
                  <OrderForm patientWallet={patientWallet} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
