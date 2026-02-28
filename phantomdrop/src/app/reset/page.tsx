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
  const [adminKey, setAdminKey] = useState("");

  async function handleLocalReset() {
    setState("working");
    setMessage("Clearing local orders, doctor profile, and Unlink wallet cache...");
    try {
      await clearBrowserState();
      setState("done");
      setMessage("Local cache cleared. App is fresh in this browser. MetaMask wallets remain unchanged.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Reset failed.");
    }
  }

  async function handleGlobalReset() {
    setState("working");
    setMessage("Clearing local browser cache and server beta data...");
    try {
      await clearBrowserState();

      const response = await fetch("/api/compliance/admin/reset", {
        method: "POST",
        headers: {
          "x-compliance-admin-key": adminKey.trim(),
        },
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Server reset failed");
      }

      setState("done");
      setMessage(
        "Global beta reset complete. Local browser state and server-side compliance cache were reset."
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Global reset failed.");
    }
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 px-6 py-16">
      <div className="max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Reset Local App State</h1>
        <p className="text-sm text-zinc-400">
          Use local reset for your browser only, or global reset for local + server beta state.
        </p>
        <p className="text-sm text-zinc-500">
          MetaMask accounts and balances are not changed.
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleLocalReset}
            disabled={state === "working"}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 font-semibold"
          >
            {state === "working" ? "Clearing..." : "Clear Everything (Local Browser)"}
          </button>

          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Compliance admin key (for global reset)"
            className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500"
          />

          <button
            type="button"
            onClick={handleGlobalReset}
            disabled={state === "working" || !adminKey.trim()}
            className="w-full py-3 rounded-xl bg-zinc-100 text-black hover:bg-white disabled:opacity-50 font-semibold"
          >
            {state === "working" ? "Resetting..." : "Clear Local + Server (Global Beta Reset)"}
          </button>
        </div>

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
