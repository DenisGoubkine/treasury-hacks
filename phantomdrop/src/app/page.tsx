import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-zinc-100 pdm-grid-bg">
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div className="inline-flex items-center gap-2 border border-zinc-200 px-3 py-1 text-xs uppercase tracking-widest text-zinc-500 mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E100] animate-pulse" />
            Live on Monad Testnet
          </div>

          <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tighter leading-[0.95] mb-8 max-w-3xl text-zinc-900">
            Your medication.<br />
            Your privacy.<br />
            <span className="text-[#00E100]">No trace.</span>
          </h1>

          <div className="text-xs text-zinc-500 max-w-lg mb-12 space-y-1 uppercase tracking-wide">
            <p>Patients buy medication without exposing their identity on-chain.</p>
            <p>Doctors approve prescriptions through encrypted attestations.</p>
            <p>Couriers deliver sealed packages and get paid automatically.</p>
            <p>Built on Monad. Escrowed with Unlink. Zero data collected.</p>
          </div>

          <div className="flex flex-wrap items-stretch">
            <Link
              href="/order"
              className="px-8 py-4 bg-[#00E100] text-black text-xs uppercase tracking-widest font-bold hover:bg-zinc-900 hover:text-white transition-colors"
            >
              Patient →
            </Link>
            <Link
              href="/courier"
              className="px-8 py-4 border border-zinc-200 border-l-0 text-xs uppercase tracking-widest text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 transition-colors"
            >
              Courier →
            </Link>
            <Link
              href="/doctor"
              className="px-8 py-4 border border-zinc-200 border-l-0 text-xs uppercase tracking-widest text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 transition-colors"
            >
              Doctor Console →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
            {[
              {
                step: "01",
                title: "Doctor Files Approval",
                desc: "Doctor submits an encrypted attestation tied to the patient's wallet and prescription policy.",
              },
              {
                step: "02",
                title: "Patient Uses Approval Code",
                desc: "Patient enters approval code and pays escrow in one flow. No medical jargon at checkout.",
              },
              {
                step: "03",
                title: "Delivery + Auto Settlement",
                desc: "Courier confirms dropoff, AI verifies package presence, and escrow releases with Monad-speed finality.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="p-8 space-y-4">
                <span className="text-xs text-[#00E100] uppercase tracking-widest">{step}</span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900">{title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy guarantees */}
      <section className="border-b border-zinc-100 bg-zinc-50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4">
            <div className="md:pr-8 md:border-r border-zinc-200 pb-8 md:pb-0 mb-8 md:mb-0">
              <span className="text-xs uppercase tracking-widest text-[#00E100]">Privacy Guarantee</span>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed uppercase tracking-wide">Zero personal data. Ever.</p>
            </div>
            <div className="md:col-span-3 md:pl-8 grid sm:grid-cols-2 gap-3">
              {[
                "Patient identity never revealed",
                "Courier identity never revealed to patient",
                "Payment amount hidden on-chain via ZK",
                "No on-chain link between patient and courier",
                "Delivery address has no name attached",
                "Order contents known only to patient & pharmacy",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-zinc-500 uppercase tracking-wide">
                  <span className="text-[#00E100] shrink-0 mt-0.5">+</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-3 divide-x divide-zinc-100">
          {[
            { value: "58%", label: "of Americans avoided filling a prescription due to privacy concerns" },
            { value: "0", label: "personal data collected. Ever." },
            { value: "800ms", label: "to finality on Monad — fastest escrow settlement anywhere" },
          ].map(({ value, label }) => (
            <div key={value} className="px-8 first:pl-0 last:pr-0 space-y-3">
              <p className="text-4xl md:text-5xl font-bold text-zinc-900">{value}</p>
              <p className="text-xs text-zinc-400 leading-snug uppercase tracking-wide max-w-[180px]">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
