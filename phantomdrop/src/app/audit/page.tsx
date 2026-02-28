"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";

type DoctorAuditResult = {
  ok: boolean;
  error?: string;
  doctorWallet?: string;
  doctorName?: string;
  summary?: {
    prescriptionCount: number;
    orderCount: number;
    patientCount: number;
  };
  prescriptions?: Array<{
    approvalCode: string;
    attestationId: string;
    patientWallet: string;
    patientName?: string | null;
    medicationCode: string;
    medicationCategory: string;
    quantity: number;
    canPurchase: boolean;
    issuedAt: string;
    validUntilIso: string;
  }>;
  orders?: Array<{
    orderId: string;
    patientWallet: string;
    patientName?: string | null;
    medicationCode?: string;
    medicationCategory: string;
    amount: string;
    dropLocation: string;
    status: string;
    createdAt: string;
  }>;
};

const WALLET = /^(0x[a-fA-F0-9]{40}|unlink1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+)$/;

export default function AuditPage() {
  const [doctorWallet, setDoctorWallet] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DoctorAuditResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!WALLET.test(doctorWallet.trim())) {
      setError("Enter a valid doctor wallet (0x... or unlink1...).");
      return;
    }
    if (!adminKey.trim()) {
      setError("Admin key is required.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/compliance/audit/doctor?doctorWallet=${encodeURIComponent(doctorWallet.trim())}`,
        {
          headers: {
            "x-compliance-admin-key": adminKey.trim(),
          },
        }
      );
      const body = (await response.json()) as DoctorAuditResult;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Audit lookup failed.");
      }
      setResult(body);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Audit lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Regulatory</p>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">
            Compliance Audit Portal
          </h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-2xl leading-relaxed uppercase tracking-wide">
            Query a doctor wallet to view prescriptions issued and related client orders.
          </p>
          {result?.doctorName ? (
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wide">
              Doctor Name: {result.doctorName}
            </p>
          ) : null}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <form onSubmit={handleSubmit} className="border border-zinc-100 p-6 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="text"
              value={doctorWallet}
              onChange={(e) => setDoctorWallet(e.target.value)}
              placeholder="Doctor wallet (0x... or unlink1...)"
              className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              required
            />
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Compliance admin key"
              className="w-full bg-white border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : "Run Audit Lookup"}
          </button>
          {error ? (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 uppercase tracking-wide">
              {error}
            </p>
          ) : null}
        </form>

        {result?.summary ? (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border border-zinc-100 p-4">
                <p className="text-[10px] uppercase tracking-widest text-zinc-400">Prescriptions</p>
                <p className="text-2xl font-bold text-zinc-900">{result.summary.prescriptionCount}</p>
              </div>
              <div className="border border-zinc-100 p-4">
                <p className="text-[10px] uppercase tracking-widest text-zinc-400">Orders</p>
                <p className="text-2xl font-bold text-zinc-900">{result.summary.orderCount}</p>
              </div>
              <div className="border border-zinc-100 p-4">
                <p className="text-[10px] uppercase tracking-widest text-zinc-400">Clients</p>
                <p className="text-2xl font-bold text-zinc-900">{result.summary.patientCount}</p>
              </div>
            </div>

            <div className="border border-zinc-100 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">
                Prescriptions
              </p>
              {result.prescriptions?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-zinc-400 uppercase tracking-wide border-b border-zinc-100">
                        <th className="py-2 pr-4">Approval</th>
                        <th className="py-2 pr-4">Patient Name</th>
                        <th className="py-2 pr-4">Patient Wallet</th>
                        <th className="py-2 pr-4">Medication</th>
                        <th className="py-2 pr-4">Qty</th>
                        <th className="py-2 pr-4">Issued</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.prescriptions.map((item) => (
                        <tr key={item.attestationId} className="border-b border-zinc-50">
                          <td className="py-2 pr-4 font-mono">{item.approvalCode}</td>
                          <td className="py-2 pr-4">{item.patientName || "Unknown"}</td>
                          <td className="py-2 pr-4 font-mono">{item.patientWallet}</td>
                          <td className="py-2 pr-4">{item.medicationCategory}</td>
                          <td className="py-2 pr-4">{item.quantity}</td>
                          <td className="py-2 pr-4">{new Date(item.issuedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No prescriptions found.</p>
              )}
            </div>

            <div className="border border-zinc-100 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-900">
                Client Orders
              </p>
              {result.orders?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-zinc-400 uppercase tracking-wide border-b border-zinc-100">
                        <th className="py-2 pr-4">Order ID</th>
                        <th className="py-2 pr-4">Patient Name</th>
                        <th className="py-2 pr-4">Patient Wallet</th>
                        <th className="py-2 pr-4">Medication</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.orders.map((item) => (
                        <tr key={item.orderId} className="border-b border-zinc-50">
                          <td className="py-2 pr-4 font-mono">{item.orderId}</td>
                          <td className="py-2 pr-4">{item.patientName || "Unknown"}</td>
                          <td className="py-2 pr-4 font-mono">{item.patientWallet}</td>
                          <td className="py-2 pr-4">{item.medicationCategory}</td>
                          <td className="py-2 pr-4">{item.amount}</td>
                          <td className="py-2 pr-4 uppercase">{item.status}</td>
                          <td className="py-2 pr-4">{new Date(item.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No orders found.</p>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
