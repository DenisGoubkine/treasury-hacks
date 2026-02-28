"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "ethers";
import Navbar from "@/components/Navbar";
import CourierJobCard from "@/components/CourierJobCard";
import DeliveryVerifier from "@/components/DeliveryVerifier";
import {
  getAvailableOrdersForCourier,
  getOrdersByCourierForCourier,
} from "@/lib/store";
import {
  COURIER_PAYOUT_SYMBOL,
  MONAD_CHAIN_ID_HEX,
  MONAD_FINALITY_MS,
  MONAD_TESTNET_EXPLORER_URL,
  MONAD_TESTNET_RPC_URL,
} from "@/lib/constants";
import { computeOrderBreakdown } from "@/lib/pricing";
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

export default function CourierPage() {
  const [courierWallet, setCourierWallet] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [available, setAvailable] = useState<Order[]>([]);
  const [myJobs, setMyJobs] = useState<Order[]>([]);
  const [activeVerify, setActiveVerify] = useState<string | null>(null);

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
      setCourierWallet(getAddress(account));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not connect MetaMask";
      setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectSession = useCallback(() => {
    setCourierWallet("");
    setAvailable([]);
    setMyJobs([]);
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
          setCourierWallet(getAddress(accounts[0]));
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
        setCourierWallet("");
        setAvailable([]);
        setMyJobs([]);
        return;
      }
      try {
        setCourierWallet(getAddress(accounts[0]));
      } catch {
        setCourierWallet(accounts[0]);
      }
    };

    provider.on("accountsChanged", onAccountsChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!courierWallet) return;
    const refresh = () => {
      setAvailable(getAvailableOrdersForCourier());
      setMyJobs(getOrdersByCourierForCourier(courierWallet));
    };
    refresh();
    const interval = setInterval(refresh, MONAD_FINALITY_MS);
    return () => clearInterval(interval);
  }, [courierWallet]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Courier portal</p>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">Courier Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wide">
            Deliver anonymously on Monad. Get settled in {COURIER_PAYOUT_SYMBOL}.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-6">
        {!courierWallet ? (
          <div className="border border-zinc-100 p-8 max-w-md space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-2">Connect your wallet</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect MetaMask to see available deliveries and receive payout settlements.
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
          <>
            {/* Wallet strip */}
            <div className="border border-zinc-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E100]" />
                <span className="text-xs text-zinc-500 uppercase tracking-widest">Connected</span>
                <span className="text-xs text-zinc-400 font-mono ml-2">{courierWallet.slice(0, 14)}...{courierWallet.slice(-6)}</span>
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

            {/* Tabs */}
            <div className="flex border border-zinc-100">
              <button
                onClick={() => setTab("available")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                  tab === "available"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Available ({available.length})
              </button>
              <button
                onClick={() => setTab("mine")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-l border-zinc-100 transition-colors ${
                  tab === "mine"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:text-zinc-900"
                }`}
              >
                My Deliveries ({myJobs.length})
              </button>
            </div>

            {/* Available deliveries */}
            {tab === "available" && (
              <div className="space-y-3">
                {available.length === 0 ? (
                  <div className="border border-zinc-100 py-20 text-center space-y-3">
                    <p className="text-xs uppercase tracking-widest text-zinc-300">No deliveries available</p>
                    <p className="text-xs text-zinc-400">Orders appear here once funded by patients.</p>
                  </div>
                ) : (
                  available.map((order) => (
                    <CourierJobCard
                      key={order.id}
                      order={order}
                      courierWallet={courierWallet}
                      onAccepted={() => {
                        setAvailable(getAvailableOrdersForCourier());
                        setMyJobs(getOrdersByCourierForCourier(courierWallet));
                        setTab("mine");
                      }}
                    />
                  ))
                )}
              </div>
            )}

            {/* My deliveries */}
            {tab === "mine" && (
              <div className="space-y-3">
                {myJobs.length === 0 ? (
                  <div className="border border-zinc-100 py-20 text-center">
                    <p className="text-xs uppercase tracking-widest text-zinc-300">No accepted deliveries yet</p>
                  </div>
                ) : (
                  myJobs.map((order) => (
                    <div
                      key={order.id}
                      className="border border-zinc-100 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-mono text-xs text-zinc-400">{order.id}</p>
                          <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">
                            {order.dropLocation}
                          </p>
                          <p className="text-xs text-zinc-400">
                            Payout:{" "}
                            {order.courierFeeUsdc || computeOrderBreakdown().courierFeeDisplay}{" "}
                            {COURIER_PAYOUT_SYMBOL}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 uppercase tracking-widest font-bold border ${
                            order.status === "disputed"
                              ? "border-red-300 text-red-600 bg-red-50"
                              : order.status === "paid"
                              ? "border-[#00E100]/40 text-[#00E100] bg-green-50"
                              : order.status === "delivered"
                              ? "border-green-200 text-green-600 bg-green-50"
                              : "border-amber-200 text-amber-600 bg-amber-50"
                          }`}
                        >
                          {order.status.replace("_", " ")}
                        </span>
                      </div>

                      {order.status === "in_transit" && (
                        <>
                          {activeVerify === order.id ? (
                            <div className="space-y-3">
                              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">
                                Upload delivery photo
                              </p>
                              <DeliveryVerifier
                                orderId={order.id}
                                courierWallet={courierWallet}
                                onSuccess={() => {
                                  setActiveVerify(null);
                                  setMyJobs(getOrdersByCourierForCourier(courierWallet));
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => setActiveVerify(order.id)}
                              className="w-full py-3 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-colors"
                            >
                              Mark as Delivered →
                            </button>
                          )}
                        </>
                      )}

                      {order.status === "paid" && (
                        <div className="border border-green-200 bg-green-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-green-700">
                          Unlink settlement confirmed in {order.payoutTokenSymbol || COURIER_PAYOUT_SYMBOL}
                        </div>
                      )}

                      {order.status === "disputed" && (
                        <div className="border border-red-200 bg-red-50 px-4 py-3 space-y-1.5">
                          <p className="text-xs font-bold uppercase tracking-widest text-red-700">Patient dispute open</p>
                          {order.disputeReason && (
                            <p className="text-xs text-zinc-600">{order.disputeReason}</p>
                          )}
                          <p className="text-xs text-zinc-400">
                            Payout held pending resolution. Opened{" "}
                            {order.disputeOpenedAt ? new Date(order.disputeOpenedAt).toLocaleString() : "—"}
                          </p>
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
