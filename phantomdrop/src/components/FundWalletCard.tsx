"use client";

import { useMemo, useState } from "react";
import { useDeposit, useUnlink, useUnlinkBalance } from "@unlink-xyz/react";
import { formatUnits, parseUnits } from "ethers";

import {
  MONAD_CHAIN_ID_HEX,
  MONAD_TESTNET_EXPLORER_URL,
  MONAD_TESTNET_RPC_URL,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
} from "@/lib/constants";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHttp404Error(error: unknown): boolean {
  const status = Number((error as { status?: number })?.status ?? 0);
  const message = error instanceof Error ? error.message : String(error);
  return status === 404 || message.includes("HTTP 404");
}

function getEthereumProvider(): Eip1193Provider {
  const provider = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) {
    throw new Error("MetaMask not detected. Install MetaMask to fund your Unlink wallet.");
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

async function waitForTxReceipt(provider: Eip1193Provider, txHash: string): Promise<void> {
  for (let i = 0; i < 180; i += 1) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status?: string } | null;
    if (receipt?.status) {
      if (receipt.status === "0x1") return;
      throw new Error("MetaMask transaction reverted.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for MetaMask transaction receipt.");
}

export default function FundWalletCard() {
  const { activeAccount, refresh, getTxStatus } = useUnlink();
  const { deposit, isPending } = useDeposit();
  const { balance } = useUnlinkBalance(TOKEN_ADDRESS);

  const [amountInput, setAmountInput] = useState("0.01");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const balanceDisplay = useMemo(
    () => formatUnits(balance, TOKEN_DECIMALS),
    [balance]
  );

  async function waitForRelayWith404Tolerance(relayId: string): Promise<void> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      try {
        const status = await getTxStatus(relayId);
        if (status.state === "succeeded") {
          return;
        }
        if (status.state === "reverted" || status.state === "failed" || status.state === "dead") {
          throw new Error(status.error || `Transaction ${status.state}`);
        }
      } catch (error) {
        if (!isHttp404Error(error)) {
          throw error;
        }
      }
      await sleep(2000);
    }
    throw new Error("Timed out waiting for Unlink to index this deposit.");
  }

  async function handleRefreshBalance() {
    setError("");
    setStatus("Refreshing private balance...");
    try {
      await refresh();
      setStatus("Private balance refreshed.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Refresh failed.";
      setError(message);
      setStatus("");
    }
  }

  async function handleFund() {
    if (!activeAccount) {
      setError("Connect Unlink wallet first.");
      return;
    }

    setStatus("");
    setError("");
    setLastTxHash(null);

    try {
      const amount = parseUnits(amountInput.trim(), TOKEN_DECIMALS);
      if (amount <= BigInt(0)) {
        throw new Error("Enter amount greater than 0.");
      }

      const provider = getEthereumProvider();
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const depositor = accounts?.[0];
      if (!depositor) {
        throw new Error("No MetaMask account selected.");
      }

      await ensureMonadTestnet(provider);
      setStatus("Preparing Unlink deposit...");
      const relay = await deposit([{ token: TOKEN_ADDRESS, amount, depositor }]);

      setStatus("Confirming MetaMask transaction...");
      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: depositor,
            to: relay.to,
            data: relay.calldata,
            value: `0x${relay.value.toString(16)}`,
          },
        ],
      })) as string;

      await waitForTxReceipt(provider, txHash);
      setStatus("Finalizing private balance in Unlink...");
      await waitForRelayWith404Tolerance(relay.relayId);
      await refresh();
      setStatus("Deposit confirmed and private balance updated.");
      setLastTxHash(txHash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Funding failed.";
      if (isHttp404Error(err)) {
        setError(
          "Deposit was submitted, but Unlink indexer is still syncing. Wait 15-60s, then press Refresh Balance."
        );
        setStatus("Deposit submitted. Waiting for indexer sync.");
      } else {
        setError(message);
        setStatus("");
      }
    }
  }

  return (
    <div className="border border-zinc-100 p-5 space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-900 mb-1">Fund Private Balance</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          MetaMask and Unlink private balances are separate. Move {TOKEN_SYMBOL} from MetaMask into your private Unlink balance used by this app.
        </p>
      </div>

      <div className="border border-zinc-100 bg-zinc-50 px-4 py-3 space-y-1">
        <p className="text-xs text-zinc-500">1. MetaMask holds your normal on-chain funds.</p>
        <p className="text-xs text-zinc-500">2. Unlink holds encrypted private funds.</p>
        <p className="text-xs text-zinc-500">3. Deposit once before private sends can work.</p>
      </div>

      <div className="border border-zinc-100 bg-zinc-50 px-4 py-3 font-mono text-xs text-zinc-600">
        Private balance: {balanceDisplay} {TOKEN_SYMBOL}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder={`Amount in ${TOKEN_SYMBOL}`}
          className="flex-1 bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
        <button
          onClick={handleFund}
          disabled={isPending || !activeAccount}
          className="px-4 py-2.5 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 transition-colors"
        >
          {isPending ? "Funding..." : "Fund"}
        </button>
      </div>

      <button
        onClick={handleRefreshBalance}
        disabled={!activeAccount || isPending}
        className="w-full py-2.5 border border-zinc-200 text-xs text-zinc-500 uppercase tracking-widest hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 transition-colors"
      >
        Refresh Balance
      </button>

      {status ? <p className="text-xs text-[#00E100] uppercase tracking-wide">{status}</p> : null}
      {error ? <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 uppercase tracking-wide">{error}</p> : null}
      {lastTxHash ? (
        <a
          className="block text-xs text-zinc-400 hover:text-zinc-700 font-mono break-all"
          target="_blank"
          rel="noreferrer"
          href={`${MONAD_TESTNET_EXPLORER_URL}/tx/${lastTxHash}`}
        >
          {lastTxHash}
        </a>
      ) : null}
    </div>
  );
}
