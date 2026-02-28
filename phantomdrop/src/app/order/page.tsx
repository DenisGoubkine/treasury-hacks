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
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Order Approved Medication</h1>
          <p className="text-zinc-400 text-sm">
            Login with MetaMask, choose from doctor-approved medications, then place escrow.
          </p>
        </div>

        {!patientWallet ? (
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-zinc-300">
              Connect your MetaMask wallet to load your profile and approved medications.
            </p>
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className="w-full md:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white"
            >
              {isConnecting ? "Connecting..." : "Connect MetaMask"}
            </button>
            <p className="text-xs text-zinc-500">
              Wallet signature is used for authentication only. No extra funding step required.
            </p>
            {error ? (
              <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 p-3 rounded-xl">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Connected Wallet</p>
              <p className="text-xs font-mono text-zinc-300 break-all">{patientWallet}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                >
                  {isConnecting ? "Switching..." : "Switch Wallet"}
                </button>
                <button
                  type="button"
                  onClick={disconnectSession}
                  className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Disconnect Session
                </button>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <OrderForm patientWallet={patientWallet} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
