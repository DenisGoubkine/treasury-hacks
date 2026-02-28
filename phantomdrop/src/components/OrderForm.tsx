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
import {
  buildPatientWorkspaceAuthMessage,
  PATIENT_WORKSPACE_AUTH_VERSION,
} from "@/lib/compliance/patientWorkspaceAuth";
import { formatTokenAmount } from "@/lib/tokenFormat";
import { generateOrderId, saveOrder } from "@/lib/store";
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
      const provider = getEthereumProvider();
      await ensureMonadTestnet(provider);

      const normalizedWallet = getAddress(patientWallet);
      const requestTs = Date.now().toString();
      const requestNonce = crypto.randomUUID().replaceAll("-", "");
      const action = "list_approved_medications";
      const resource = normalizedWallet;

      const message = buildPatientWorkspaceAuthMessage({
        patientWallet: normalizedWallet,
        monadWallet: normalizedWallet,
        action,
        resource,
        requestTs,
        requestNonce,
      });

      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, normalizedWallet],
      })) as string;

      const response = await fetch("/api/compliance/patient/approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientWallet: normalizedWallet,
          walletProof: {
            version: PATIENT_WORKSPACE_AUTH_VERSION,
            monadWallet: normalizedWallet,
            action,
            resource,
            requestTs,
            requestNonce,
            signature,
          },
        }),
      });

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

      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
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
        patientWallet: normalized,
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
    <form onSubmit={placeEscrowOrder} className="space-y-5">
      <div className="p-4 bg-gradient-to-br from-zinc-900/80 via-zinc-900/40 to-purple-950/20 border border-zinc-800 rounded-xl text-sm text-zinc-300 space-y-1.5">
        <p className="font-medium text-white">Your wallet is recognized. Order in one flow.</p>
        <p className="text-zinc-400">
          We only show medications already approved by your doctor for this wallet. Select one, add drop-off, pay escrow on Monad (~{finalitySeconds}s finality).
        </p>
      </div>

      <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-700 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-zinc-200">Approved Medications</p>
          <button
            type="button"
            onClick={() => void loadApprovedMedications()}
            disabled={isLoadingApprovals}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-xs text-zinc-200 border border-zinc-700"
          >
            {isLoadingApprovals ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {isLoadingApprovals ? (
          <p className="text-sm text-zinc-500">Loading approvals...</p>
        ) : approvals.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No active doctor approvals found for this wallet yet.
          </p>
        ) : (
          <select
            value={selectedApprovalCode}
            onChange={(e) => setSelectedApprovalCode(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white"
          >
            {approvals.map((item) => (
              <option key={item.approvalCode} value={item.approvalCode}>
                {item.medicationCategory} · Qty {item.quantity} · {new Date(item.validUntilIso).toLocaleDateString()}
              </option>
            ))}
          </select>
        )}

        {selectedApproval ? (
          <div className="p-3 bg-green-900/20 rounded-xl border border-green-700/50 text-xs space-y-1">
            <p className="text-green-300 font-medium">Selected doctor approval</p>
            <p className="text-zinc-300">Code: <span className="font-mono">{selectedApproval.approvalCode}</span></p>
            <p className="text-zinc-400">Medication: {selectedApproval.medicationCategory}</p>
            <p className="text-zinc-400">Quantity: {selectedApproval.quantity}</p>
            <p className="text-zinc-500">Valid until: {new Date(selectedApproval.validUntilIso).toLocaleString()}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Delivery location</label>
        <input
          type="text"
          value={dropLocation}
          onChange={(e) => setDropLocation(e.target.value)}
          placeholder="123 Main St, Apt 4B"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
          required
        />
      </div>

      <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-700 flex items-center justify-between">
        <span className="text-sm text-zinc-400">Escrow payment</span>
        <span className="font-semibold text-white">{feeDisplay} {TOKEN_SYMBOL}</span>
      </div>

      {error ? (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 px-4 py-2 rounded-lg">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPlacingOrder || approvals.length === 0 || !selectedApproval}
        className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-colors text-base"
      >
        {isPlacingOrder ? "Placing order..." : `Place escrow order — ${feeDisplay} ${TOKEN_SYMBOL}`}
      </button>
    </form>
  );
}
