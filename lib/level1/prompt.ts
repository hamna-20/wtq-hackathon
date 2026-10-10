import { CHARGE_TYPES, TAX_TYPES } from './schema';

export const EXTRACTION_SYSTEM_INSTRUCTION = `You are an expert at reading Pakistani electricity bills from K-Electric (KE), LESCO and IESCO.
You extract structured billing data from a photographed, scanned or screenshotted bill.

Hard rules:
- Return ONLY a single JSON object that matches the requested schema. No markdown, no commentary.
- The image may be rotated, low quality, partly in Urdu, or have grey boxes covering personal fields.
- NEVER output personal identifiers. Never include names, addresses, CNIC, account numbers, reference numbers, consumer numbers or meter numbers anywhere in the JSON.
- Read values exactly as printed. Do NOT recalculate, round, or correct the amounts.
- If a value is not printed, blank, covered by a grey box, or unreadable, return null. Do NOT guess.
- Return an empty array [] when a section has no valid entries.`;

export function buildExtractionPrompt(fileName: string): string {
  const hint = providerHint(fileName);
  return `Read the attached electricity bill image (file: ${fileName}) and return one JSON object.

${hint}

The JSON schema (all keys are required; use null when unavailable):
{
  "provider": "KE" | "LESCO" | "IESCO" | null,
  "tariff": string | null,
  "sanctioned_load_kw": number | null,
  "bill_month": "YYYY-MM" | null,
  "reading_date": "YYYY-MM-DD" | null,
  "issue_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "previous_reading": number | null,
  "current_reading": number | null,
  "units_consumed": number | null,
  "readings": [ { "register": string | null, "previous": number | null, "current": number | null, "units": number | null } ],
  "charges": [ { "type": ${CHARGE_TYPES.map((t) => `"${t}"`).join(' | ')}, "amount": number } ],
  "total_charges": number | null,
  "taxes": [ { "type": ${TAX_TYPES.map((t) => `"${t}"`).join(' | ')}, "amount": number } ],
  "total_taxes": number | null,
  "current_bill": number | null,
  "arrears": number | null,
  "payable_within_due_date": number | null,
  "payable_after_due_date": number | null
}

Field rules:
- provider: KE, LESCO or IESCO (use the logo/name on the bill).
- tariff: the tariff code exactly as printed, e.g. "A1-R" or "A-1a-01".
- sanctioned_load_kw: sanctioned load in kW, labelled "Sanc Load", "S.Load" or "San Load".
- bill_month: the billing month as YYYY-MM (e.g. "MAR 2020" -> "2020-03").
- reading_date / issue_date / due_date: printed dates as YYYY-MM-DD. due_date is the last date to pay WITHOUT a late payment surcharge.
- previous_reading / current_reading: the printed meter readings of the main/first register.
- units_consumed: the units billed for the current month, as printed (the bill's own billed units, not a recalculation).
- readings: only for bills that print MORE THAN ONE meter register. Return every register in the printed order as { register (its printed label, e.g. "Energy Off-Peak", "Energy Peak", "Import Off-Peak", "Import Peak"), previous, current, units }. For a single-register bill, return readings: [].
- charges: one entry per line in the CHARGES section. Skip blank lines and lines printed as 0. Keep separate entries when the same type appears more than once.
- total_charges: the printed charges subtotal as printed (often labelled "Total Electricity Charges" or "Electricity Charges"). Report the printed subtotal EXACTLY as printed. Do NOT subtract subsidies and do NOT add taxes or FPA. Return null only if no subtotal is printed.
- taxes: one entry per line in the TAX / GOVERNMENT section. Classify by the section it appears in, not its name. If only a combined tax amount is printed, return [] and put the amount in total_taxes. LESCO bills never print a tax breakdown, so for LESCO always return taxes: [] and put the single combined amount in total_taxes.
- total_taxes: the printed tax subtotal as printed, or null if no subtotal is printed.
- current_bill: the printed amount for this month's bill (as printed, do not recompute).
- arrears: previous dues carried forward, keeping the printed sign (a credit is negative); null if blank.
- payable_within_due_date: the amount payable by the due date, keeping the printed sign (a credit is negative).
- payable_after_due_date: the amount payable after the due date. If several late-payment amounts are shown, use the highest. If the bill explicitly states "NOT TO BE PAID" (or prints 0), return 0. Return null only when the value is truly blank or covered by a grey box.

Numbers:
- All amounts are in PKR. Remove currency labels and thousands separators: "Rs. 13,304" -> 13304.
- Credits, subsidies and deductions are NEGATIVE: "38203CR" -> -38203.
- Use numbers, not quoted strings.

Charge types:
- energy: cost of units used (Variable Upto ... Units, Cost of Electricity, Energy Charges).
- fixed: fixed charges.
- fpa: fuel price adjustment (FPA or FCA).
- quarterly_adjustment: quarterly tariff adjustment (QTA, Uniform Quarterly Adjustment).
- surcharge: surcharges (Additional Surcharge (PHL), F.C Surcharge).
- meter_rent: meter rent or service rent.
- subsidy: government subsidy or relief lines (negative).
- other: any other charge line.

Tax types:
- gst: sales tax or GST, including GST on FPA.
- electricity_duty: electricity duty (ED).
- income_tax: income tax.
- municipal_tax: municipal/local charges printed under taxes (e.g. KE MUCT / KMC).
- other_tax: any other tax line (extra tax, further tax, TV fee).`;
}

function providerHint(fileName: string): string {
  const upper = fileName.toUpperCase();
  if (upper.startsWith('KESC') || upper.startsWith('KE')) {
    return 'The file name starts with "KESC", which indicates K-Electric; the provider value must be "KE".';
  }
  if (upper.startsWith('LESCO')) {
    return 'The file name starts with "LESCO", which indicates LESCO; the provider value must be "LESCO".';
  }
  if (upper.startsWith('IESCO')) {
    return 'The file name starts with "IESCO", which indicates IESCO; the provider value must be "IESCO".';
  }
  return 'Determine the provider from the logo/name printed on the bill.';
}
