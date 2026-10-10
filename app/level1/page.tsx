'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileText, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { Bill, Charge, RegisterReading, Tax } from '@/lib/level1/schema';

interface BillResult {
  billId: string;
  bill: Bill | null;
  imageDataUrl: string | null;
}

const FIELD_ROWS: Array<{ label: string; key: keyof Bill }> = [
  { label: 'Provider', key: 'provider' },
  { label: 'Tariff', key: 'tariff' },
  { label: 'Sanctioned load (kW)', key: 'sanctioned_load_kw' },
  { label: 'Bill month', key: 'bill_month' },
  { label: 'Reading date', key: 'reading_date' },
  { label: 'Issue date', key: 'issue_date' },
  { label: 'Due date', key: 'due_date' },
  { label: 'Previous reading', key: 'previous_reading' },
  { label: 'Current reading', key: 'current_reading' },
  { label: 'Units consumed', key: 'units_consumed' },
  { label: 'Total charges', key: 'total_charges' },
  { label: 'Total taxes', key: 'total_taxes' },
  { label: 'Current bill', key: 'current_bill' },
  { label: 'Arrears', key: 'arrears' },
  { label: 'Payable within due date', key: 'payable_within_due_date' },
  { label: 'Payable after due date', key: 'payable_after_due_date' },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  return String(value);
}

function ItemsTable({ title, items }: { title: string; items: Array<Charge | Tax> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white/60">
      <div className="border-b border-slate-100/80 bg-slate-50/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-2 text-sm text-slate-400">none</div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.type}-${index}`} className="border-b border-slate-100/80 last:border-0">
                <td className="px-4 py-1.5 text-slate-500">{item.type}</td>
                <td className="px-4 py-1.5 text-right font-mono text-slate-700">{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ReadingsTable({ items }: { items: RegisterReading[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white/60">
      <div className="border-b border-slate-100/80 bg-slate-50/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Meter registers ({items.length})
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="px-4 py-1 text-left font-medium">Register</th>
            <th className="px-4 py-1 text-right font-medium">Previous</th>
            <th className="px-4 py-1 text-right font-medium">Current</th>
            <th className="px-4 py-1 text-right font-medium">Units</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.register}-${index}`} className="border-b border-slate-100/80 last:border-0">
              <td className="px-4 py-1.5 text-slate-500">{item.register ?? 'null'}</td>
              <td className="px-4 py-1.5 text-right font-mono text-slate-700">{formatValue(item.previous)}</td>
              <td className="px-4 py-1.5 text-right font-mono text-slate-700">{formatValue(item.current)}</td>
              <td className="px-4 py-1.5 text-right font-mono text-slate-700">{formatValue(item.units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillCard({ result }: { result: BillResult }) {
  const [showRaw, setShowRaw] = useState(false);
  const { bill } = result;

  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-16px_rgba(99,102,241,0.2)] ring-1 ring-black/3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100/80 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-white">
            <FileText className="h-4 w-4" />
          </span>
          <span className="font-semibold text-slate-900">{result.billId}</span>
          {bill?.provider ? (
            <span className="rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-2.5 py-0.5 text-xs font-semibold text-white">
              {bill.provider}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => setShowRaw((value) => !value)}
          className="rounded-xl border border-slate-200/80 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          {showRaw ? 'Hide JSON' : 'Show JSON'}
        </button>
      </div>

      {showRaw ? (
        <pre className="max-h-112 overflow-auto bg-slate-50/70 p-5 text-xs text-slate-600">
          {JSON.stringify(bill, null, 2)}
        </pre>
      ) : (
        <div className="grid gap-5 p-6 lg:grid-cols-2">
          <div className="flex items-start justify-center">
            {result.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageDataUrl}
                alt={result.billId}
                className="max-h-128 w-auto rounded-2xl bg-slate-50/80 object-contain p-2 ring-1 ring-slate-100"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
                image not found
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white/60">
              <table className="w-full text-sm">
                <tbody>
                  {FIELD_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100/80 last:border-0">
                      <td className="px-4 py-1.5 text-slate-400">{row.label}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-slate-700">{formatValue(bill?.[row.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bill && (bill.readings?.length ?? 0) > 0 ? <ReadingsTable items={bill.readings} /> : null}

            {bill ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <ItemsTable title="Charges" items={bill.charges ?? []} />
                <ItemsTable title="Taxes" items={bill.taxes ?? []} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Level1Page() {
  const [results, setResults] = useState<BillResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/level1', { cache: 'no-store' });
        const data = (await response.json()) as { results: BillResult[]; error: string | null };
        if (!active) {
          return;
        }
        setResults(data.results ?? []);
        setError(data.error ?? null);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load results');
        setResults([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Level 1 — Extraction Results</h1>
          <p className="text-sm text-slate-400">
            Each bill image next to its extracted JSON from{' '}
            <code className="font-mono text-slate-500">output/level1.csv</code>
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:opacity-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/70 p-6 text-slate-500 shadow-sm backdrop-blur">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Loading results…
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-amber-700 backdrop-blur">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">No results yet</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
          output/level1.csv has no rows.
        </div>
      ) : (
        <div className="grid gap-6">
          {results.map((result) => (
            <BillCard key={result.billId} result={result} />
          ))}
        </div>
      )}

      <footer className="mt-8 text-center text-xs text-slate-400">
        <Link href="/" className="inline-flex items-center gap-1.5 hover:text-indigo-600">
          <FileText className="h-3 w-3" /> Back to the Bill Assistant
        </Link>
      </footer>
    </div>
  );
}