"use client";

import { useUnlink } from "@unlink-xyz/react";
import { useState } from "react";

interface Props {
  compact?: boolean;
}

export default function WalletConnect({ compact }: Props) {
  const { ready, walletExists, activeAccount, createWallet, createAccount } =
    useUnlink();
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      const { mnemonic: m } = await createWallet();
      setMnemonic(m);
      setShowMnemonic(true);
      await createAccount();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="text-xs text-zinc-500 animate-pulse">
        {compact ? "Loading..." : "Initializing wallet..."}
      </div>
    );
  }

  if (activeAccount) {
    const addr = activeAccount.address;
    const short = `${addr.slice(0, 10)}...${addr.slice(-6)}`;
    return (
      <div
        className={`flex items-center gap-2 ${compact ? "" : "px-4 py-2 bg-zinc-900 rounded-xl border border-zinc-700"}`}
      >
        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <span className="text-sm font-mono text-zinc-300">{short}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={handleCreate}
        disabled={loading}
        className="text-sm px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
      >
        {loading ? "Creating..." : "Connect"}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleCreate}
        disabled={loading || !ready}
        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-semibold text-white transition-colors"
      >
        {loading ? "Creating wallet..." : "Create Anonymous Wallet"}
      </button>

      {showMnemonic && (
        <div className="p-4 bg-amber-900/30 border border-amber-600/40 rounded-xl space-y-2">
          <p className="text-amber-400 text-sm font-semibold">
            ⚠️ Save your recovery phrase
          </p>
          <p className="font-mono text-sm text-zinc-200 break-words">
            {mnemonic}
          </p>
          <button
            onClick={() => setShowMnemonic(false)}
            className="text-xs text-zinc-400 hover:text-white underline"
          >
            I&apos;ve saved it
          </button>
        </div>
      )}
    </div>
  );
}
