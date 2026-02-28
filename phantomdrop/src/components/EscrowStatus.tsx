"use client";

import { STATUS_LABELS, STATUS_STEPS } from "@/lib/constants";
import { OrderStatus } from "@/types";

interface Props {
  status: OrderStatus;
}

// Re-export from constants for backward compat
export { STATUS_LABELS, STATUS_STEPS };

const STEP_ICONS: Record<string, string> = {
  pending:    "📋",
  funded:     "💰",
  in_transit: "🚴",
  delivered:  "📦",
  paid:       "✅",
};

export default function EscrowStatus({ status }: Props) {
  const currentIndex = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Progress bar background */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-zinc-100" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-[#00E100] transition-all duration-500"
          style={{ width: `${(currentIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
        />

        {STATUS_STEPS.map((step, i) => {
          const done = i <= currentIndex;
          const active = i === currentIndex;
          return (
            <div key={step} className="flex flex-col items-center gap-1 z-10">
              <div
                className={`w-8 h-8 flex items-center justify-center text-sm transition-all duration-300 border ${
                  done
                    ? active
                      ? "bg-[#00E100] border-[#00E100] scale-110"
                      : "bg-zinc-900 border-zinc-900"
                    : "bg-white border-zinc-200 text-zinc-300"
                }`}
              >
                {STEP_ICONS[step]}
              </div>
              <span
                className={`text-[10px] text-center max-w-[56px] leading-tight uppercase tracking-wide ${
                  done ? "text-zinc-900" : "text-zinc-400"
                }`}
              >
                {STATUS_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
