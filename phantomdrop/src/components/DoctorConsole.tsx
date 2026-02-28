"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "ethers";

import {
  ControlledSchedule,
  DoctorFileAttestationResponse,
  DoctorFiledAttestation,
  DoctorRegisterPatientRecord,
  DoctorRegisterPatientResponse,
} from "@/lib/compliance/types";
import {
  MONAD_BLOCK_TIME_MS,
  MONAD_CHAIN_ID_HEX,
  MONAD_FINALITY_MS,
  MONAD_TESTNET_EXPLORER_URL,
  MONAD_TESTNET_RPC_URL,
} from "@/lib/constants";
import {
  DEFAULT_MEDICATION_CODE,
  getMedicationByCode,
  MEDICATION_CATALOG,
} from "@/lib/compliance/medications";
import { buildDoctorWalletAuthMessage } from "@/lib/compliance/doctorAuth";

function toInitialExpiryIso(): string {
  const date = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  return date.toISOString().slice(0, 16);
}

const DOCTOR_PROFILE_STORAGE_KEY = "phantomdrop:doctor_profile:v1";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getEthereumProvider(): Eip1193Provider {
  const provider = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) {
    throw new Error("MetaMask not detected. Install MetaMask to access doctor workspace.");
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

export default function DoctorConsole() {
  const [doctorWallet, setDoctorWallet] = useState("");
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  const [registryPatientWallet, setRegistryPatientWallet] = useState("");
  const [registryLegalName, setRegistryLegalName] = useState("");
  const [registryDob, setRegistryDob] = useState("");
  const [registryState, setRegistryState] = useState("");
  const [registryHealthCard, setRegistryHealthCard] = useState("");

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
  const [isRefreshingWorkspace, setIsRefreshingWorkspace] = useState(false);
  const [isCopyingApproval, setIsCopyingApproval] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<DoctorFiledAttestation | null>(null);
  const [records, setRecords] = useState<DoctorFiledAttestation[]>([]);
  const [verifiedPatients, setVerifiedPatients] = useState<DoctorRegisterPatientRecord[]>([]);

  const performanceLabel = useMemo(
    () => `${MONAD_BLOCK_TIME_MS}ms blocks · ${MONAD_FINALITY_MS}ms finality`,
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DOCTOR_PROFILE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { doctorNpi?: string; doctorDea?: string };
      if (parsed.doctorNpi) setDoctorNpi(parsed.doctorNpi);
      if (parsed.doctorDea) setDoctorDea(parsed.doctorDea);
    } catch {
      // Ignore malformed local profile data.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DOCTOR_PROFILE_STORAGE_KEY,
      JSON.stringify({
        doctorNpi: doctorNpi.trim(),
        doctorDea: doctorDea.trim().toUpperCase(),
      })
    );
  }, [doctorNpi, doctorDea]);

  const connectDoctorWallet = useCallback(async () => {
    setError("");
    setIsConnectingWallet(true);
    try {
      const provider = getEthereumProvider();
      await ensureMonadTestnet(provider);
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const account = accounts?.[0];
      if (!account) {
        throw new Error("No MetaMask account selected.");
      }
      setDoctorWallet(getAddress(account));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not connect MetaMask";
      setError(msg);
    } finally {
      setIsConnectingWallet(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const provider = getEthereumProvider();
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        if (cancelled) return;
        if (accounts?.[0]) {
          setDoctorWallet(getAddress(accounts[0]));
        }
      } catch {
        // MetaMask missing or not accessible; handled by connect flow.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const provider = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
    if (!provider?.on || !provider.removeListener) {
      return;
    }

    const listener = (...args: unknown[]) => {
      if (!active) return;
      const accounts = (args?.[0] as string[]) || [];
      if (!accounts[0]) {
        setDoctorWallet("");
        return;
      }
      try {
        setDoctorWallet(getAddress(accounts[0]));
      } catch {
        setDoctorWallet(accounts[0]);
      }
    };

    provider.on("accountsChanged", listener);
    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", listener);
    };
  }, []);

  const buildDoctorAuthHeaders = useCallback(
    async (action: string, resource: string): Promise<HeadersInit> => {
      if (!doctorWallet) {
        throw new Error("Connect doctor wallet before continuing.");
      }

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
      if (normalized !== doctorWallet) {
        setDoctorWallet(normalized);
      }

      const requestTs = Date.now().toString();
      const requestNonce = crypto.randomUUID().replaceAll("-", "");
      const message = buildDoctorWalletAuthMessage({
        doctorWallet: normalized,
        monadWallet: normalized,
        action,
        resource,
        requestTs,
        requestNonce,
      });

      const signature = (await provider.request({
        method: "personal_sign",
        params: [message, normalized],
      })) as string;

      return {
        "x-doctor-monad-wallet": normalized,
        "x-doctor-request-ts": requestTs,
        "x-doctor-request-nonce": requestNonce,
        "x-doctor-request-signature": signature,
      };
    },
    [doctorWallet]
  );

  const loadRecords = useCallback(async () => {
    if (!doctorWallet) return;

    const response = await fetch(
      `/api/compliance/doctor/records?doctorWallet=${encodeURIComponent(doctorWallet)}`
    );

    const body = (await response.json()) as {
      ok: boolean;
      records?: DoctorFiledAttestation[];
      verifiedPatients?: DoctorRegisterPatientRecord[];
      error?: string;
    };

    if (!response.ok || !body.ok) {
      throw new Error(body.error || "Failed to load doctor records");
    }

    setRecords(body.records || []);
    setVerifiedPatients(body.verifiedPatients || []);
  }, [doctorWallet]);

  const refreshWorkspace = useCallback(async () => {
    if (!doctorWallet) return;
    setError("");
    setIsRefreshingWorkspace(true);
    try {
      await loadRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to refresh doctor workspace";
      setError(msg);
    } finally {
      setIsRefreshingWorkspace(false);
    }
  }, [doctorWallet, loadRecords]);

  useEffect(() => {
    if (!doctorWallet) return;
    refreshWorkspace().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to load doctor workspace";
      setError(msg);
    });
  }, [doctorWallet, refreshWorkspace]);

  async function handleRegisterPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorWallet) return;

    setError("");

    try {
      setIsRegistering(true);
      const registryRelayId = `regsig_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;

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
          doctorWallet,
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

      setRegistryLegalName("");
      setRegistryDob("");
      setRegistryState("");
      setRegistryHealthCard("");
      setPatientWallet(registryPatientWallet.trim());
      await loadRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register patient";
      setError(msg);
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorWallet) return;

    setError("");

    try {
      setIsSubmitting(true);
      if (!patientWallet.trim()) {
        throw new Error("Patient wallet is required. Use Step 1 or pick from verified patients.");
      }

      const authHeaders = await buildDoctorAuthHeaders(
        "file_attestation",
        `manual|${patientWallet.trim()}|${medicationCode}`
      );

      const response = await fetch("/api/compliance/doctor/file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          doctorWallet,
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

  function applyVerifiedPatient(record: DoctorRegisterPatientRecord) {
    setRegistryPatientWallet(record.patientWallet);
    setPatientWallet(record.patientWallet);
  }

  if (!doctorWallet) {
    return (
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Doctor Login</h2>
          <p className="text-sm text-zinc-400">
            Connect MetaMask once to load your workspace immediately. No separate funding step is required.
          </p>
        </div>

        <button
          type="button"
          onClick={connectDoctorWallet}
          disabled={isConnectingWallet}
          className="w-full md:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white"
        >
          {isConnectingWallet ? "Connecting..." : "Connect MetaMask"}
        </button>

        <p className="text-xs text-zinc-500">
          This signs secure auth messages only. It does not move funds.
        </p>

        {error ? (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 p-3 rounded-xl">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Doctor Wallet</p>
          <p className="text-xs font-mono text-zinc-300 break-all">{doctorWallet}</p>
        </div>

        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Connection</p>
          <p className="text-sm text-zinc-300">MetaMask authenticated</p>
          <button
            type="button"
            onClick={connectDoctorWallet}
            disabled={isConnectingWallet}
            className="mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            {isConnectingWallet ? "Switching..." : "Switch Wallet"}
          </button>
        </div>

        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Workspace</p>
          <p className="text-sm text-zinc-300">
            Verified patients: <span className="text-white font-semibold">{verifiedPatients.length}</span>
          </p>
          <p className="text-sm text-zinc-300">
            Filed attestations: <span className="text-white font-semibold">{records.length}</span>
          </p>
          <button
            type="button"
            onClick={refreshWorkspace}
            disabled={isRefreshingWorkspace}
            className="mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            {isRefreshingWorkspace ? "Refreshing..." : "Refresh Workspace"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 p-3 rounded-xl">{error}</p>
      ) : null}

      <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <form
            onSubmit={handleRegisterPatient}
            className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Step 1: Register Verified Patient</h2>
              <p className="text-sm text-zinc-400">
                Register legal patient identity against wallet once before filing approvals.
              </p>
            </div>

            <div className="text-xs text-zinc-500 font-mono bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              Doctor wallet: {doctorWallet}
            </div>

            <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              Wallet-sign auth enabled: each action is signed with MetaMask. No API keys needed.
            </div>
            <div className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              No upfront funding required for registry setup. Step 1 is secured with wallet signature + nonce.
            </div>

            <input
              type="text"
              value={registryPatientWallet}
              onChange={(e) => {
                const value = e.target.value;
                setRegistryPatientWallet(value);
                setPatientWallet(value);
              }}
              placeholder="Patient wallet (0x... recommended)"
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
                disabled={isRegistering}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white border border-zinc-700"
              >
                {isRegistering ? "Registering..." : "Register Verified Patient"}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleCreate}
            className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Step 2: File Doctor Attestation</h2>
              <p className="text-sm text-zinc-400">
                Choose a verified patient wallet, confirm medication policy, then issue approval for patient checkout.
              </p>
            </div>

            <input
              type="text"
              value={patientWallet}
              readOnly
              placeholder="Patient wallet (auto-filled)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-300 placeholder-zinc-600"
              required
            />

            <p className="text-xs text-zinc-500">
              Patient wallet auto-fills from Step 1 or from the verified-patient list below. Request ID is not required.
            </p>

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

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
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
                <div className="flex items-center gap-2">
                  <div className="font-mono text-sm text-green-300 bg-green-950/20 border border-green-900/40 rounded-lg p-3 break-all flex-1">
                    {created.approvalCode}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(created.approvalCode);
                      setIsCopyingApproval(true);
                      setTimeout(() => setIsCopyingApproval(false), 1200);
                    }}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 hover:bg-zinc-700"
                  >
                    {isCopyingApproval ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <p>Reference: <span className="text-zinc-200">{created.requestId}</span></p>
                  <p>Can purchase: <span className="text-zinc-200">{created.canPurchase ? "Yes" : "No"}</span></p>
                  <p>Anchor hash: <span className="text-zinc-200">{created.chainAnchor.anchorHash.slice(0, 18)}...</span></p>
                  <p>Tx hash: <span className="text-zinc-200">{created.chainAnchor.anchorTxHash.slice(0, 18)}...</span></p>
                </div>
              </>
            )}
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3 max-h-[300px] overflow-y-auto">
            <h3 className="text-sm font-semibold text-zinc-200">Verified Patients</h3>
            {verifiedPatients.length === 0 ? (
              <p className="text-sm text-zinc-500">No verified patients in this workspace yet.</p>
            ) : (
              verifiedPatients.map((record) => (
                <div key={record.registryId} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 text-xs space-y-2">
                  <p className="font-mono text-zinc-300 break-all">{record.patientWallet}</p>
                  <p className="text-zinc-500">Registry: {record.registryId}</p>
                  <p className="text-zinc-600">Verified: {new Date(record.verifiedAt).toLocaleString()}</p>
                  <button
                    type="button"
                    onClick={() => applyVerifiedPatient(record)}
                    className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 hover:bg-zinc-700"
                  >
                    Use Patient Wallet
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
                  <p className="text-zinc-500">Reference: {record.requestId}</p>
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
