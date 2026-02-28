import "server-only";

import { getAddress, verifyMessage } from "ethers";

import { buildDoctorWalletAuthMessage } from "@/lib/compliance/doctorAuth";
import { isHexEcdsaSignature, isHexEvmAddress } from "@/lib/compliance/walletProof";
import { consumeNonce } from "@/lib/server/compliance/nonce";

export interface VerifyDoctorWalletAuthInput {
  doctorWallet: string;
  monadWallet: string;
  action: string;
  resource: string;
  requestTs: string;
  requestNonce: string;
  signature: string;
  requestWindowMs: number;
}

export function verifyDoctorWalletAuth(input: VerifyDoctorWalletAuthInput): {
  ok: boolean;
  reason?: string;
  signer?: string;
} {
  const now = Date.now();
  const parsedTs = Number(input.requestTs);
  const isTsValid = Number.isFinite(parsedTs);
  const isFresh = isTsValid && Math.abs(now - parsedTs) <= input.requestWindowMs;
  if (!isFresh) {
    return { ok: false, reason: "expired_or_invalid_timestamp" };
  }

  if (!isHexEvmAddress(input.monadWallet)) {
    return { ok: false, reason: "invalid_monad_wallet" };
  }

  if (!isHexEcdsaSignature(input.signature)) {
    return { ok: false, reason: "invalid_signature_format" };
  }

  const nonce = input.requestNonce.trim();
  const nonceOk =
    nonce.length >= 12 &&
    consumeNonce(`doctor-wallet:${input.doctorWallet.toLowerCase()}:${nonce}`, now, input.requestWindowMs);
  if (!nonceOk) {
    return { ok: false, reason: "replay_or_bad_nonce" };
  }

  try {
    const message = buildDoctorWalletAuthMessage({
      doctorWallet: input.doctorWallet,
      monadWallet: input.monadWallet,
      action: input.action,
      resource: input.resource,
      requestTs: input.requestTs,
      requestNonce: input.requestNonce,
    });

    const recovered = getAddress(verifyMessage(message, input.signature));
    const claimed = getAddress(input.monadWallet);
    if (recovered !== claimed) {
      return { ok: false, reason: "signer_mismatch" };
    }

    return { ok: true, signer: recovered };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}
