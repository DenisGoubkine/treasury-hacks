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
import { formatPayoutAmount, quoteCourierPayoutUsdc } from "@/lib/courierSwap";
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
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Courier Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Deliver anonymously on Monad. Get settled in {COURIER_PAYOUT_SYMBOL}.
          </p>
        </div>

        {!courierWallet ? (
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
            <p className="text-sm text-zinc-400">
              Connect your MetaMask wallet to see available deliveries and receive payout settlements.
            </p>
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
        ) : (
          <>
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Courier Wallet</p>
              <p className="text-xs font-mono text-zinc-300 break-all">{courierWallet}</p>
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
                            Payout:{" "}
                            {formatPayoutAmount(
                              order.payoutAmount || quoteCourierPayoutUsdc(order.amount).outputAmountBaseUnits,
                              2
                            )}{" "}
                            {order.payoutTokenSymbol || COURIER_PAYOUT_SYMBOL}
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
                              className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-white transition-colors"
                            >
                              📸 Mark as Delivered
                            </button>
                          )}
                        </>
                      )}

                      {order.status === "paid" && (
                        <div className="p-3 bg-green-900/20 border border-green-800/40 rounded-xl text-sm text-green-400">
                          ✅ Settlement confirmed in {order.payoutTokenSymbol || COURIER_PAYOUT_SYMBOL}
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
