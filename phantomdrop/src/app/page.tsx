import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 pt-20 pb-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-900/30 border border-purple-700/40 rounded-full text-purple-300 text-sm">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Live on Monad Testnet
        </div>

        <h1 className="text-5xl font-bold tracking-tight leading-tight">
          Your medication.{" "}
          <span className="text-purple-400">Your privacy.</span>{" "}
          <br />
          No trace.
        </h1>

        <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Anonymous pharmaceutical delivery with private stablecoin escrow.
          AI confirms delivery. ZK proofs hide everything. The only payment
          rail where escrow + anonymity + delivery verification all work together.
        </p>

        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href="/order"
            className="px-8 py-3.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-white transition-colors text-base"
          >
            I&apos;m a Patient →
          </Link>
          <Link
            href="/courier"
            className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-semibold text-zinc-200 transition-colors text-base border border-zinc-700"
          >
            I&apos;m a Courier →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-center text-2xl font-bold mb-10 text-zinc-200">
          How it works
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: "🔒",
              step: "01",
              title: "Order Anonymously",
              desc: "Connect your Unlink wallet — no name, no account, no data. Choose medication category and drop location. Pay with private stablecoins.",
            },
            {
              icon: "🚴",
              step: "02",
              title: "Courier Delivers",
              desc: "A courier picks up a sealed package. They only see delivery coordinates — never your identity or what's inside.",
            },
            {
              icon: "✅",
              step: "03",
              title: "AI Verifies. Escrow Releases.",
              desc: "Courier uploads a doorstep photo. GPT-4o confirms the package arrived. Escrow releases automatically. No trust required.",
            },
          ].map(({ icon, step, title, desc }) => (
            <div
              key={step}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{icon}</span>
                <span className="text-xs font-mono text-zinc-600">{step}</span>
              </div>
              <h3 className="font-semibold text-white text-lg">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy guarantees */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <div className="bg-zinc-900/50 border border-purple-900/40 rounded-2xl p-8 space-y-4">
          <h3 className="text-purple-400 font-semibold text-lg">
            🔐 Privacy Guarantee
          </h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-zinc-400">
            {[
              "Patient identity never revealed",
              "Courier identity never revealed to patient",
              "Payment amount hidden on-chain (ZK)",
              "No on-chain link between patient and courier",
              "Delivery address has no name attached",
              "Order contents known only to patient & pharmacy",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-3xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-3 gap-6 text-center">
          {[
            { value: "58%", label: "of Americans avoided filling a prescription due to privacy concerns" },
            { value: "0", label: "personal data collected. Ever." },
            { value: "800ms", label: "to finality on Monad — fastest escrow settlement anywhere" },
          ].map(({ value, label }) => (
            <div key={value} className="space-y-2">
              <p className="text-3xl font-bold text-purple-400">{value}</p>
              <p className="text-xs text-zinc-500 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
