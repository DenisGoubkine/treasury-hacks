"use client";

import { useState } from "react";
import { useUnlink, useSend } from "@unlink-xyz/react";
import { DELIVERY_FEE, PLATFORM_UNLINK_ADDRESS, TOKEN_ADDRESS } from "@/lib/constants";
import { updateOrderStatus, getOrderById } from "@/lib/store";
import { verifyDelivery } from "@/lib/openai";
import PhotoUploader from "./PhotoUploader";

interface Props {
  orderId: string;
  courierWallet: string;
  onSuccess: (txHash?: string) => void;
}

type VerifyState = "idle" | "verifying" | "verified" | "rejected" | "releasing" | "done" | "error";

export default function DeliveryVerifier({ orderId, courierWallet, onSuccess }: Props) {
  const { activeAccount } = useUnlink();
  const { send } = useSend();

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
      setState("releasing");

      // Release escrow: platform → courier
      // NOTE: In production, this call would be made by the platform backend
      // For the hackathon, the patient's connected wallet acts as the platform
      const result = await send([
        {
          token: TOKEN_ADDRESS,
          recipient: courierWallet,
          amount: DELIVERY_FEE,
        },
      ]);

      const txHash = result.relayId;
      updateOrderStatus(orderId, {
        status: "paid",
        paidAt: Date.now(),
        payoutTxHash: txHash,
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
        <p className="text-zinc-400">Payment released to courier wallet.</p>
        {order?.payoutTxHash && (
          <p className="font-mono text-xs text-zinc-500 break-all">{order.payoutTxHash}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PhotoUploader onPhoto={handlePhoto} />

      {photo && state !== "verifying" && state !== "releasing" && (
        <button
          onClick={handleVerify}
          disabled={!activeAccount}
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

      {state === "releasing" && (
        <div className="text-center py-4 space-y-2">
          <div className="text-3xl animate-pulse">💸</div>
          <p className="text-zinc-400">Releasing escrow payment...</p>
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
