"use client";

import Navbar from "@/components/Navbar";
import DoctorConsole from "@/components/DoctorConsole";
import FundWalletCard from "@/components/FundWalletCard";

export default function DoctorPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-12 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Doctor Attestation Console</h1>
          <p className="text-zinc-400 text-sm max-w-3xl">
            File purchase eligibility on behalf of patients, secure it with signed transport, and expose customer approval codes for a frictionless checkout experience.
          </p>
        </div>

        <FundWalletCard />
        <DoctorConsole />
      </main>
    </div>
  );
}
