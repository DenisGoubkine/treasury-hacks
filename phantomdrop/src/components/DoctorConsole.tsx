"use client";

import { useEffect, useMemo, useState } from "react";
import { useSend, useUnlink } from "@unlink-xyz/react";

import {
  ControlledSchedule,
  DoctorFileAttestationResponse,
  DoctorFiledAttestation,
  DoctorRegisterPatientResponse,
  PatientDoctorApprovalRequestRecord,
} from "@/lib/compliance/types";
import {
  MONAD_BLOCK_TIME_MS,
  MONAD_FINALITY_MS,
  REGISTRY_SIGNAL_AMOUNT,
  TOKEN_ADDRESS,
  TOKEN_SYMBOL,
} from "@/lib/constants";
import {
  DEFAULT_MEDICATION_CODE,
  getMedicationByCode,
  MEDICATION_CATALOG,
} from "@/lib/compliance/medications";
import { formatTokenAmount } from "@/lib/tokenFormat";
import { buildDoctorWalletAuthMessage } from "@/lib/compliance/doctorAuth";
import WalletConnect from "@/components/WalletConnect";

function toInitialExpiryIso(): string {
  const date = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  return date.toISOString().slice(0, 16);
}

export default function DoctorConsole() {
  const { activeAccount, createBurner, unlink, waitForConfirmation } = useUnlink();
  const { send, isPending: isRegistrySignalPending } = useSend();

  const [registryPatientWallet, setRegistryPatientWallet] = useState("");
  const [registryLegalName, setRegistryLegalName] = useState("");
  const [registryDob, setRegistryDob] = useState("");
  const [registryState, setRegistryState] = useState("");
  const [registryHealthCard, setRegistryHealthCard] = useState("");

  const [requestId, setRequestId] = useState("");
  const [patientWallet, setPatientWallet] = useState("");
  const [doctorNpi, setDoctorNpi] = useState("");
  const [doctorDea, setDoctorDea] = useState("");
  const [medicationCode, setMedicationCode] = useState<string>(DEFAULT_MEDICATION_CODE);
  const [controlledSchedule, setControlledSchedule] = useState<ControlledSchedule>("non_controlled");
  const [quantity, setQuantity] = useState("30");
  const [validUntilIso, setValidUntilIso] = useState(toInitialExpiryIso());
  const [canPurchase, setCanPurchase] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<DoctorFiledAttestation | null>(null);
  const [records, setRecords] = useState<DoctorFiledAttestation[]>([]);
  const [requests, setRequests] = useState<PatientDoctorApprovalRequestRecord[]>([]);

  const performanceLabel = useMemo(
    () => `${MONAD_BLOCK_TIME_MS}ms blocks · ${MONAD_FINALITY_MS}ms finality`,
    []
  );
  const registrySignalDisplay = useMemo(
    () => formatTokenAmount(REGISTRY_SIGNAL_AMOUNT, 6),
    []
  );
  const selectedMedication = useMemo(
    () => getMedicationByCode(medicationCode) || MEDICATION_CATALOG[0],
    [medicationCode]
  );

  useEffect(() => {
    if (selectedMedication) {
      setControlledSchedule(selectedMedication.defaultSchedule);
    }
  }, [selectedMedication]);

  async function buildDoctorAuthHeaders(action: string, resource: string): Promise<HeadersInit> {
    if (!activeAccount || !unlink) {
      throw new Error("Connect doctor wallet before continuing.");
    }

    const burner = await createBurner(0);
    const privateKey = await unlink.burner.exportKey(0);
    const { Wallet, getAddress } = await import("ethers");
    const signer = new Wallet(privateKey);
    const monadWallet = getAddress(burner.address);
    if (getAddress(signer.address) !== monadWallet) {
      throw new Error("Doctor signer wallet could not be validated.");
    }

    const requestTs = Date.now().toString();
    const requestNonce = crypto.randomUUID().replaceAll("-", "");
    const message = buildDoctorWalletAuthMessage({
      doctorWallet: activeAccount.address,
      monadWallet,
      action,
      resource,
      requestTs,
      requestNonce,
    });
    const signature = await signer.signMessage(message);

    return {
      "x-doctor-monad-wallet": monadWallet,
      "x-doctor-request-ts": requestTs,
      "x-doctor-request-nonce": requestNonce,
      "x-doctor-request-signature": signature,
    };
  }

  async function loadRecords() {
    if (!activeAccount) return;
    const authHeaders = await buildDoctorAuthHeaders("list_records", "doctor_workspace");

    const response = await fetch(
      `/api/compliance/doctor/records?doctorWallet=${encodeURIComponent(activeAccount.address)}`,
      {
        headers: authHeaders,
      }
    );

    const body = (await response.json()) as {
      ok: boolean;
      records?: DoctorFiledAttestation[];
      requests?: PatientDoctorApprovalRequestRecord[];
      error?: string;
    };

    if (!response.ok || !body.ok) {
      throw new Error(body.error || "Failed to load doctor records");
    }

    setRecords(body.records || []);
    setRequests(body.requests || []);
  }

  async function handleRegisterPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;

    setError("");

    try {
      setIsRegistering(true);
      const signalTx = await send([
        {
          token: TOKEN_ADDRESS,
          recipient: activeAccount.address,
          amount: REGISTRY_SIGNAL_AMOUNT,
        },
      ]);
      const registryRelayId = signalTx.relayId;
      if (!registryRelayId) {
        throw new Error("Could not confirm on-chain registration signal.");
      }
      await waitForConfirmation(registryRelayId);

      const authHeaders = await buildDoctorAuthHeaders(
        "register_patient",
        `${registryPatientWallet.trim()}|${registryDob}|${registryRelayId}`
      );

      const response = await fetch("/api/compliance/doctor/register-patient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          doctorWallet: activeAccount.address,
          patientWallet: registryPatientWallet.trim(),
          legalName: registryLegalName.trim(),
          dob: registryDob,
          patientState: registryState.trim().toUpperCase(),
          healthCardNumber: registryHealthCard.trim(),
          registryRelayId,
        }),
      });

      const body = (await response.json()) as DoctorRegisterPatientResponse;
      if (!response.ok || !body.ok || !body.record) {
        const issueMessage = body.issues?.[0]?.message;
        throw new Error(issueMessage || body.error || "Could not register verified patient");
      }

      setRegistryPatientWallet("");
      setRegistryLegalName("");
      setRegistryDob("");
      setRegistryState("");
      setRegistryHealthCard("");
      await loadRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register patient";
      if (msg.toLowerCase().includes("insufficient balance")) {
        setError(`Insufficient Unlink private balance. Fund wallet first, then retry. (${msg})`);
      } else {
        setError(msg);
      }
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;

    setError("");

    try {
      setIsSubmitting(true);
      const authHeaders = await buildDoctorAuthHeaders(
        "file_attestation",
        `${requestId.trim()}|${patientWallet.trim()}|${medicationCode}`
      );

      const response = await fetch("/api/compliance/doctor/file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          requestId: requestId.trim(),
          doctorWallet: activeAccount.address,
          doctorNpi: doctorNpi.trim(),
          doctorDea: doctorDea.trim() || undefined,
          patientWallet: patientWallet.trim(),
          medicationCode: selectedMedication.code,
          medicationCategory: selectedMedication.label,
          controlledSchedule,
          quantity: Number(quantity),
          validUntilIso: new Date(validUntilIso).toISOString(),
          canPurchase,
        }),
      });

      const body = (await response.json()) as DoctorFileAttestationResponse;
      if (!response.ok || !body.ok || !body.attestation) {
        const issueMessage = body.issues?.[0]?.message;
        throw new Error(issueMessage || body.error || "Could not file attestation");
      }

      setCreated(body.attestation);
      await loadRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to file attestation";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyRequest(request: PatientDoctorApprovalRequestRecord) {
    setRequestId(request.requestId);
    setPatientWallet(request.patientWallet);
    setMedicationCode(request.medicationCode);
  }

  return (
    <div className="space-y-6">
      <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <form
            onSubmit={handleRegisterPatient}
            className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Verified Patient Registry</h2>
              <p className="text-sm text-zinc-400">
                Register legal patient identity against wallet before prescription approval requests are granted.
              </p>
            </div>

            {!activeAccount ? (
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <p className="text-sm text-zinc-300">Connect doctor wallet to manage registry.</p>
                <WalletConnect />
              </div>
            ) : (
              <div className="text-xs text-zinc-500 font-mono bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                Doctor wallet: {activeAccount.address}
              </div>
            )}

            <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              Wallet-sign auth enabled: each action is signed via your Monad wallet. No API keys needed.
            </div>
            <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              Registration writes an on-chain signal on Monad before patient eligibility is stored ({registrySignalDisplay} {TOKEN_SYMBOL}).
            </div>

            <input
              type="text"
              value={registryPatientWallet}
              onChange={(e) => setRegistryPatientWallet(e.target.value)}
              placeholder="Patient wallet (unlink1... or 0x...)"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
              required
            />

            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                value={registryLegalName}
                onChange={(e) => setRegistryLegalName(e.target.value)}
                placeholder="Legal full name"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
                required
              />
              <input
                type="date"
                value={registryDob}
                onChange={(e) => setRegistryDob(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                value={registryState}
                onChange={(e) => setRegistryState(e.target.value.toUpperCase())}
                placeholder="State (NY, CA, ...)"
                maxLength={2}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
                required
              />
              <input
                type="text"
                value={registryHealthCard}
                onChange={(e) => setRegistryHealthCard(e.target.value)}
                placeholder="Health card number"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
                required
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">Performance target: {performanceLabel}</p>
              <button
                type="submit"
                disabled={isRegistering || isRegistrySignalPending || !activeAccount}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white border border-zinc-700"
              >
                {isRegistrySignalPending
                  ? "Anchoring on Monad..."
                  : isRegistering
                    ? "Registering..."
                    : "Register Verified Patient"}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleCreate}
            className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Doctor Attestation Filing</h2>
              <p className="text-sm text-zinc-400">
                Approve only verified patient requests and issue customer approval codes for checkout.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                placeholder="Request ID (req_...)"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
                required
              />
              <input
                type="text"
                value={patientWallet}
                onChange={(e) => setPatientWallet(e.target.value)}
                placeholder="Patient wallet"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                value={doctorNpi}
                onChange={(e) => setDoctorNpi(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="Doctor NPI (10 digits)"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
                required
              />
              <input
                type="text"
                value={doctorDea}
                onChange={(e) => setDoctorDea(e.target.value.toUpperCase())}
                placeholder="Doctor DEA"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
                required={controlledSchedule !== "non_controlled"}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <select
                value={medicationCode}
                onChange={(e) => setMedicationCode(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white"
              >
                {MEDICATION_CATALOG.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label} · {item.category}
                  </option>
                ))}
              </select>
              <select
                value={controlledSchedule}
                onChange={(e) => setControlledSchedule(e.target.value as ControlledSchedule)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="non_controlled">Non-controlled</option>
                <option value="schedule_iii_v">Controlled (III-V)</option>
                <option value="schedule_ii">Controlled (II)</option>
              </select>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <input
                type="number"
                min={1}
                max={365}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600"
                required
              />
              <input
                type="datetime-local"
                value={validUntilIso}
                onChange={(e) => setValidUntilIso(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-white"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={canPurchase}
                onChange={(e) => setCanPurchase(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-900"
              />
              Patient is approved to purchase this prescription
            </label>

            {error && <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 p-2 rounded-lg">{error}</p>}

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !activeAccount}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white"
              >
                {isSubmitting ? "Filing..." : "File Attestation"}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-lg font-semibold text-white">Latest Approval Code</h3>
            {!created ? (
              <p className="text-sm text-zinc-500">No attestation filed yet in this session.</p>
            ) : (
              <>
                <div className="text-xs text-zinc-500">Share this with the patient</div>
                <div className="font-mono text-sm text-green-300 bg-green-950/20 border border-green-900/40 rounded-lg p-3 break-all">
                  {created.approvalCode}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <p>Request: <span className="text-zinc-200">{created.requestId}</span></p>
                  <p>Can purchase: <span className="text-zinc-200">{created.canPurchase ? "Yes" : "No"}</span></p>
                  <p>Anchor hash: <span className="text-zinc-200">{created.chainAnchor.anchorHash.slice(0, 18)}...</span></p>
                  <p>Tx hash: <span className="text-zinc-200">{created.chainAnchor.anchorTxHash.slice(0, 18)}...</span></p>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={loadRecords}
            disabled={!activeAccount}
            className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Refresh Doctor Workspace
          </button>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3 max-h-[300px] overflow-y-auto">
            <h3 className="text-sm font-semibold text-zinc-200">Pending Patient Requests</h3>
            {requests.length === 0 ? (
              <p className="text-sm text-zinc-500">No requests loaded.</p>
            ) : (
              requests.map((request) => (
                <div key={request.requestId} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 text-xs space-y-2">
                  <p className="font-mono text-zinc-300">{request.requestId}</p>
                  <p className="text-zinc-500 break-all">Patient: {request.patientWallet}</p>
                  <p className="text-zinc-500">Verification: {request.verificationStatus}</p>
                  <p className="text-zinc-500">Medication: {request.medicationCategory}</p>
                  <p className="text-zinc-600">Relay: {request.requestRelayId}</p>
                  <p className="text-zinc-600 break-all">Monad signer: {request.walletProof.monadWallet}</p>
                  <p className="text-zinc-600">Signature verified: {request.walletProof.signerVerified ? "yes" : "no"}</p>
                  <button
                    type="button"
                    onClick={() => applyRequest(request)}
                    className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 hover:bg-zinc-700"
                  >
                    Use In Filing Form
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3 max-h-[300px] overflow-y-auto">
            <h3 className="text-sm font-semibold text-zinc-200">Recent Filed Attestations</h3>
            {records.length === 0 ? (
              <p className="text-sm text-zinc-500">No records loaded.</p>
            ) : (
              records.map((record) => (
                <div key={record.attestationId} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 text-xs space-y-1">
                  <p className="font-mono text-zinc-300 break-all">{record.approvalCode}</p>
                  <p className="text-zinc-500">Request: {record.requestId}</p>
                  <p className="text-zinc-500 break-all">Patient: {record.patientWallet}</p>
                  <p className="text-zinc-500">{record.medicationCategory} · Qty {record.quantity}</p>
                  <p className="text-zinc-600">{new Date(record.issuedAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
