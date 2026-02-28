import "server-only";

import { getAddress, verifyMessage } from "ethers";

import {
  buildPatientWorkspaceAuthMessage,
  PATIENT_WORKSPACE_AUTH_VERSION,
} from "@/lib/compliance/patientWorkspaceAuth";
import { isHexEcdsaSignature, isHexEvmAddress } from "@/lib/compliance/walletProof";
import { consumeNonce } from "@/lib/server/compliance/nonce";

export interface VerifyPatientWorkspaceAuthInput {
  patientWallet: string;
  walletProof: {
    version: string;
    monadWallet: string;
    action: string;
    resource: string;
    requestTs: string;
    requestNonce: string;
    signature: string;
  };
  requestWindowMs: number;
}

export function verifyPatientWorkspaceAuth(
  input: VerifyPatientWorkspaceAuthInput
): { ok: boolean; reason?: string; signer?: string } {
  if (!input.walletProof || typeof input.walletProof !== "object") {
    return { ok: false, reason: "missing_wallet_proof" };
  }

  if (input.walletProof.version !== PATIENT_WORKSPACE_AUTH_VERSION) {
    return { ok: false, reason: "invalid_wallet_proof_version" };
  }

  const now = Date.now();
  const parsedTs = Number(input.walletProof.requestTs);
  const isTsValid = Number.isFinite(parsedTs);
  const isFresh = isTsValid && Math.abs(now - parsedTs) <= input.requestWindowMs;
  if (!isFresh) {
    return { ok: false, reason: "expired_or_invalid_timestamp" };
  }

  if (!isHexEvmAddress(input.walletProof.monadWallet)) {
    return { ok: false, reason: "invalid_monad_wallet" };
  }

  if (!isHexEcdsaSignature(input.walletProof.signature)) {
    return { ok: false, reason: "invalid_signature_format" };
  }

  const nonce = input.walletProof.requestNonce.trim();
  const nonceOk =
    nonce.length >= 12 &&
    consumeNonce(`patient-workspace:${input.patientWallet.toLowerCase()}:${nonce}`, now, input.requestWindowMs);
  if (!nonceOk) {
    return { ok: false, reason: "replay_or_bad_nonce" };
  }

  try {
    const message = buildPatientWorkspaceAuthMessage({
      patientWallet: input.patientWallet,
      monadWallet: input.walletProof.monadWallet,
      action: input.walletProof.action,
      resource: input.walletProof.resource,
      requestTs: input.walletProof.requestTs,
      requestNonce: input.walletProof.requestNonce,
    });

    const recovered = getAddress(verifyMessage(message, input.walletProof.signature));
    const claimed = getAddress(input.walletProof.monadWallet);
    if (recovered !== claimed) {
      return { ok: false, reason: "signer_mismatch" };
    }

    if (recovered.toLowerCase() !== input.patientWallet.toLowerCase()) {
      return { ok: false, reason: "patient_wallet_mismatch" };
    }

    return { ok: true, signer: recovered };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}
