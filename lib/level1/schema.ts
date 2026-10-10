import { z } from 'zod';

export const PROVIDERS = ['KE', 'LESCO', 'IESCO'] as const;

export const CHARGE_TYPES = [
  'energy',
  'fixed',
  'fpa',
  'quarterly_adjustment',
  'surcharge',
  'meter_rent',
  'subsidy',
  'other',
] as const;

export const TAX_TYPES = [
  'gst',
  'electricity_duty',
  'income_tax',
  'municipal_tax',
  'other_tax',
] as const;

export type ChargeType = (typeof CHARGE_TYPES)[number];
export type TaxType = (typeof TAX_TYPES)[number];

const nullableNumber = z.number().nullable();
const nullableString = z.string().nullable();

export const ChargeSchema = z.object({
  type: z.enum(CHARGE_TYPES),
  amount: z.number(),
});

export const TaxSchema = z.object({
  type: z.enum(TAX_TYPES),
  amount: z.number(),
});

export const RegisterReadingSchema = z.object({
  register: z.string().nullable(),
  previous: z.number().nullable(),
  current: z.number().nullable(),
  units: z.number().nullable(),
});

export const BillSchema = z.object({
  provider: z.enum(PROVIDERS).nullable(),
  tariff: nullableString,
  sanctioned_load_kw: nullableNumber,
  bill_month: nullableString,
  reading_date: nullableString,
  issue_date: nullableString,
  due_date: nullableString,
  previous_reading: nullableNumber,
  current_reading: nullableNumber,
  units_consumed: nullableNumber,
  readings: z.array(RegisterReadingSchema),
  charges: z.array(ChargeSchema),
  total_charges: nullableNumber,
  taxes: z.array(TaxSchema),
  total_taxes: nullableNumber,
  current_bill: nullableNumber,
  arrears: nullableNumber,
  payable_within_due_date: nullableNumber,
  payable_after_due_date: nullableNumber,
});

export type Bill = z.infer<typeof BillSchema>;
export type Charge = z.infer<typeof ChargeSchema>;
export type Tax = z.infer<typeof TaxSchema>;
export type RegisterReading = z.infer<typeof RegisterReadingSchema>;

const chargeItemSchema = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: [...CHARGE_TYPES] },
    amount: { type: 'NUMBER' },
  },
  required: ['type', 'amount'],
};

const taxItemSchema = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: [...TAX_TYPES] },
    amount: { type: 'NUMBER' },
  },
  required: ['type', 'amount'],
};

export const BILL_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    provider: { type: 'STRING', enum: [...PROVIDERS], nullable: true },
    tariff: { type: 'STRING', nullable: true },
    sanctioned_load_kw: { type: 'NUMBER', nullable: true },
    bill_month: { type: 'STRING', nullable: true },
    reading_date: { type: 'STRING', nullable: true },
    issue_date: { type: 'STRING', nullable: true },
    due_date: { type: 'STRING', nullable: true },
    previous_reading: { type: 'NUMBER', nullable: true },
    current_reading: { type: 'NUMBER', nullable: true },
    units_consumed: { type: 'NUMBER', nullable: true },
    readings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          register: { type: 'STRING', nullable: true },
          previous: { type: 'NUMBER', nullable: true },
          current: { type: 'NUMBER', nullable: true },
          units: { type: 'NUMBER', nullable: true },
        },
        required: ['register', 'previous', 'current', 'units'],
      },
    },
    charges: { type: 'ARRAY', items: chargeItemSchema },
    total_charges: { type: 'NUMBER', nullable: true },
    taxes: { type: 'ARRAY', items: taxItemSchema },
    total_taxes: { type: 'NUMBER', nullable: true },
    current_bill: { type: 'NUMBER', nullable: true },
    arrears: { type: 'NUMBER', nullable: true },
    payable_within_due_date: { type: 'NUMBER', nullable: true },
    payable_after_due_date: { type: 'NUMBER', nullable: true },
  },
  required: [
    'provider',
    'tariff',
    'sanctioned_load_kw',
    'bill_month',
    'reading_date',
    'issue_date',
    'due_date',
    'previous_reading',
    'current_reading',
    'units_consumed',
    'readings',
    'charges',
    'total_charges',
    'taxes',
    'total_taxes',
    'current_bill',
    'arrears',
    'payable_within_due_date',
    'payable_after_due_date',
  ],
};

export function emptyBill(provider: Bill['provider']): Bill {
  return {
    provider,
    tariff: null,
    sanctioned_load_kw: null,
    bill_month: null,
    reading_date: null,
    issue_date: null,
    due_date: null,
    previous_reading: null,
    current_reading: null,
    units_consumed: null,
    readings: [],
    charges: [],
    total_charges: null,
    taxes: [],
    total_taxes: null,
    current_bill: null,
    arrears: null,
    payable_within_due_date: null,
    payable_after_due_date: null,
  };
}
