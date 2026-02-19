import React from "react";
import { getHoldings } from "../utils/data";

export default async function HoldingsTable() {
  const holdings = await getHoldings();

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
        No holdings found yet. Once you import your CSV into Postgres, they
        will appear here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900/70">
          <tr>
            <Th>Ticker</Th>
            <Th>Company</Th>
            <Th>Sector</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-right">P/E</Th>
            <Th className="text-right">Ann. Div</Th>
            <Th className="text-right">Cur. Yield</Th>
            <Th>Valuation</Th>
            <Th>SI Verdict</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900/60">
          {holdings.map((h) => (
            <tr key={h.id} className="hover:bg-slate-900/40">
              <Td className="font-mono text-emerald-300">{h.ticker}</Td>
              <Td>{h.company}</Td>
              <Td className="text-slate-300">{h.sector}</Td>
              <Td className="text-right tabular-nums">
                ${Number(h.price).toFixed(2)}
              </Td>
              <Td className="text-right tabular-nums text-slate-300">
                {h.pe != null ? Number(h.pe).toFixed(1) : "—"}
              </Td>
              <Td className="text-right tabular-nums text-slate-300">
                ${Number(h.annualDiv).toFixed(2)}
              </Td>
              <Td className="text-right tabular-nums text-emerald-300">
                {Number(h.currentYield).toFixed(2)}%
              </Td>
              <Td>
                <span
                  className={
                    h.valuation.toLowerCase().startsWith("under")
                      ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400"
                      : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400"
                  }
                >
                  {h.valuation}
                </span>
              </Td>
              <Td className="text-slate-300">{h.siVerdict}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 align-middle text-sm text-slate-100 ${className}`}>
      {children}
    </td>
  );
}

