"use client";

import { useMemo, useState } from "react";
import { useUnlink, useSend } from "@unlink-xyz/react";
import { useRouter } from "next/navigation";

import {
  DELIVERY_FEE,
  MONAD_FINALITY_MS,
  PLATFORM_UNLINK_ADDRESS,
  REQUEST_SIGNAL_AMOUNT,
  TOKEN_ADDRESS,
  TOKEN_SYMBOL,
} from "@/lib/constants";
import {
  ComplianceAttestation,
  ControlledSchedule,
  DoctorConfirmAttestationResponse,
  PatientDoctorApprovalRequestResponse,
} from "@/lib/compliance/types";
import {
  buildPatientDoctorWalletProofMessage,
  PATIENT_DOCTOR_WALLET_PROOF_VERSION,
} from "@/lib/compliance/walletProof";
import {
  DEFAULT_MEDICATION_CODE,
  getMedicationByCode,
  MEDICATION_CATALOG,
} from "@/lib/compliance/medications";
import { formatTokenAmount } from "@/lib/tokenFormat";
import { generateOrderId, saveOrder } from "@/lib/store";
import { Order } from "@/types";

type OrderPolicy = {
  medicationCode: string;
  medicationCategory: string;
  controlledSchedule: ControlledSchedule;
  quantity: number;
  prescriptionHash: string;
};

export default function OrderForm() {
  const router = useRouter();
  const { activeAccount, createBurner, unlink } = useUnlink();
  const { send, isPending } = useSend();

  const [approvalCode, setApprovalCode] = useState("");
  const [dropLocation, setDropLocation] = useState("");

  const [requestDoctorWallet, setRequestDoctorWallet] = useState("");
  const [selectedMedicationCode, setSelectedMedicationCode] = useState(DEFAULT_MEDICATION_CODE);
  const [requestLegalName, setRequestLegalName] = useState("");
  const [requestDob, setRequestDob] = useState("");
  const [requestState, setRequestState] = useState("");
  const [requestHealthCard, setRequestHealthCard] = useState("");
  const [requestStatus, setRequestStatus] = useState<{
    requestId: string;
    verificationStatus: string;
    medicationCategory: string;
    relayId: string;
    monadWallet: string;
  } | null>(null);

  const [error, setError] = useState("");
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [attestation, setAttestation] = useState<ComplianceAttestation | null>(null);
  const [policy, setPolicy] = useState<OrderPolicy | null>(null);

  const feeDisplay = useMemo(() => formatTokenAmount(DELIVERY_FEE, 6), []);
  const requestSignalDisplay = useMemo(
    () => formatTokenAmount(REQUEST_SIGNAL_AMOUNT, 6),
    []
  );
  const finalitySeconds = (MONAD_FINALITY_MS / 1000).toFixed(1);
  const selectedMedication = useMemo(
    () => getMedicationByCode(selectedMedicationCode) || MEDICATION_CATALOG[0],
    [selectedMedicationCode]
  );

  async function confirmDoctorApproval(): Promise<{
    attestation: ComplianceAttestation;
    orderPolicy: OrderPolicy;
  }> {
    if (!activeAccount) throw new Error("Wallet not connected");

    const response = await fetch("/api/compliance/doctor/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        approvalCode: approvalCode.trim(),
        patientWallet: activeAccount.address,
      }),
    });

    const body = (await response.json()) as DoctorConfirmAttestationResponse;
    if (!response.ok || !body.ok || !body.attestation || !body.orderPolicy) {
      throw new Error(body.error || "Doctor approval could not be verified");
    }

    return { attestation: body.attestation, orderPolicy: body.orderPolicy };
  }

  async function runApprovalCheck() {
    setIsCheckingApproval(true);
    setError("");

    try {
      const confirmed = await confirmDoctorApproval();
      setAttestation(confirmed.attestation);
      setPolicy(confirmed.orderPolicy);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Doctor approval check failed";
      setError(msg);
      setAttestation(null);
      setPolicy(null);
    } finally {
      setIsCheckingApproval(false);
    }
  }

  async function submitDoctorRequest() {
    if (!activeAccount) return;

    setError("");
    setRequestStatus(null);

    if (!requestDoctorWallet.trim()) {
      setError("Enter doctor wallet address.");
      return;
    }

    try {
      setIsSubmittingRequest(true);

      const tx = await send([
        {
          token: TOKEN_ADDRESS,
          recipient: requestDoctorWallet.trim(),
          amount: REQUEST_SIGNAL_AMOUNT,
        },
      ]);

      const relayId = tx.relayId;
      if (!relayId) {
        throw new Error("Wallet request transaction relay id not returned");
      }

      if (!unlink) {
        throw new Error("Wallet client is not ready to generate signature proof");
      }

      const burner = await createBurner(0);
      const privateKey = await unlink.burner.exportKey(0);
      const { Wallet, getAddress } = await import("ethers");
      const signer = new Wallet(privateKey);
      const monadWallet = getAddress(burner.address);
      if (getAddress(signer.address) !== monadWallet) {
        throw new Error("Could not validate signer wallet for request proof");
      }

      const requestTs = Date.now().toString();
      const requestNonce = crypto.randomUUID().replaceAll("-", "");
      const proofMessage = buildPatientDoctorWalletProofMessage({
        patientWallet: activeAccount.address,
        doctorWallet: requestDoctorWallet.trim(),
        medicationCode: selectedMedication.code,
        requestRelayId: relayId,
        legalName: requestLegalName.trim(),
        dob: requestDob,
        patientState: requestState.trim().toUpperCase(),
        healthCardNumber: requestHealthCard.trim(),
        monadWallet,
        requestTs,
        requestNonce,
      });
      const signature = await signer.signMessage(proofMessage);

      const response = await fetch("/api/compliance/doctor/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doctorWallet: requestDoctorWallet.trim(),
          patientWallet: activeAccount.address,
          medicationCode: selectedMedication.code,
          legalName: requestLegalName.trim(),
          dob: requestDob,
          patientState: requestState.trim().toUpperCase(),
          healthCardNumber: requestHealthCard.trim(),
          requestRelayId: relayId,
          walletProof: {
            version: PATIENT_DOCTOR_WALLET_PROOF_VERSION,
            monadWallet,
            requestTs,
            requestNonce,
            signature,
          },
        }),
      });

      const body = (await response.json()) as PatientDoctorApprovalRequestResponse;
      if (!response.ok || !body.ok || !body.request) {
        const issueMessage = body.issues?.[0]?.message;
        throw new Error(issueMessage || body.error || "Failed to submit doctor request");
      }

      setRequestStatus({
        requestId: body.request.requestId,
        verificationStatus: body.request.verificationStatus,
        medicationCategory: body.request.medicationCategory,
        relayId: body.request.requestRelayId,
        monadWallet: body.request.walletProof.monadWallet,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Doctor request failed";
      if (msg.toLowerCase().includes("insufficient balance")) {
        setError(`Insufficient Unlink private balance. Fund wallet first, then retry. (${msg})`);
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;

    if (!approvalCode.trim()) {
      setError("Enter the doctor approval code first.");
      return;
    }

    if (!dropLocation.trim()) {
      setError("Please enter a drop-off location.");
      return;
    }

    setError("");

    try {
      setIsCheckingApproval(true);
      const confirmed = await confirmDoctorApproval();
      setAttestation(confirmed.attestation);
      setPolicy(confirmed.orderPolicy);

      const escrowRecipient =
        PLATFORM_UNLINK_ADDRESS.startsWith("unlink1") || PLATFORM_UNLINK_ADDRESS.startsWith("0x")
          ? PLATFORM_UNLINK_ADDRESS
          : activeAccount.address;

      const result = await send([
        {
          token: TOKEN_ADDRESS,
          recipient: escrowRecipient,
          amount: DELIVERY_FEE,
        },
      ]);

      const order: Order = {
        id: generateOrderId(),
        medicationType: confirmed.orderPolicy.medicationCategory,
        dropLocation: dropLocation.trim(),
        amount: DELIVERY_FEE.toString(),
        patientWallet: activeAccount.address,
        status: "funded",
        createdAt: Date.now(),
        fundedAt: Date.now(),
        txHash: result.relayId ?? undefined,
        complianceAttestationId: confirmed.attestation.attestationId,
        complianceApprovalCode: approvalCode.trim(),
        compliancePatientToken: confirmed.attestation.patientToken,
        complianceDoctorToken: confirmed.attestation.doctorToken,
        complianceSignature: confirmed.attestation.signature,
        complianceExpiresAt: confirmed.attestation.expiresAt,
      };

      saveOrder(order);
      router.push("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      if (msg.toLowerCase().includes("insufficient balance")) {
        setError(`Insufficient Unlink private balance. Fund wallet first, then retry. (${msg})`);
      } else {
        setError(msg);
      }
    } finally {
      setIsCheckingApproval(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-4 bg-gradient-to-br from-zinc-900/80 via-zinc-900/40 to-purple-950/20 border border-zinc-800 rounded-xl text-sm text-zinc-300 space-y-1.5">
        <p className="font-medium text-white">Doctor request to doctor approval to secure checkout.</p>
        <p className="text-zinc-400">
          You send a wallet transaction request to your doctor, doctor validates legal identity + license, then you checkout with approval code on Monad (~{finalitySeconds}s finality).
        </p>
      </div>

      <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-700 space-y-3">
        <p className="text-sm font-medium text-zinc-200">Step 1: Send doctor request (wallet transaction required)</p>

        <div className="space-y-1">
          <label className="text-xs text-zinc-500">Medication to request</label>
          <select
            value={selectedMedicationCode}
            onChange={(e) => setSelectedMedicationCode(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white"
          >
            {MEDICATION_CATALOG.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label} · {item.category}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={requestDoctorWallet}
          onChange={(e) => setRequestDoctorWallet(e.target.value)}
          placeholder="Doctor wallet (unlink1... or 0x...)"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={requestLegalName}
            onChange={(e) => setRequestLegalName(e.target.value)}
            placeholder="Legal full name"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
            required
          />
          <input
            type="date"
            value={requestDob}
            onChange={(e) => setRequestDob(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={requestState}
            onChange={(e) => setRequestState(e.target.value.toUpperCase())}
            placeholder="State (NY, CA, ...)"
            maxLength={2}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
            required
          />
          <input
            type="text"
            value={requestHealthCard}
            onChange={(e) => setRequestHealthCard(e.target.value)}
            placeholder="Health card number"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
            required
          />
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
          <p>
            Request signal stake: {requestSignalDisplay} {TOKEN_SYMBOL} (tx proof + Monad wallet signature)
          </p>
          <button
            type="button"
            onClick={submitDoctorRequest}
            disabled={isSubmittingRequest || !activeAccount}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm font-medium text-zinc-200 border border-zinc-700"
          >
            {isSubmittingRequest ? "Sending..." : "Send Request"}
          </button>
        </div>

        {requestStatus && (
          <div className="p-3 bg-green-900/20 rounded-xl border border-green-700/50 text-xs space-y-1">
            <p className="text-green-300 font-medium">Doctor request submitted</p>
            <p className="font-mono text-zinc-300 break-all">Request ID: {requestStatus.requestId}</p>
            <p className="text-zinc-400">Verification: {requestStatus.verificationStatus}</p>
            <p className="text-zinc-500">Medication: {requestStatus.medicationCategory}</p>
            <p className="text-zinc-500 break-all">Relay: {requestStatus.relayId}</p>
            <p className="text-zinc-500 break-all">Monad signer: {requestStatus.monadWallet}</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-700 space-y-3">
        <p className="text-sm font-medium text-zinc-200">Step 2: Enter doctor approval code</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={approvalCode}
            onChange={(e) => setApprovalCode(e.target.value.toUpperCase())}
            placeholder="DOC-XXXX-XXXX"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
            required
          />
          <button
            type="button"
            onClick={runApprovalCheck}
            disabled={isCheckingApproval || !activeAccount}
            className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors border border-zinc-700"
          >
            {isCheckingApproval ? "Checking..." : "Check"}
          </button>
        </div>

        {attestation && policy && (
          <div className="p-3 bg-green-900/20 rounded-xl border border-green-700/50 space-y-2">
            <p className="text-green-300 text-sm font-medium">Doctor approval verified</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
              <p>Medication: <span className="text-zinc-100">{policy.medicationCategory}</span></p>
              <p>Schedule: <span className="text-zinc-100">{policy.controlledSchedule.replaceAll("_", " ")}</span></p>
              <p>Quantity: <span className="text-zinc-100">{policy.quantity}</span></p>
              <p className="truncate">ID: <span className="font-mono text-zinc-100">{attestation.attestationId}</span></p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">
          Step 3: Delivery location
        </label>
        <input
          type="text"
          value={dropLocation}
          onChange={(e) => setDropLocation(e.target.value)}
          placeholder="123 Main St, Apt 4B or GPS coordinates"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
          required
        />
        <p className="text-xs text-zinc-500">Only your assigned courier sees this location.</p>
      </div>

      <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-700 flex items-center justify-between">
        <span className="text-sm text-zinc-400">Step 4: Secure payment (escrow)</span>
        <span className="font-semibold text-white">{feeDisplay} {TOKEN_SYMBOL}</span>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || isCheckingApproval || isSubmittingRequest || !activeAccount}
        className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-colors text-base"
      >
        {isCheckingApproval
          ? "Verifying doctor approval..."
            : isPending
              ? "Processing payment..."
            : `Pay securely — ${feeDisplay} ${TOKEN_SYMBOL}`}
      </button>
    </form>
  );
}
