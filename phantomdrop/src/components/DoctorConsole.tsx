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
  MedicationCatalogItem,
  MEDICATION_CATALOG,
} from "@/lib/compliance/medications";
import { buildDoctorWalletAuthMessage } from "@/lib/compliance/doctorAuth";
import MedicationSelector from "@/components/MedicationSelector";

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

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

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
  const initialMedication =
    getMedicationByCode(DEFAULT_MEDICATION_CODE) || MEDICATION_CATALOG[0] || null;

  const [doctorWallet, setDoctorWallet] = useState("");
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  const [registryPatientWallet, setRegistryPatientWallet] = useState("");
  const [registryLegalName, setRegistryLegalName] = useState("");
  const [registryDob, setRegistryDob] = useState("");
  const [registryState, setRegistryState] = useState("");
  const [registryHealthCard, setRegistryHealthCard] = useState("");

  const [patientWallet, setPatientWallet] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorNpi, setDoctorNpi] = useState("");
  const [doctorDea, setDoctorDea] = useState("");
  const [selectedMedication, setSelectedMedication] = useState<MedicationCatalogItem | null>(
    initialMedication
  );
  const [medicationCode, setMedicationCode] = useState<string>(
    initialMedication?.code || DEFAULT_MEDICATION_CODE
  );
  const [medicationDisplayLabel, setMedicationDisplayLabel] = useState<string>(
    initialMedication?.label || ""
  );
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
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editWalletValue, setEditWalletValue] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const performanceLabel = useMemo(
    () => `${MONAD_BLOCK_TIME_MS}ms blocks · ${MONAD_FINALITY_MS}ms finality`,
    []
  );

  useEffect(() => {
    if (!selectedMedication) return;
    setMedicationCode(selectedMedication.code);
    setMedicationDisplayLabel(selectedMedication.label);
    setControlledSchedule(selectedMedication.defaultSchedule);
  }, [selectedMedication]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DOCTOR_PROFILE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { doctorName?: string; doctorNpi?: string; doctorDea?: string };
      if (parsed.doctorName) setDoctorName(parsed.doctorName);
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
        doctorName: doctorName.trim(),
        doctorNpi: doctorNpi.trim(),
        doctorDea: doctorDea.trim().toUpperCase(),
      })
    );
  }, [doctorName, doctorNpi, doctorDea]);

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

    const body = await readJsonSafe<{
      ok: boolean;
      records?: DoctorFiledAttestation[];
      verifiedPatients?: DoctorRegisterPatientRecord[];
      error?: string;
    }>(response);

    if (!response.ok || !body?.ok) {
      throw new Error(body?.error || `Failed to load doctor records (${response.status})`);
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
          doctorName: doctorName.trim() || undefined,
          patientWallet: registryPatientWallet.trim(),
          legalName: registryLegalName.trim(),
          dob: registryDob,
          patientState: registryState.trim().toUpperCase(),
          healthCardNumber: registryHealthCard.trim(),
          registryRelayId,
        }),
      });

      const body = await readJsonSafe<DoctorRegisterPatientResponse>(response);
      if (!response.ok || !body?.ok || !body.record) {
        const issueMessage = body?.issues?.[0]?.message;
        throw new Error(
          issueMessage ||
            body?.error ||
            `Could not register verified patient (${response.status})`
        );
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
          medicationCode: selectedMedication?.code || medicationCode.trim(),
          medicationCategory:
            medicationDisplayLabel.trim() ||
            selectedMedication?.label ||
            medicationCode.trim(),
          medicationSource: selectedMedication?.source || "fda",
          ndc: selectedMedication?.ndc,
          activeIngredient: selectedMedication?.activeIngredient,
          strength: selectedMedication?.strength,
          dosageForm: selectedMedication?.dosageForm,
          controlledSchedule,
          quantity: Number(quantity),
          validUntilIso: new Date(validUntilIso).toISOString(),
          canPurchase,
        }),
      });

      const body = await readJsonSafe<DoctorFileAttestationResponse>(response);
      if (!response.ok || !body?.ok || !body.attestation) {
        const issueMessage = body?.issues?.[0]?.message;
        throw new Error(
          issueMessage ||
            body?.error ||
            `Could not file attestation (${response.status})`
        );
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

  async function handleUpdatePatientWallet(oldWallet: string) {
    if (!doctorWallet || !editWalletValue.trim()) return;
    setError("");
    setIsSavingEdit(true);
    try {
      const authHeaders = await buildDoctorAuthHeaders(
        "update_patient",
        `${oldWallet}|${editWalletValue.trim()}`
      );

      const response = await fetch("/api/compliance/doctor/update-patient", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          doctorWallet,
          oldPatientWallet: oldWallet,
          newPatientWallet: editWalletValue.trim(),
        }),
      });

      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Could not update patient wallet");
      }

      setEditingPatientId(null);
      setEditWalletValue("");
      await loadRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update patient wallet";
      setError(msg);
    } finally {
      setIsSavingEdit(false);
    }
  }

  if (!doctorWallet) {
    return (
      <div className="border border-zinc-100 p-8 space-y-6 max-w-md">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Doctor Login</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Connect MetaMask once to load your workspace immediately. No separate funding step is required.
          </p>
        </div>

        <button
          type="button"
          onClick={connectDoctorWallet}
          disabled={isConnectingWallet}
          className="px-8 py-3.5 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 transition-colors"
        >
          {isConnectingWallet ? "Connecting..." : "Connect MetaMask →"}
        </button>

        <p className="text-xs text-zinc-400 uppercase tracking-wide">
          Signs secure auth messages only. Does not move funds.
        </p>

        {error ? (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 uppercase tracking-wide">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="border border-zinc-100 bg-zinc-50 p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">Doctor Wallet</p>
          <p className="text-xs font-mono text-zinc-600 break-all">{doctorWallet}</p>
        </div>

        <div className="border border-zinc-100 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">Connection</p>
          <p className="text-xs text-zinc-600">MetaMask authenticated</p>
          <button
            type="button"
            onClick={connectDoctorWallet}
            disabled={isConnectingWallet}
            className="mt-1 text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 uppercase tracking-widest transition-colors"
          >
            {isConnectingWallet ? "Switching..." : "Switch Wallet"}
          </button>
        </div>

        <div className="border border-zinc-100 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">Workspace</p>
          <p className="text-xs text-zinc-600">
            Verified patients: <span className="font-bold text-zinc-900">{verifiedPatients.length}</span>
          </p>
          <p className="text-xs text-zinc-600">
            Pharmacy status: <span className="font-bold text-green-700">Linked</span>
          </p>
          <p className="text-xs text-zinc-600">
            Filed attestations: <span className="font-bold text-zinc-900">{records.length}</span>
          </p>
          <button
            type="button"
            onClick={refreshWorkspace}
            disabled={isRefreshingWorkspace}
            className="mt-1 text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 uppercase tracking-widest transition-colors"
          >
            {isRefreshingWorkspace ? "Refreshing..." : "Refresh Workspace"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 uppercase tracking-wide">{error}</p>
      ) : null}

      <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <form
            onSubmit={handleRegisterPatient}
            className="border border-zinc-100 p-6 space-y-4"
          >
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Step 01 — Register Verified Patient</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Register legal patient identity against wallet once before filing approvals.
              </p>
            </div>

            <div className="text-xs text-zinc-500 font-mono border border-zinc-100 bg-zinc-50 px-3 py-2">
              Doctor wallet: {doctorWallet}
            </div>

            <div className="text-xs text-zinc-400 border border-zinc-100 bg-zinc-50 px-3 py-2">
              Wallet-sign auth enabled — each action signed with MetaMask. No API keys needed.
            </div>
            <div className="text-xs text-zinc-400 border border-zinc-100 bg-zinc-50 px-3 py-2">
              No upfront funding required. Step 1 secured with wallet signature + nonce.
            </div>

            <input
              type="text"
              value={registryPatientWallet}
              onChange={(e) => {
                const value = e.target.value;
                setRegistryPatientWallet(value);
                setPatientWallet(value);
              }}
              placeholder="Patient wallet (0x...)"
              className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              required
            />

            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                value={registryLegalName}
                onChange={(e) => setRegistryLegalName(e.target.value)}
                placeholder="Legal full name"
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                required
              />
              <input
                type="date"
                value={registryDob}
                onChange={(e) => setRegistryDob(e.target.value)}
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors"
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
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                required
              />
              <input
                type="text"
                value={registryHealthCard}
                onChange={(e) => setRegistryHealthCard(e.target.value)}
                placeholder="Health card number"
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                required
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-400 uppercase tracking-wide">{performanceLabel}</p>
              <button
                type="submit"
                disabled={isRegistering}
                className="px-5 py-2.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isRegistering ? "Registering..." : "Register Patient"}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleCreate}
            className="border border-zinc-100 p-6 space-y-4"
          >
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Step 02 — File Doctor Attestation</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Choose a verified patient wallet, confirm medication policy, then issue approval for patient checkout.
              </p>
            </div>

            <input
              type="text"
              value={patientWallet}
              readOnly
              placeholder="Patient wallet (auto-filled from Step 1)"
              className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2.5 text-xs text-zinc-600 placeholder-zinc-400 focus:outline-none transition-colors"
              required
            />

            <p className="text-xs text-zinc-400">
              Patient wallet auto-fills from Step 1 or from the verified-patient list.
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Doctor full name"
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              />
              <input
                type="text"
                value={doctorNpi}
                onChange={(e) => setDoctorNpi(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="Doctor NPI (10 digits)"
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                required
              />
              <input
                type="text"
                value={doctorDea}
                onChange={(e) => setDoctorDea(e.target.value.toUpperCase())}
                placeholder="Doctor DEA"
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                required={controlledSchedule !== "non_controlled"}
              />
            </div>

            <div className="space-y-3">
              <MedicationSelector
                value={selectedMedication}
                onSelect={(item) => {
                  setSelectedMedication(item);
                  setMedicationCode(item.code);
                }}
              />

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={medicationDisplayLabel}
                  onChange={(e) => setMedicationDisplayLabel(e.target.value)}
                  placeholder="Dispense label / dosage (editable)"
                  className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                  required
                />
                <input
                  type="text"
                  value={medicationCode}
                  readOnly
                  className="w-full bg-zinc-50 border border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <select
                value={controlledSchedule}
                onChange={(e) => setControlledSchedule(e.target.value as ControlledSchedule)}
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors appearance-none"
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
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                required
              />
              <input
                type="datetime-local"
                value={validUntilIso}
                onChange={(e) => setValidUntilIso(e.target.value)}
                className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-600 uppercase tracking-wide">
              <input
                type="checkbox"
                checked={canPurchase}
                onChange={(e) => setCanPurchase(e.target.checked)}
                className="border-zinc-300"
              />
              Patient approved to purchase this prescription
            </label>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-[#00E100] text-black text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? "Filing..." : "File Attestation →"}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className="border border-zinc-100 p-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Latest Approval Code</p>
            {!created ? (
              <p className="text-xs text-zinc-400">No attestation filed yet in this session.</p>
            ) : (
              <>
                <div className="text-xs text-zinc-400 uppercase tracking-wide">Share this code with the patient</div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-xs text-[#00E100] border border-green-200 bg-green-50 px-3 py-2.5 break-all flex-1">
                    {created.approvalCode}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(created.approvalCode);
                      setIsCopyingApproval(true);
                      setTimeout(() => setIsCopyingApproval(false), 1200);
                    }}
                    className="text-xs px-3 py-2 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 uppercase tracking-widest transition-colors"
                  >
                    {isCopyingApproval ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <p>Ref: <span className="text-zinc-700">{created.requestId}</span></p>
                  <p>Can buy: <span className="text-zinc-700">{created.canPurchase ? "Yes" : "No"}</span></p>
                  <p>Anchor: <span className="text-zinc-700 font-mono">{created.chainAnchor.anchorHash.slice(0, 14)}...</span></p>
                  <p>Tx: <span className="text-zinc-700 font-mono">{created.chainAnchor.anchorTxHash.slice(0, 14)}...</span></p>
                </div>
              </>
            )}
          </div>

          <div className="border border-zinc-100 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">
              Pharmacy Link
            </p>
            <p className="text-xs text-zinc-500">
              Your doctor workspace is automatically connected to pharmacy handoff.
            </p>
            <div className="border border-green-200 bg-green-50 px-3 py-2.5 text-xs">
              <p className="font-bold uppercase tracking-widest text-green-700">Active</p>
              <p className="font-mono text-zinc-600 break-all mt-1">{doctorWallet}</p>
            </div>
          </div>

          <div className="border border-zinc-100 p-4 space-y-3 max-h-[300px] overflow-y-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Verified Patients</p>
            {verifiedPatients.length === 0 ? (
              <p className="text-xs text-zinc-400">No verified patients in this workspace yet.</p>
            ) : (
              verifiedPatients.map((record) => (
                <div key={record.registryId} className="border border-zinc-100 bg-zinc-50 p-3 text-xs space-y-1.5">
                  {editingPatientId === record.registryId ? (
                    <>
                      <input
                        type="text"
                        value={editWalletValue}
                        onChange={(e) => setEditWalletValue(e.target.value)}
                        placeholder="New wallet address (0x...)"
                        className="w-full bg-white border border-zinc-300 px-3 py-2 text-xs font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleUpdatePatientWallet(record.patientWallet)}
                          disabled={isSavingEdit || !editWalletValue.trim()}
                          className="text-xs px-3 py-1.5 bg-[#00E100] text-black font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-50 transition-colors"
                        >
                          {isSavingEdit ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingPatientId(null); setEditWalletValue(""); }}
                          className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 uppercase tracking-widest transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-mono text-zinc-600 break-all">{record.patientWallet}</p>
                      <p className="text-zinc-400">Registry: {record.registryId}</p>
                      <p className="text-zinc-400">Verified: {new Date(record.verifiedAt).toLocaleString()}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => applyVerifiedPatient(record)}
                          className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 uppercase tracking-widest transition-colors"
                        >
                          Use Wallet
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingPatientId(record.registryId); setEditWalletValue(record.patientWallet); }}
                          className="text-xs px-3 py-1.5 border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 uppercase tracking-widest transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border border-zinc-100 p-4 space-y-3 max-h-[300px] overflow-y-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">Recent Filed Attestations</p>
            {records.length === 0 ? (
              <p className="text-xs text-zinc-400">No records loaded.</p>
            ) : (
              records.map((record) => (
                <div key={record.attestationId} className="border border-zinc-100 bg-zinc-50 p-3 text-xs space-y-1">
                  <p className="font-mono text-zinc-600 break-all">{record.approvalCode}</p>
                  <p className="text-zinc-400">Ref: {record.requestId}</p>
                  <p className="text-zinc-400 break-all">Patient: {record.patientWallet}</p>
                  <p className="text-zinc-400">{record.medicationCategory} · Qty {record.quantity}</p>
                  <p className="text-zinc-400">{new Date(record.issuedAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
