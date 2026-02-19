import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Dividend Portfolio",
  description: "Personal dividend portfolio dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
          <header className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              Dividend Portfolio
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              Personal dashboard
            </span>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

