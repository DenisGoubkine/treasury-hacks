"use client";

import { useState } from "react";
import { updateOrderStatus } from "@/lib/store";

interface Props {
  orderId: string;
  onSuccess: () => void;
}

const REASON_CHIPS = [
  "Package not delivered",
  "Wrong medication",
  "Damaged package",
  "Wrong address",
];

export default function DisputeForm({ orderId, onSuccess }: Props) {
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!selectedChip) return;
    const reason = details.trim()
      ? `${selectedChip}: ${details.trim()}`
      : selectedChip;

    updateOrderStatus(orderId, {
      status: "disputed",
      disputeReason: reason,
      disputeOpenedAt: Date.now(),
      disputeResolution: "none",
    });

    setSubmitted(true);
    onSuccess();
  }

  if (submitted) {
    return (
      <div className="border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Report received</p>
        <p className="text-xs text-zinc-500">
          Your report has been recorded. The platform will review and reach a resolution within 48 hours. Escrow funds are held until then.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">What went wrong?</p>
        <div className="flex flex-wrap gap-2">
          {REASON_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setSelectedChip(selectedChip === chip ? null : chip)}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                selectedChip === chip
                  ? "border-red-400 bg-red-50 text-red-700"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Add details (optional)..."
        rows={3}
        className="w-full bg-white border border-zinc-200 px-4 py-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors resize-none"
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!selectedChip}
        className="w-full py-3 bg-red-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        Submit Dispute
      </button>

      <p className="text-xs text-zinc-400">
        Disputes are reviewed by the platform. Escrow funds will be held until resolution.
      </p>
    </div>
  );
}
