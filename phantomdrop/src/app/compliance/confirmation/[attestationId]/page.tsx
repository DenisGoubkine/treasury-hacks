import Link from "next/link";
import Navbar from "@/components/Navbar";

export default async function ComplianceConfirmationPage({
  params,
}: {
  params: Promise<{ attestationId: string }>;
}) {
  const { attestationId } = await params;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Compliance</p>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">
            Doctor + Pharmacy Confirmation
          </h1>
          <p className="text-xs text-zinc-500 mt-2 uppercase tracking-wide">
            Courier-facing confirmation reference for handoff verification.
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-4">
        <div className="border border-green-200 bg-green-50 px-5 py-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700">
            Order confirmed between doctor and pharmacy
          </p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Use this reference at pickup. Only courier-necessary data is shown.
          </p>
        </div>

        <div className="border border-zinc-100 bg-zinc-50 px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">Attestation ID</p>
          <p className="font-mono text-xs text-zinc-700 break-all">{attestationId}</p>
        </div>

        <Link
          href="/courier"
          className="inline-block px-4 py-2 border border-zinc-200 text-xs uppercase tracking-widest text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-colors"
        >
          Back to Courier Dashboard
        </Link>
      </main>
    </div>
  );
}
