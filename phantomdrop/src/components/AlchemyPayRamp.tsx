"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ALCHEMY_PAY_APP_ID,
  ALCHEMY_PAY_RAMP_URL,
  TOKEN_SYMBOL,
} from "@/lib/constants";
import { formatTokenAmount } from "@/lib/tokenFormat";

interface Props {
  walletAddress: string;
  amount: bigint;
  onComplete: () => void;
  onCancel: () => void;
}

type RampState = "ready" | "waiting" | "complete";

export default function AlchemyPayRamp({ walletAddress, amount, onComplete, onCancel }: Props) {
  const [state, setState] = useState<RampState>("ready");
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const fiatEstimate = formatTokenAmount(amount, 6);
  const hasAppId = Boolean(ALCHEMY_PAY_APP_ID);

  const rampUrl = hasAppId
    ? `${ALCHEMY_PAY_RAMP_URL}/?appId=${ALCHEMY_PAY_APP_ID}&crypto=${TOKEN_SYMBOL}&network=MONAD&address=${walletAddress}&fiat=USD&fiatAmount=${fiatEstimate}`
    : "";

  const handleComplete = useCallback(() => {
    setState("complete");
    onComplete();
  }, [onComplete]);

  // Auto-complete after simulated delay in demo mode
  useEffect(() => {
    if (state === "waiting" && !hasAppId) {
      const timer = setTimeout(() => handleComplete(), 2000);
      return () => clearTimeout(timer);
    }
  }, [state, hasAppId, handleComplete]);

  // Live mode: render Alchemy Pay iframe
  if (hasAppId) {
    return (
      <div className="space-y-4">
        <div className="border border-zinc-100 bg-zinc-50 px-5 py-4 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Fiat On-Ramp</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Complete your payment below using Visa, Venmo, PayPal, or other methods.
            Funds will be converted to {TOKEN_SYMBOL} and deposited to your wallet.
          </p>
        </div>

        <div className="relative border border-zinc-200 bg-white overflow-hidden" style={{ minHeight: 520 }}>
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-zinc-400 uppercase tracking-widest animate-pulse">Loading payment portal...</p>
            </div>
          )}
          <iframe
            src={rampUrl}
            title="Alchemy Pay"
            className="w-full border-0"
            style={{ height: 520 }}
            onLoad={() => setIframeLoaded(true)}
            allow="payment; camera"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleComplete}
            className="flex-1 py-3 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-colors"
          >
            I&apos;ve completed payment
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-zinc-200 text-zinc-500 text-xs font-bold uppercase tracking-widest hover:border-zinc-900 hover:text-zinc-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Demo mode: simulated on-ramp
  return (
    <div className="space-y-4">
      <div className="border border-zinc-100 bg-zinc-50 px-5 py-4 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Fiat On-Ramp — Powered by Alchemy Pay</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Pay with your preferred method. Alchemy Pay converts your payment to {TOKEN_SYMBOL} and deposits it directly into the privacy escrow.
        </p>
      </div>

      {state === "ready" && (
        <div className="border border-zinc-200 bg-white p-6 space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Select payment method</p>

            {[
              { name: "Visa / Mastercard", icon: "💳", desc: "Credit or debit card" },
              { name: "Venmo", icon: "📱", desc: "Pay with Venmo balance" },
              { name: "PayPal", icon: "🅿️", desc: "PayPal checkout" },
              { name: "Apple Pay", icon: "🍎", desc: "Quick tap to pay" },
            ].map((method) => (
              <button
                key={method.name}
                type="button"
                onClick={() => setState("waiting")}
                className="w-full flex items-center gap-4 border border-zinc-200 px-4 py-3.5 hover:border-zinc-900 transition-colors text-left group"
              >
                <span className="text-lg">{method.icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">{method.name}</p>
                  <p className="text-xs text-zinc-400">{method.desc}</p>
                </div>
                <span className="text-xs text-zinc-300 group-hover:text-zinc-900 transition-colors">&rarr;</span>
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-100 pt-4 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Amount</span>
            <span className="text-xs font-bold text-zinc-900">{fiatEstimate} {TOKEN_SYMBOL}</span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 border border-zinc-200 text-zinc-500 text-xs uppercase tracking-widest hover:border-zinc-900 hover:text-zinc-900 transition-colors"
          >
            Back to payment options
          </button>
        </div>
      )}

      {state === "waiting" && (
        <div className="border border-[#00E100]/30 bg-green-50 p-6 text-center space-y-3">
          <span className="inline-block w-2 h-2 rounded-full bg-[#00E100] animate-pulse" />
          <p className="text-xs font-bold uppercase tracking-widest text-green-700">Processing payment...</p>
          <p className="text-xs text-zinc-500">
            Alchemy Pay is converting your fiat payment to {TOKEN_SYMBOL} and depositing it into the privacy escrow.
          </p>
        </div>
      )}

      {state === "complete" && (
        <div className="border border-[#00E100]/30 bg-green-50 p-6 text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#00E100]">Payment received</p>
          <p className="text-xs text-zinc-500">
            {fiatEstimate} {TOKEN_SYMBOL} deposited. Proceeding to secure escrow...
          </p>
        </div>
      )}
    </div>
  );
}
