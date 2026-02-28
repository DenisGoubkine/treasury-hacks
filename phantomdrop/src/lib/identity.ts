import { keccak256, toUtf8Bytes } from "ethers";

const WALLET_HASH_CONTEXT = "phantomdrop:patient_wallet:v1";

export function hashWalletIdentity(wallet: string): string {
  return keccak256(toUtf8Bytes(`${WALLET_HASH_CONTEXT}:${wallet.trim().toLowerCase()}`));
}
