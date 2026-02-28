import "server-only";

import { getAddress, verifyMessage } from "ethers";

import {
  buildPatientConfirmWalletAuthMessage,
  PATIENT_CONFIRM_WALLET_PROOF_VERSION,
} from "@/lib/compliance/patientAuth";
import { isHexEcdsaSignature, isHexEvmAddress } from "@/lib/compliance/walletProof";
import { consumeNonce } from "@/lib/server/compliance/nonce";

export interface VerifyPatientWalletConfirmAuthInput {
  patientWallet: string;
  approvalCode: string;
  walletProof: {
    version: string;
    monadWallet: string;
    requestTs: string;
    requestNonce: string;
    signature: string;
  };
  requestWindowMs: number;
}

export function verifyPatientWalletConfirmAuth(
  input: VerifyPatientWalletConfirmAuthInput
): { ok: boolean; reason?: string; signer?: string } {
  if (!input.walletProof || typeof input.walletProof !== "object") {
    return { ok: false, reason: "missing_wallet_proof" };
  }

  if (input.walletProof.version !== PATIENT_CONFIRM_WALLET_PROOF_VERSION) {
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
    consumeNonce(`patient-confirm:${input.patientWallet.toLowerCase()}:${nonce}`, now, input.requestWindowMs);
  if (!nonceOk) {
    return { ok: false, reason: "replay_or_bad_nonce" };
  }

  try {
    const message = buildPatientConfirmWalletAuthMessage({
      patientWallet: input.patientWallet,
      approvalCode: input.approvalCode,
      monadWallet: input.walletProof.monadWallet,
      requestTs: input.walletProof.requestTs,
      requestNonce: input.walletProof.requestNonce,
    });

    const recovered = getAddress(verifyMessage(message, input.walletProof.signature));
    const claimed = getAddress(input.walletProof.monadWallet);
    if (recovered !== claimed) {
      return { ok: false, reason: "signer_mismatch" };
    }

    return { ok: true, signer: recovered };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}
