"use client";

import { STATUS_LABELS, STATUS_STEPS } from "@/lib/constants";
import { OrderStatus } from "@/types";

interface Props {
  status: OrderStatus;
}

// Re-export from constants for backward compat
export { STATUS_LABELS, STATUS_STEPS };

const STEP_NUMBERS = ["01", "02", "03", "04", "05"];

export default function EscrowStatus({ status }: Props) {
  const isDisputed = status === "disputed";
  const effectiveStatus = isDisputed ? "delivered" : status;
  const currentIndex = STATUS_STEPS.indexOf(effectiveStatus as typeof STATUS_STEPS[number]);

  return (
    <div className="w-full space-y-3">
      <div className="relative flex items-start justify-between">
        {/* Track background */}
        <div className="absolute top-3.5 left-0 right-0 h-px bg-zinc-200" />
        {/* Track fill */}
        <div
          className={`absolute top-3.5 left-0 h-px transition-all duration-500 ${
            isDisputed ? "bg-red-400" : "bg-[#00E100]"
          }`}
          style={{ width: `${(currentIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
        />

        {STATUS_STEPS.map((step, i) => {
          const done = i <= currentIndex;
          const active = i === currentIndex;
          return (
            <div key={step} className="flex flex-col items-center gap-2 z-10">
              <div
                className={`w-7 h-7 flex items-center justify-center transition-colors ${
                  done
                    ? active && isDisputed
                      ? "bg-red-600 border border-red-600"
                      : active
                      ? "bg-[#00E100] border border-[#00E100]"
                      : "bg-zinc-900 border border-zinc-900"
                    : "bg-white border border-zinc-200"
                }`}
              >
                <span
                  className={`text-[9px] font-bold tracking-widest ${
                    done ? "text-white" : "text-zinc-300"
                  }`}
                >
                  {active && isDisputed ? "!" : STEP_NUMBERS[i]}
                </span>
              </div>
              <span
                className={`text-[9px] text-center max-w-[64px] leading-tight uppercase tracking-widest font-bold ${
                  active && isDisputed
                    ? "text-red-600"
                    : active
                    ? "text-zinc-900"
                    : done
                    ? "text-zinc-500"
                    : "text-zinc-300"
                }`}
              >
                {active && isDisputed ? "Disputed" : STATUS_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>

      {isDisputed && (
        <div className="flex items-center gap-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <p className="text-[10px] text-red-600 uppercase tracking-widest font-bold">
            Dispute under review — escrow funds held
          </p>
        </div>
      )}
    </div>
  );
}
