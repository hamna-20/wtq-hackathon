import {
  CHARGE_TYPES,
  TAX_TYPES,
  type Bill,
  type ChargeType,
  type TaxType,
} from './schema';

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }

  let text = value.trim();
  if (!text || text === '-' || text === '--') {
    return null;
  }

  const isCredit =
    /\bcr\b|credit/i.test(text) || (text.includes('(') && text.includes(')'));
  const isDebit = /\bdr\b|debit/i.test(text);

  text = text.replace(/[()]/g, '');
  text = text.replace(/(rs\.?|pkr|rupees)/gi, '');
  text = text.replace(/\b(cr|dr)\b/gi, '');
  text = text.replace(/,/g, '');
  text = text.replace(/[^0-9.+-]/g, '');

  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (isCredit && !isDebit) {
    return -Math.abs(parsed);
  }
  return parsed;
}

export function normalizeMonth(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2]}`;
  }

  const named = raw.match(/^([A-Za-z]{3,})[\s,-/]+(\d{4})$/);
  if (named) {
    const month = MONTHS[named[1].slice(0, 3).toLowerCase()];
    if (month) {
      return `${named[2]}-${pad(month)}`;
    }
  }

  const numeric = raw.match(/^(\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    return `${numeric[2]}-${pad(Number.parseInt(numeric[1], 10))}`;
  }

  const full = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) {
    return `${full[1]}-${full[2]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}`;
  }
  return null;
}

export function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return raw;
  }

  const dmy = raw.match(/^(\d{1,2})[\s./-]+([A-Za-z]{3,})[\s./,-]+(\d{4})$/);
  if (dmy) {
    const month = MONTHS[dmy[2].slice(0, 3).toLowerCase()];
    if (month) {
      return `${dmy[3]}-${pad(month)}-${pad(Number.parseInt(dmy[1], 10))}`;
    }
  }

  const numeric = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (numeric) {
    return `${numeric[3]}-${pad(Number.parseInt(numeric[2], 10))}-${pad(
      Number.parseInt(numeric[1], 10),
    )}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
      parsed.getDate(),
    )}`;
  }
  return null;
}

function normalizeChargeType(value: unknown): ChargeType {
  if (typeof value === 'string' && (CHARGE_TYPES as readonly string[]).includes(value)) {
    return value as ChargeType;
  }
  return 'other';
}

function normalizeTaxType(value: unknown): TaxType {
  if (typeof value === 'string' && (TAX_TYPES as readonly string[]).includes(value)) {
    return value as TaxType;
  }
  return 'other_tax';
}

function normalizeChargeList(value: unknown): Bill['charges'] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: Bill['charges'] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const amount = toNumber(record.amount);
    if (amount === null || amount === 0) {
      continue;
    }
    result.push({ type: normalizeChargeType(record.type), amount });
  }
  return result;
}

function normalizeTaxList(value: unknown): Bill['taxes'] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: Bill['taxes'] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const amount = toNumber(record.amount);
    if (amount === null || amount === 0) {
      continue;
    }
    result.push({ type: normalizeTaxType(record.type), amount });
  }
  return result;
}

function normalizeReadings(value: unknown): Bill['readings'] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: Bill['readings'] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const previous = toNumber(record.previous);
    const current = toNumber(record.current);
    const units = toNumber(record.units);
    const register = normalizeText(record.register);
    if (previous === null && current === null && units === null && register === null) {
      continue;
    }
    result.push({ register, previous, current, units });
  }
  return result;
}

function normalizeProvider(value: unknown): Bill['provider'] {
  if (typeof value !== 'string') {
    return null;
  }
  const upper = value.trim().toUpperCase();
  if (upper === 'KE' || upper === 'K-ELECTRIC' || upper === 'KESC') {
    return 'KE';
  }
  if (upper === 'LESCO') {
    return 'LESCO';
  }
  if (upper === 'IESCO') {
    return 'IESCO';
  }
  return null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}

export function normalizeBill(raw: unknown): Bill {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const provider = normalizeProvider(record.provider);

  const charges = normalizeChargeList(record.charges);

  let taxes = normalizeTaxList(record.taxes);
  const totalCharges = toNumber(record.total_charges);
  let totalTaxes = toNumber(record.total_taxes);

  if (provider === 'LESCO' && taxes.length > 0) {
    if (totalTaxes === null) {
      totalTaxes = taxes.reduce((sum, tax) => sum + tax.amount, 0);
    }
    taxes = [];
  }

  return {
    provider,
    tariff: normalizeText(record.tariff),
    sanctioned_load_kw: toNumber(record.sanctioned_load_kw),
    bill_month: normalizeMonth(record.bill_month),
    reading_date: normalizeDate(record.reading_date),
    issue_date: normalizeDate(record.issue_date),
    due_date: normalizeDate(record.due_date),
    previous_reading: toNumber(record.previous_reading),
    current_reading: toNumber(record.current_reading),
    units_consumed: toNumber(record.units_consumed),
    readings: normalizeReadings(record.readings),
    charges,
    total_charges: totalCharges,
    taxes,
    total_taxes: totalTaxes,
    current_bill: toNumber(record.current_bill),
    arrears: toNumber(record.arrears),
    payable_within_due_date: toNumber(record.payable_within_due_date),
    payable_after_due_date: toNumber(record.payable_after_due_date),
  };
}
