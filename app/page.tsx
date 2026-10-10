'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  ImagePlus,
  Loader2,
  MessageSquareText,
  ReceiptText,
  Send,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import type { Bill } from '@/lib/level1/schema';

const CHARGE_LABELS: Record<string, string> = {
  energy: 'Energy Charges',
  fixed: 'Fixed Charges',
  fpa: 'Fuel Price Adjustment',
  quarterly_adjustment: 'Quarterly Tariff Adjustment',
  surcharge: 'Surcharge',
  meter_rent: 'Meter Rent',
  subsidy: 'Subsidy / Refund',
  other: 'Other',
};

const TAX_LABELS: Record<string, string> = {
  gst: 'GST / Sales Tax',
  electricity_duty: 'Electricity Duty',
  income_tax: 'Income Tax',
  municipal_tax: 'Municipal Tax',
  other_tax: 'Other Tax',
};

const FIELD_LABELS: Array<[keyof Bill | string, string]> = [
  ['provider', 'Provider'],
  ['tariff', 'Tariff'],
  ['sanctioned_load_kw', 'Sanctioned Load (kW)'],
  ['bill_month', 'Bill Month'],
  ['reading_date', 'Reading Date'],
  ['issue_date', 'Issue Date'],
  ['due_date', 'Due Date'],
  ['previous_reading', 'Previous Reading'],
  ['current_reading', 'Current Reading'],
  ['units_consumed', 'Units Consumed'],
  ['current_bill', 'Current Bill'],
  ['arrears', 'Arrears / Dues'],
  ['payable_within_due_date', 'Payable by Due Date'],
  ['payable_after_due_date', 'Payable After Due Date'],
];

const SUGGESTED_QUESTIONS = [
  'How much of my bill is taxes?',
  'What is the total amount and due date?',
  'How many units did I use this month?',
  'What charges make up my bill?',
  'Is there any subsidy applied?',
  'How much more do I pay after the due date?',
  'What did my previous dues (arrears) come to?',
  'What is my average monthly consumption?',
];

interface Sample {
  billId: string;
  imageDataUrl: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const money = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 });

function moneyOrDash(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : money.format(value);
}

function formatValue(value: unknown, key: string): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'number') {
    if (
      key === 'sanctioned_load_kw' ||
      key === 'units_consumed' ||
      key === 'previous_reading' ||
      key === 'current_reading' ||
      key === 'bill_month' ||
      key === 'provider'
    ) {
      return money.format(value);
    }
    if (value < 0) {
      return `CR ${money.format(Math.abs(value))}`;
    }
    return `PKR ${money.format(value)}`;
  }
  return String(value);
}

export default function Home() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/bills')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          return;
        }
        setSamples(data.samples ?? []);
      })
      .catch(() => {
        return;
      });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat]);

  const resetSelection = useCallback(() => {
    setBill(null);
    setChat([]);
    setError(null);
  }, []);

  const pickSample = (billId: string) => {
    const sample = samples.find((s) => s.billId === billId);
    if (!sample) {
      return;
    }
    setSelectedBillId(billId);
    setSelectedImage(sample.imageDataUrl);
    resetSelection();
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setSelectedBillId(file.name);
      resetSelection();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const extract = async () => {
    if (!selectedImage || extracting) {
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: selectedImage }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Extraction failed');
      }
      setBill(data.bill as Bill);
      setChat((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'I read the bill. Ask me anything about it — charges, taxes, units, due dates, or your consumption history.',
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  };

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || asking || !selectedImage) {
      return;
    }
    setQuestion('');
    setError(null);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed };
    setChat((prev) => [...prev, userMessage]);
    setAsking(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: selectedImage,
          question: trimmed,
          bill,
          fileName: selectedBillId ?? 'uploaded-bill',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Failed to get an answer');
      }
      setChat((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: data.answer },
      ]);
    } catch (err) {
      setChat((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `⚠️ ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-6 py-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#130d6d] text-white shadow-lg shadow-emerald-500/25">
            <Zap className="h-5 w-5" />
          </div> 
          <div>
            <h1 className="text-base font-semibold leading-tight tracking-tight text-slate-900">
              Utility Bill Assistant
            </h1>
            <p className="text-xs text-slate-400">
              OCR + AI for K-Electric, LESCO &amp; IESCO bills
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/level1"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              Level 1 results
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/60 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-16px_rgba(99,102,241,0.22)] ring-1 ring-black/3 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100/80 px-6 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-500 text-white">
                  <ImagePlus className="h-4 w-4" />
                </span>
                Bill image
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <select
                  value={selectedBillId ?? ''}
                  onChange={(event) => event.target.value && pickSample(event.target.value)}
                  className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-600 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Pick a sample bill…</option>
                  {samples.map((sample) => (
                    <option key={sample.billId} value={sample.billId}>
                      {sample.billId}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload bill
                </button>
                <button
                  type="button"
                  onClick={extract}
                  disabled={!selectedImage || extracting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {extracting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {extracting ? 'Reading…' : 'Extract with AI'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>
            </div>

            <div className="p-6">
              {selectedImage ? (
                <div className="overflow-hidden rounded-2xl bg-slate-50/80 p-2 ring-1 ring-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedImage}
                    alt="Electricity bill"
                    className="mx-auto max-h-96 w-auto rounded-xl object-contain"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-500"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-100">
                    <ImagePlus className="h-8 w-8" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Upload a bill image</p>
                    <p className="mt-1 text-xs">or pick one of the sample bills above</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {bill && (
            <div className="rounded-3xl border border-white/60 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-16px_rgba(99,102,241,0.22)] ring-1 ring-black/3 backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-slate-100/80 px-6 py-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-500 text-white">
                  <ReceiptText className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold text-slate-900">Extracted billing data</h2>
                {bill.provider && (
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                    {bill.provider}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 px-6 py-5 sm:grid-cols-3">
                {FIELD_LABELS.map(([key, label]) => {
                  const value = (bill as unknown as Record<string, unknown>)[key];
                  if (value === null || value === undefined) {
                    return null;
                  }
                  return (
                    <div key={key}>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {label}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-800">
                        {formatValue(value, key)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {bill.charges.length > 0 && (
                <div className="border-t border-slate-100/80 px-6 py-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Charges
                  </h3>
                  <ul className="divide-y divide-slate-100/80">
                    {bill.charges.map((charge, index) => (
                      <li key={index} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-slate-500">{CHARGE_LABELS[charge.type] ?? charge.type}</span>
                        <span className="font-medium text-slate-700">{formatValue(charge.amount, 'charge')}</span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between py-1.5 text-sm font-semibold">
                      <span className="text-slate-900">Total charges</span>
                      <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-indigo-700">
                        {formatValue(bill.total_charges, 'charge')}
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              {bill.taxes.length > 0 && (
                <div className="border-t border-slate-100/80 px-6 py-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Taxes</h3>
                  <ul className="divide-y divide-slate-100/80">
                    {bill.taxes.map((tax, index) => (
                      <li key={index} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-slate-500">{TAX_LABELS[tax.type] ?? tax.type}</span>
                        <span className="font-medium text-slate-700">{formatValue(tax.amount, 'tax')}</span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between py-1.5 text-sm font-semibold">
                      <span className="text-slate-900">Total taxes</span>
                      <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-amber-700">
                        {formatValue(bill.total_taxes, 'tax')}
                      </span>
                    </li>
                  </ul>
                </div>
              )}

              {bill.readings.length > 0 && (
                <div className="border-t border-slate-100/80 px-6 py-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Meter registers
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-slate-100 bg-white/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-400">
                          <th className="py-2.5 pl-4 pr-3 font-medium">Register</th>
                          <th className="py-2.5 pr-3 font-medium">Previous</th>
                          <th className="py-2.5 pr-3 font-medium">Current</th>
                          <th className="py-2.5 pr-4 font-medium">Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.readings.map((reading, index) => (
                          <tr
                            key={index}
                            className="border-b border-slate-100/80 last:border-0"
                          >
                            <td className="py-2 pl-4 pr-3 text-slate-500">{reading.register}</td>
                            <td className="py-2 pr-3 font-medium text-slate-700">{moneyOrDash(reading.previous)}</td>
                            <td className="py-2 pr-3 font-medium text-slate-700">{moneyOrDash(reading.current)}</td>
                            <td className="py-2 pr-4 font-semibold text-slate-800">{moneyOrDash(reading.units)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <details className="border-t border-slate-100/80 px-6 py-3.5">
                <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-indigo-600">
                  View raw JSON
                </summary>
                <pre className="mt-3 max-h-72 overflow-auto rounded-2xl bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-600">
                  {JSON.stringify(bill, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-5 py-3.5 text-sm text-rose-600 backdrop-blur">
              {error}
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-16px_rgba(99,102,241,0.22)] ring-1 ring-black/3 backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-slate-100/80 px-6 py-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-fuchsia-500 to-violet-500 text-white">
              <Bot className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">Ask your bill</h2>
            <span className="ml-auto text-[11px] text-slate-400">answers are based only on the bill</span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-6 py-3" style={{ maxHeight: '28rem' }}>
            {chat.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-50 to-violet-100 text-indigo-400 shadow-sm ring-1 ring-indigo-100">
                  <MessageSquareText className="h-7 w-7" />
                </span>
                <p className="max-w-xs text-sm leading-relaxed text-slate-500">
                  Pick a bill, extract it, then ask questions in plain English — like{' '}
                  <span className="font-medium text-indigo-600">
                    &ldquo;How much of my bill is taxes?&rdquo;
                  </span>
                </p>
              </div>
            ) : (
              chat.map((message) => (
                <div
                  key={message.id}
                  className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      message.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-md bg-linear-to-br from-indigo-500 to-violet-500 px-4 py-2.5 text-sm leading-relaxed text-white shadow-md shadow-indigo-500/20'
                        : 'max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200/70 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-600 shadow-sm'
                    }
                  >
                    {message.text}
                  </div>
                </div>
              ))
            )}
            {asking && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                Reading the bill…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-100/80 px-6 py-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => ask(suggestion)}
                  disabled={asking || !selectedImage}
                  className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                ask(question);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={selectedImage ? 'Ask about this bill…' : 'Select or upload a bill first'}
                disabled={!selectedImage || asking}
                className="flex-1 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!question.trim() || !selectedImage || asking}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:opacity-95 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send"
              >
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Sparkles className="h-3 w-3 text-violet-400" />
              Answers use only the information printed on the bill. Personal identifiers are excluded.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/60 py-4 text-center text-xs text-slate-400">
        <Link href="/level1" className="inline-flex items-center gap-1 hover:text-indigo-600">
          View extracted Level 1 results <ArrowRight className="h-3 w-3" />
        </Link>
      </footer>
    </div>
  );
}