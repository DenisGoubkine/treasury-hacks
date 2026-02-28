"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";
import { useRouter } from "next/navigation";

import {
  DELIVERY_FEE,
  MONAD_CHAIN_ID_HEX,
  MONAD_FINALITY_MS,
  MONAD_TESTNET_EXPLORER_URL,
  MONAD_TESTNET_RPC_URL,
  PLATFORM_UNLINK_ADDRESS,
  TOKEN_IS_NATIVE,
  TOKEN_SYMBOL,
} from "@/lib/constants";
import {
  PatientApprovedMedication,
  PatientApprovedMedicationsResponse,
} from "@/lib/compliance/types";
import { formatTokenAmount } from "@/lib/tokenFormat";
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

interface Props {
  patientWallet: string;
}

export default function OrderForm({ patientWallet }: Props) {
  const router = useRouter();

  const [dropLocation, setDropLocation] = useState("");
  const [selectedApprovalCode, setSelectedApprovalCode] = useState("");
  const [approvals, setApprovals] = useState<PatientApprovedMedication[]>([]);

  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [error, setError] = useState("");

  const feeDisplay = useMemo(() => formatTokenAmount(DELIVERY_FEE, 6), []);
  const finalitySeconds = (MONAD_FINALITY_MS / 1000).toFixed(1);

  const selectedApproval = useMemo(
    () => approvals.find((item) => item.approvalCode === selectedApprovalCode) || null,
    [approvals, selectedApprovalCode]
  );

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
    if (!recipient || !recipient.startsWith("0x")) {
      setError("Escrow recipient must be an EVM address (0x...). Update NEXT_PUBLIC_PLATFORM_UNLINK_ADDRESS.");
      return;
    }

    setError("");
    setIsPlacingOrder(true);

    try {
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

      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: normalized,
            to: recipient,
            value: `0x${DELIVERY_FEE.toString(16)}`,
          },
        ],
      })) as string;

      const order: Order = {
        id: generateOrderId(),
        medicationType: selectedApproval.medicationCategory,
        dropLocation: dropLocation.trim(),
        amount: DELIVERY_FEE.toString(),
        patientWalletHash: hashWalletIdentity(normalized),
        status: "funded",
        createdAt: Date.now(),
        fundedAt: Date.now(),
        txHash,
        complianceAttestationId: selectedApproval.attestationId,
        complianceApprovalCode: selectedApproval.approvalCode,
        compliancePatientToken: selectedApproval.patientToken,
        complianceDoctorToken: selectedApproval.doctorToken,
        complianceSignature: selectedApproval.signature,
        complianceExpiresAt: selectedApproval.validUntilIso,
      };

      saveOrder(order);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not place order";
      setError(msg);
    } finally {
      setIsPlacingOrder(false);
    }
  }

  return (
    <form onSubmit={placeEscrowOrder} className="space-y-6">
      <div className="border border-zinc-100 bg-zinc-50 px-5 py-4 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Wallet recognized</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Only medications already approved by your doctor for this wallet are shown. Select one, add a drop-off location, then pay escrow on Monad (~{finalitySeconds}s finality).
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
        <input
          type="text"
          value={dropLocation}
          onChange={(e) => setDropLocation(e.target.value)}
          placeholder="123 Main St, Apt 4B"
          className="w-full bg-white border border-zinc-200 px-4 py-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
          required
        />
      </div>

      <div className="border border-zinc-100 bg-zinc-50 px-5 py-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Escrow payment</span>
        <span className="text-xs font-bold text-zinc-900">{feeDisplay} {TOKEN_SYMBOL}</span>
      </div>

      {error ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 uppercase tracking-wide">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPlacingOrder || approvals.length === 0 || !selectedApproval}
        className="w-full py-3.5 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPlacingOrder ? "Placing order..." : `Place escrow order — ${feeDisplay} ${TOKEN_SYMBOL}`}
      </button>
    </form>
  );
}
