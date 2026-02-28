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
  const { activeAccount, refresh, waitForConfirmation } = useUnlink();
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
      setStatus("Waiting for Unlink relay confirmation...");
      await waitForConfirmation(relay.relayId);
      await refresh();

      setStatus("Deposit confirmed.");
      setLastTxHash(txHash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Funding failed.";
      setError(message);
      setStatus("");
    }
  }

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <h3 className="text-white font-semibold">Fund Unlink Private Balance</h3>
      <p className="text-xs text-zinc-400">
        Moves {TOKEN_SYMBOL} from MetaMask into your Unlink private wallet so requests/orders stop failing with
        insufficient balance.
      </p>

      <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono">
        Private balance: {balanceDisplay} {TOKEN_SYMBOL}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder={`Amount in ${TOKEN_SYMBOL}`}
          className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
        />
        <button
          onClick={handleFund}
          disabled={isPending || !activeAccount}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-semibold text-white"
        >
          {isPending ? "Funding..." : "Fund"}
        </button>
      </div>

      {status ? <p className="text-xs text-emerald-400">{status}</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {lastTxHash ? (
        <a
          className="block text-xs text-zinc-400 hover:text-zinc-200 font-mono break-all"
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
