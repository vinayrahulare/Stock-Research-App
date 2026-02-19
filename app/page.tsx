import HoldingsTable from "./ui/HoldingsTable";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-medium text-slate-300">Total Holdings</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-50">
            {/* Placeholder; could be wired to an aggregate API later */}
            —
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-medium text-slate-300">Average Yield</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-50">—</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-medium text-slate-300">Undervalued Ideas</h2>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">—</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              Holdings snapshot
            </h2>
            <p className="text-sm text-slate-400">
              A simple view of tickers from your dividend portfolio database.
            </p>
          </div>
        </div>
        <HoldingsTable />
      </section>
    </div>
  );
}

