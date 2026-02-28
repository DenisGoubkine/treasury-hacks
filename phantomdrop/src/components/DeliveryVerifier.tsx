"use client";

import { useState } from "react";
import { updateOrderStatus, getOrderById } from "@/lib/store";
import { verifyDelivery } from "@/lib/openai";
import {
  buildCourierSwapReference,
  formatPayoutAmount,
  quoteCourierPayoutUsdc,
} from "@/lib/courierSwap";
import { COURIER_PAYOUT_SYMBOL } from "@/lib/constants";
import PhotoUploader from "./PhotoUploader";

interface Props {
  orderId: string;
  courierWallet: string;
  onSuccess: (txHash?: string) => void;
}

type VerifyState = "idle" | "verifying" | "verified" | "rejected" | "swapping" | "done" | "error";

export default function DeliveryVerifier({ orderId, courierWallet, onSuccess }: Props) {
  const [photo, setPhoto] = useState<{ base64: string; url: string } | null>(null);
  const [state, setState] = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleVerify() {
    if (!photo) return;
    setState("verifying");
    setErrorMsg("");

    try {
      const verified = await verifyDelivery(photo.base64);

      // Save photo to order
      updateOrderStatus(orderId, { deliveryPhotoUrl: photo.url });

      if (!verified) {
        updateOrderStatus(orderId, { aiVerificationResult: false });
        setState("rejected");
        return;
      }

      updateOrderStatus(orderId, { aiVerificationResult: true, status: "delivered", deliveredAt: Date.now() });
      setState("swapping");

      const order = getOrderById(orderId);
      if (!order) {
        throw new Error("Order not found for payout.");
      }
      const quote = quoteCourierPayoutUsdc(order.amount);
      const txHash = buildCourierSwapReference(orderId, courierWallet);

      // Simulate swap/settlement round-trip for user feedback.
      await new Promise((resolve) => setTimeout(resolve, 900));

      updateOrderStatus(orderId, {
        status: "paid",
        paidAt: Date.now(),
        payoutTxHash: txHash,
        payoutTokenSymbol: quote.outputTokenSymbol,
        payoutAmount: quote.outputAmountBaseUnits,
        payoutSwapRate: quote.rate,
        payoutSwapReference: txHash,
      });

      setState("done");
      onSuccess(txHash);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Verification failed";
      setErrorMsg(msg);
      setState("error");
    }
  }

  function handlePhoto(base64: string, url: string) {
    setPhoto({ base64, url });
    setState("idle");
  }

  if (state === "done") {
    const order = getOrderById(orderId);
    return (
      <div className="space-y-4 text-center py-8">
        <div className="text-6xl animate-bounce">✅</div>
        <h3 className="text-xl font-bold text-green-400">Delivery Confirmed!</h3>
        <p className="text-zinc-400">
          Payment settled to courier wallet in {order?.payoutTokenSymbol || COURIER_PAYOUT_SYMBOL}.
        </p>
        {order?.payoutAmount ? (
          <p className="text-sm text-zinc-300">
            {formatPayoutAmount(order.payoutAmount, 2)} {order.payoutTokenSymbol || COURIER_PAYOUT_SYMBOL}
          </p>
        ) : null}
        {order?.payoutTxHash && (
          <p className="font-mono text-xs text-zinc-500 break-all">{order.payoutTxHash}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PhotoUploader onPhoto={handlePhoto} />

      {photo && state !== "verifying" && state !== "swapping" && (
        <button
          onClick={handleVerify}
          disabled={!courierWallet}
          className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-semibold text-white transition-colors"
        >
          Verify Delivery with AI
        </button>
      )}

      {state === "verifying" && (
        <div className="text-center py-4 space-y-2">
          <div className="text-3xl animate-spin inline-block">🔍</div>
          <p className="text-zinc-400">AI analyzing delivery photo...</p>
        </div>
      )}

      {state === "swapping" && (
        <div className="text-center py-4 space-y-2">
          <div className="text-3xl animate-pulse">💸</div>
          <p className="text-zinc-400">Swapping escrow value to USDC and settling payout...</p>
        </div>
      )}

      {state === "rejected" && (
        <div className="p-4 bg-red-900/20 border border-red-800/40 rounded-xl space-y-2">
          <p className="text-red-400 font-semibold">❌ Package not detected</p>
          <p className="text-sm text-zinc-400">
            AI could not confirm a package at the doorstep. Please retake the photo.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="p-4 bg-red-900/20 border border-red-800/40 rounded-xl">
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
