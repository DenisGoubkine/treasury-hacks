"use client";

import { useState } from "react";
import Link from "next/link";

async function clearBrowserState(): Promise<void> {
  if (typeof window === "undefined") return;

  const phantomdropKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("phantomdrop")) {
      phantomdropKeys.push(key);
    }
  }

  for (const key of phantomdropKeys) {
    window.localStorage.removeItem(key);
  }

  window.sessionStorage.clear();

  if ("indexedDB" in window) {
    const dbNames = new Set<string>(["unlink-wallet"]);
    const dbListApi = indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string }>>;
    };
    if (dbListApi.databases) {
      try {
        const dbs = await dbListApi.databases();
        for (const db of dbs) {
          const name = db?.name || "";
          if (name && (name.startsWith("unlink") || name.startsWith("phantomdrop"))) {
            dbNames.add(name);
          }
        }
      } catch {
        // Ignore browser support issues and still clear default name.
      }
    }

    await Promise.all(
      Array.from(dbNames).map(
        (name) =>
          new Promise<void>((resolve) => {
            try {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            } catch {
              resolve();
            }
          })
      )
    );
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

export default function ResetPage() {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleReset() {
    setState("working");
    setMessage("Clearing orders, doctor profile, and Unlink wallet cache...");
    try {
      await clearBrowserState();
      setState("done");
      setMessage("Cache cleared. App is now fresh. MetaMask wallets remain the same.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Reset failed.");
    }
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 px-6 py-16">
      <div className="max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Reset Local App State</h1>
        <p className="text-sm text-zinc-400">
          This clears local PhantomDrop browser state only: orders, profiles, Unlink wallet cache, and browser cache for this site.
        </p>
        <p className="text-sm text-zinc-500">
          MetaMask accounts and balances are not changed.
        </p>

        <button
          type="button"
          onClick={handleReset}
          disabled={state === "working"}
          className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 font-semibold"
        >
          {state === "working" ? "Clearing..." : "Clear Everything (Local)"}
        </button>

        {message ? (
          <p
            className={`text-sm rounded-lg p-3 border ${
              state === "error"
                ? "text-red-300 bg-red-950/30 border-red-800/40"
                : "text-zinc-300 bg-zinc-950 border-zinc-800"
            }`}
          >
            {message}
          </p>
        ) : null}

        <Link
          href="/"
          className="block text-center text-sm text-zinc-300 hover:text-white underline"
        >
          Back to app
        </Link>
      </div>
    </main>
  );
}
