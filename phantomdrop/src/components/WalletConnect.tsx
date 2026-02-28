"use client";

import { useUnlink } from "@unlink-xyz/react";
import { useState } from "react";

interface Props {
  compact?: boolean;
}

export default function WalletConnect({ compact }: Props) {
  const { ready, activeAccount, createWallet, createAccount, clearWallet } =
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

  async function handleDisconnect() {
    setLoading(true);
    try {
      await clearWallet();
      setMnemonic("");
      setShowMnemonic(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="text-xs text-zinc-400 uppercase tracking-widest animate-pulse">
        {compact ? "Loading..." : "Initializing..."}
      </div>
    );
  }

  if (activeAccount) {
    const addr = activeAccount.address;
    const short = `${addr.slice(0, 10)}...${addr.slice(-6)}`;

    if (compact) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 border border-zinc-200 px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E100] shrink-0" />
            <span className="text-xs text-zinc-600">{short}</span>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 uppercase tracking-widest transition-colors"
          >
            {loading ? "..." : "Disconnect"}
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 border border-zinc-200 px-4 py-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E100] shrink-0" />
          <span className="text-xs text-zinc-600">{short}</span>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="w-full py-3 border border-zinc-200 text-xs uppercase tracking-widest text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 transition-colors"
        >
          {loading ? "Disconnecting..." : "Disconnect Wallet"}
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={handleCreate}
        disabled={loading}
        className="text-xs px-4 py-2 bg-[#00E100] text-black font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 transition-colors"
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
        className="w-full py-3.5 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 transition-colors"
      >
        {loading ? "Creating wallet..." : "Create Anonymous Wallet"}
      </button>

      {showMnemonic && (
        <div className="p-4 border border-amber-200 bg-amber-50 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
            Save your recovery phrase
          </p>
          <p className="text-xs text-zinc-700 leading-relaxed break-words border border-zinc-200 bg-white p-3">
            {mnemonic}
          </p>
          <button
            onClick={() => setShowMnemonic(false)}
            className="text-xs text-zinc-400 hover:text-zinc-900 uppercase tracking-widest underline transition-colors"
          >
            I&apos;ve saved it
          </button>
        </div>
      )}
    </div>
  );
}
