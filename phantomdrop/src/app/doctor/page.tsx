"use client";

import Navbar from "@/components/Navbar";
import DoctorConsole from "@/components/DoctorConsole";

export default function DoctorPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Provider portal</p>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">Doctor Attestation Console</h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-2xl leading-relaxed uppercase tracking-wide">
            Two-step flow — register verified patient, then file attestation. Wallet-sign security built in.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <DoctorConsole />
      </main>
    </div>
  );
}
