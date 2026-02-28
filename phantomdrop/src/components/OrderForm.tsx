"use client";

import { useState } from "react";
import { useUnlink, useSend } from "@unlink-xyz/react";
import { useRouter } from "next/navigation";
import {
  DELIVERY_FEE,
  MEDICATION_CATEGORIES,
  PLATFORM_UNLINK_ADDRESS,
  TOKEN_ADDRESS,
} from "@/lib/constants";
import { generateOrderId, saveOrder } from "@/lib/store";
import { MedicationCategory, Order } from "@/types";

export default function OrderForm() {
  const router = useRouter();
  const { activeAccount } = useUnlink();
  const { send, isPending } = useSend();

  const [medicationType, setMedicationType] = useState<MedicationCategory>(
    "Prescription Refill"
  );
  const [dropLocation, setDropLocation] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;
    if (!dropLocation.trim()) {
      setError("Please enter a drop-off location.");
      return;
    }
    setError("");

    try {
      const result = await send([
        {
          token: TOKEN_ADDRESS,
          recipient: PLATFORM_UNLINK_ADDRESS,
          amount: DELIVERY_FEE,
        },
      ]);

      const order: Order = {
        id: generateOrderId(),
        medicationType,
        dropLocation: dropLocation.trim(),
        amount: DELIVERY_FEE.toString(),
        patientWallet: activeAccount.address,
        status: "funded",
        createdAt: Date.now(),
        fundedAt: Date.now(),
        txHash: result.relayId ?? undefined,
      };

      saveOrder(order);
      router.push("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setError(msg);
    }
  }

  const feeDisplay = (Number(DELIVERY_FEE) / 1_000_000).toFixed(2);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Medication Type */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">
          Medication Category
        </label>
        <select
          value={medicationType}
          onChange={(e) => setMedicationType(e.target.value as MedicationCategory)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
        >
          {MEDICATION_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          Only you and the pharmacy know what&apos;s inside.
        </p>
      </div>

      {/* Drop Location */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">
          Drop-off Location
        </label>
        <input
          type="text"
          value={dropLocation}
          onChange={(e) => setDropLocation(e.target.value)}
          placeholder="123 Main St, Apt 4B or GPS coordinates"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
          required
        />
        <p className="text-xs text-zinc-500">
          Only your assigned courier will see this. No name attached.
        </p>
      </div>

      {/* Fee Display */}
      <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-700 flex items-center justify-between">
        <span className="text-sm text-zinc-400">Delivery Fee (escrowed)</span>
        <span className="font-semibold text-white">{feeDisplay} USDC</span>
      </div>

      <div className="p-3 bg-zinc-900/50 rounded-xl border border-purple-900/40 text-xs text-zinc-400 space-y-1">
        <p className="text-purple-400 font-medium">🔒 Privacy guarantee</p>
        <p>Payment goes to an anonymous escrow. Your identity is never revealed. Funds release only when AI confirms delivery.</p>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !activeAccount}
        className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-colors text-base"
      >
        {isPending ? "Processing payment..." : `Pay Anonymously — ${feeDisplay} USDC`}
      </button>
    </form>
  );
}
