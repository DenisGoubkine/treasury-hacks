"use client";

import Navbar from "@/components/Navbar";
import DoctorConsole from "@/components/DoctorConsole";

export default function DoctorPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-12 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Doctor Attestation Console</h1>
          <p className="text-zinc-400 text-sm max-w-3xl">
            Clean 2-step flow: register verified patient, then file attestation. Wallet-sign security is built in.
          </p>
        </div>

        <DoctorConsole />
      </main>
    </div>
  );
}
