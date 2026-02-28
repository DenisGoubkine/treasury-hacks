"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";
import { useRouter } from "next/navigation";
import { useDeposit, useSend, useUnlink, useUnlinkBalance } from "@unlink-xyz/react";

import {
  DELIVERY_FEE,
  MONAD_CHAIN_ID_HEX,
  MONAD_FINALITY_MS,
  MONAD_TESTNET_EXPLORER_URL,
  MONAD_TESTNET_RPC_URL,
  PLATFORM_UNLINK_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_IS_NATIVE,
  TOKEN_SYMBOL,
} from "@/lib/constants";
import {
  PatientApprovedMedication,
  PatientApprovedMedicationsResponse,
} from "@/lib/compliance/types";
import { formatTokenAmount } from "@/lib/tokenFormat";
import { computeOrderBreakdown } from "@/lib/pricing";
import { generateOrderId, saveOrder } from "@/lib/store";
import { hashWalletIdentity } from "@/lib/identity";
import { Order } from "@/types";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

function getEthereumProvider(): Eip1193Provider {
  const provider = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) {
    throw new Error("MetaMask not detected.");
  }
  return provider;
}

async function ensureMonadTestnet(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_CHAIN_ID_HEX }],
    });
  } catch (error) {
    const code = Number((error as { code?: number })?.code ?? 0);
    if (code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: MONAD_CHAIN_ID_HEX,
          chainName: "Monad Testnet",
          nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
          rpcUrls: [MONAD_TESTNET_RPC_URL],
          blockExplorerUrls: [MONAD_TESTNET_EXPLORER_URL],
        },
      ],
    });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHttp404Error(error: unknown): boolean {
  const status = Number((error as { status?: number })?.status ?? 0);
  const message = error instanceof Error ? error.message : String(error);
  return status === 404 || message.includes("HTTP 404") || message.includes("404");
}

async function waitForTxReceipt(provider: Eip1193Provider, txHash: string): Promise<void> {
  for (let i = 0; i < 180; i += 1) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status?: string } | null;
    if (receipt?.status) {
      if (receipt.status === "0x1") return;
      throw new Error("MetaMask transaction reverted.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for MetaMask transaction receipt.");
}

type EscrowStep = "wallet" | "depositing" | "sending" | "creating" | null;
const ADDRESS_HISTORY_LIMIT = 8;
const ADDRESS_STORAGE_PREFIX = "phantomdrop:address_history:v1";

function getAddressHistoryStorageKey(wallet: string): string {
  return `${ADDRESS_STORAGE_PREFIX}:${wallet.trim().toLowerCase()}`;
}

function loadAddressHistory(wallet: string): string[] {
  if (typeof window === "undefined" || !wallet) return [];
  try {
    const key = getAddressHistoryStorageKey(wallet);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function persistAddressHistory(wallet: string, addresses: string[]): void {
  if (typeof window === "undefined" || !wallet) return;
  const key = getAddressHistoryStorageKey(wallet);
  window.localStorage.setItem(key, JSON.stringify(addresses.slice(0, ADDRESS_HISTORY_LIMIT)));
}

function upsertAddress(addresses: string[], nextAddress: string): string[] {
  const normalized = nextAddress.trim();
  if (!normalized) return addresses;
  const withoutDup = addresses.filter((item) => item.toLowerCase() !== normalized.toLowerCase());
  return [normalized, ...withoutDup].slice(0, ADDRESS_HISTORY_LIMIT);
}

interface Props {
  patientWallet: string;
}

export default function OrderForm({ patientWallet }: Props) {
  const router = useRouter();

  const { activeAccount, refresh, getTxStatus, createWallet, createAccount } = useUnlink();
  const { deposit, isPending: isDepositing } = useDeposit();
  const { send, isPending: isSending } = useSend();
  const { balance } = useUnlinkBalance(TOKEN_ADDRESS);

  const [dropLocation, setDropLocation] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [selectedApprovalCode, setSelectedApprovalCode] = useState("");
  const [approvals, setApprovals] = useState<PatientApprovedMedication[]>([]);

  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [escrowStep, setEscrowStep] = useState<EscrowStep>(null);
  const [error, setError] = useState("");

  const feeDisplay = useMemo(() => formatTokenAmount(DELIVERY_FEE, 6), []);
  const breakdown = useMemo(() => computeOrderBreakdown(), []);
  const finalitySeconds = (MONAD_FINALITY_MS / 1000).toFixed(1);

  const selectedApproval = useMemo(
    () => approvals.find((item) => item.approvalCode === selectedApprovalCode) || null,
    [approvals, selectedApprovalCode]
  );

  // 404-tolerant relay confirmation (Unlink indexer may lag behind chain)
  async function waitForRelayConfirmation(relayId: string): Promise<void> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      try {
        const status = await getTxStatus(relayId);
        if (status.state === "succeeded") return;
        if (status.state === "reverted" || status.state === "failed" || status.state === "dead") {
          throw new Error(status.error || `Transaction ${status.state}`);
        }
      } catch (err) {
        if (!isHttp404Error(err)) throw err;
        // 404 = indexer hasn't caught up yet, keep polling
      }
      await sleep(2000);
    }
    throw new Error("Timed out waiting for Unlink confirmation. The deposit may still be processing — try again in a minute.");
  }

  const loadApprovedMedications = useCallback(async () => {
    if (!patientWallet) return;

    setError("");
    setIsLoadingApprovals(true);

    try {
      const normalizedWallet = getAddress(patientWallet);
      const response = await fetch(
        `/api/compliance/patient/approvals?patientWallet=${encodeURIComponent(normalizedWallet)}`
      );

      const body = (await response.json()) as PatientApprovedMedicationsResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Could not load approved medications");
      }
      const nextApprovals = body.approvals ?? [];

      setApprovals(nextApprovals);
      if (nextApprovals.length > 0) {
        setSelectedApprovalCode((prev) => prev || nextApprovals[0].approvalCode);
      } else {
        setSelectedApprovalCode("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load approved medications";
      setError(msg);
      setApprovals([]);
      setSelectedApprovalCode("");
    } finally {
      setIsLoadingApprovals(false);
    }
  }, [patientWallet]);

  useEffect(() => {
    loadApprovedMedications().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to load approved medications";
      setError(msg);
    });
  }, [loadApprovedMedications]);

  useEffect(() => {
    if (!patientWallet) return;
    setAddressSuggestions(loadAddressHistory(patientWallet));
  }, [patientWallet]);

  async function placeEscrowOrder(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedApproval) {
      setError("No doctor-approved medication available for this wallet.");
      return;
    }

    if (!dropLocation.trim()) {
      setError("Please enter a drop-off location.");
      return;
    }

    if (!TOKEN_IS_NATIVE) {
      setError("This checkout currently supports native MON escrow only.");
      return;
    }

    const recipient = PLATFORM_UNLINK_ADDRESS.trim();
    if (!recipient || !recipient.startsWith("unlink1")) {
      setError("Platform Unlink address not configured. Set NEXT_PUBLIC_PLATFORM_UNLINK_ADDRESS.");
      return;
    }

    setError("");
    setIsPlacingOrder(true);

    let depositRelayId: string | undefined;
    let sendRelayId: string | undefined;

    try {
      const fee = DELIVERY_FEE;

      // Step 0: Auto-create Unlink wallet if none exists (silent, no mnemonic shown)
      if (!activeAccount) {
        setEscrowStep("wallet");
        await createWallet();
        await createAccount();
      }

      // Step 1: Deposit to Unlink pool only if private balance is insufficient.
      if (balance < fee) {
        setEscrowStep("depositing");

        const provider = getEthereumProvider();
        await ensureMonadTestnet(provider);

        let accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        if (!accounts?.[0]) {
          accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
        }
        const account = accounts?.[0];
        if (!account) {
          throw new Error("No MetaMask account selected.");
        }
        const normalized = getAddress(account);
        if (normalized.toLowerCase() !== patientWallet.toLowerCase()) {
          throw new Error("Connected MetaMask account changed. Reconnect and retry.");
        }

        const relay = await deposit([{
          token: TOKEN_ADDRESS,
          amount: fee,
          depositor: normalized,
        }]);

        depositRelayId = relay.relayId;

        // MetaMask popup — goes to shared Unlink pool contract (anonymous, not admin wallet)
        const txHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: normalized,
              to: relay.to,
              data: relay.calldata,
              value: `0x${relay.value.toString(16)}`,
            },
          ],
        })) as string;

        await waitForTxReceipt(provider, txHash);
        await waitForRelayConfirmation(relay.relayId);
        await refresh();
      }

      // Step 2: Private send to platform escrow (ZK proof — no MetaMask popup, nothing on-chain)
      setEscrowStep("sending");

      const sendResult = await send([{
        token: TOKEN_ADDRESS,
        recipient,
        amount: fee,
      }]);

      sendRelayId = sendResult.relayId;
      await waitForRelayConfirmation(sendResult.relayId);
      await refresh();

      // Step 3: Create order
      setEscrowStep("creating");

      const order: Order = {
        id: generateOrderId(),
        medicationType: selectedApproval.medicationCategory,
        dropLocation: dropLocation.trim(),
        amount: DELIVERY_FEE.toString(),
        patientWalletHash: hashWalletIdentity(patientWallet.toLowerCase()),
        status: "funded",
        createdAt: Date.now(),
        fundedAt: Date.now(),
        escrowDepositRelayId: depositRelayId,
        escrowSendRelayId: sendRelayId,
        complianceAttestationId: selectedApproval.attestationId,
        complianceApprovalCode: selectedApproval.approvalCode,
        compliancePatientToken: selectedApproval.patientToken,
        complianceDoctorToken: selectedApproval.doctorToken,
        complianceSignature: selectedApproval.signature,
        complianceExpiresAt: selectedApproval.validUntilIso,
        totalUsdc: breakdown.totalDisplay,
        pharmacyCostUsdc: breakdown.pharmacyCostDisplay,
        courierFeeUsdc: breakdown.courierFeeDisplay,
      };

      saveOrder(order);

      const updatedHistory = upsertAddress(addressSuggestions, dropLocation);
      setAddressSuggestions(updatedHistory);
      persistAddressHistory(patientWallet, updatedHistory);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not place order";
      setError(msg);
    } finally {
      setIsPlacingOrder(false);
      setEscrowStep(null);
    }
  }

  const escrowStepLabel: Record<string, string> = {
    wallet: "Setting up private escrow...",
    depositing: "Funding escrow...",
    sending: "Securing funds via ZK proof...",
    creating: "Creating order...",
  };

  const buttonLabel = escrowStep
    ? escrowStepLabel[escrowStep]
    : isDepositing
    ? "Preparing escrow..."
    : isSending
    ? "Securing funds..."
    : `Place order — $${breakdown.totalDisplay} USDC`;

  return (
    <form onSubmit={placeEscrowOrder} className="space-y-6">
      <div className="border border-zinc-100 bg-zinc-50 px-5 py-4 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Wallet recognized</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Only medications already approved by your doctor for this wallet are shown. Select one, add a drop-off location, and place your order (~{finalitySeconds}s finality on Monad).
        </p>
      </div>

      <div className="border border-zinc-100 space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Approved Medications</p>
          <button
            type="button"
            onClick={() => void loadApprovedMedications()}
            disabled={isLoadingApprovals}
            className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 uppercase tracking-widest transition-colors"
          >
            {isLoadingApprovals ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {isLoadingApprovals ? (
          <p className="text-xs text-zinc-400 uppercase tracking-widest animate-pulse">Loading approvals...</p>
        ) : approvals.length === 0 ? (
          <p className="text-xs text-zinc-400 leading-relaxed">
            No active doctor approvals found for this wallet yet. Contact your doctor to file an approval.
          </p>
        ) : (
          <select
            value={selectedApprovalCode}
            onChange={(e) => setSelectedApprovalCode(e.target.value)}
            className="w-full bg-white border border-zinc-200 px-4 py-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
          >
            {approvals.map((item) => (
              <option key={item.approvalCode} value={item.approvalCode}>
                {item.medicationCategory} · Qty {item.quantity} · {new Date(item.validUntilIso).toLocaleDateString()}
              </option>
            ))}
          </select>
        )}

        {selectedApproval ? (
          <div className="border border-green-200 bg-green-50 px-4 py-3 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700">Doctor approval active</p>
            <p className="text-xs text-zinc-600">Code: <span className="font-mono">{selectedApproval.approvalCode}</span></p>
            <p className="text-xs text-zinc-500">Medication: {selectedApproval.medicationCategory}</p>
            <p className="text-xs text-zinc-500">Quantity: {selectedApproval.quantity}</p>
            <p className="text-xs text-zinc-400">Valid until: {new Date(selectedApproval.validUntilIso).toLocaleString()}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-900">Delivery location</label>
        {addressSuggestions.length > 0 ? (
          <p className="text-xs text-zinc-400">
            Autofill from your recent addresses is enabled.
          </p>
        ) : null}
        <input
          type="text"
          value={dropLocation}
          onChange={(e) => setDropLocation(e.target.value)}
          placeholder="123 Main St, Apt 4B"
          list="drop-location-suggestions"
          autoComplete="street-address"
          className="w-full bg-white border border-zinc-200 px-4 py-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          required
        />
        <datalist id="drop-location-suggestions">
          {addressSuggestions.map((address) => (
            <option key={address} value={address} />
          ))}
        </datalist>
        {addressSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {addressSuggestions.slice(0, 3).map((address) => (
              <button
                key={address}
                type="button"
                onClick={() => setDropLocation(address)}
                className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 uppercase tracking-widest transition-colors"
              >
                {address.length > 36 ? `${address.slice(0, 36)}...` : address}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border border-zinc-100 bg-zinc-50 p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Escrow breakdown</p>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Pharmacy (cost of goods)</span>
            <span className="text-xs text-zinc-700">${breakdown.pharmacyCostDisplay} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Delivery fee ({breakdown.courierPercent}%)</span>
            <span className="text-xs text-zinc-700">${breakdown.courierFeeDisplay} USDC</span>
          </div>
          <div className="border-t border-zinc-200 pt-2 flex justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-900">Total escrowed</span>
            <span className="text-xs font-bold text-zinc-900">${breakdown.totalDisplay} USDC</span>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 uppercase tracking-wide">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPlacingOrder || isDepositing || isSending || approvals.length === 0 || !selectedApproval}
        className="w-full py-3.5 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {buttonLabel}
      </button>

      {escrowStep && (
        <div className="border border-[#00E100]/30 bg-green-50 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E100] animate-pulse" />
            <p className="text-xs text-green-700 uppercase tracking-widest font-bold">
              {escrowStepLabel[escrowStep]}
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            {escrowStep === "wallet" && "Creating anonymous escrow account..."}
            {escrowStep === "depositing" && "Confirm the transaction in MetaMask to fund the escrow."}
            {escrowStep === "sending" && "Privately transferring to platform escrow. No additional approval needed."}
            {escrowStep === "creating" && "Finalizing your order..."}
          </p>
        </div>
      )}
    </form>
  );
}
