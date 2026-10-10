import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateWithFallback } from '../ai';
import { normalizeBill } from './normalize';
import { buildExtractionPrompt, EXTRACTION_SYSTEM_INSTRUCTION } from './prompt';
import { BILL_RESPONSE_SCHEMA, BillSchema, type Bill } from './schema';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

export function mimeTypeFor(filePath: string): string {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'image/jpeg';
}

function parseJsonObject(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Model did not return valid JSON');
  }
}

export interface BillImageInput {
  data: Buffer;
  mimeType: string;
  fileName: string;
}

export async function extractBill(input: BillImageInput): Promise<Bill> {
  const raw = await generateWithFallback(
    [
      { text: buildExtractionPrompt(input.fileName) },
      {
        inlineData: {
          mimeType: input.mimeType,
          data: input.data.toString('base64'),
        },
      },
    ],
    {
      systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
      temperature: 0,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: BILL_RESPONSE_SCHEMA,
    },
  );

  const parsed = normalizeBill(parseJsonObject(raw));
  return BillSchema.parse(parsed);
}

export async function extractBillFromFile(filePath: string): Promise<Bill> {
  const data = await fs.readFile(filePath);
  return extractBill({
    data,
    mimeType: mimeTypeFor(filePath),
    fileName: path.basename(filePath),
  });
}
