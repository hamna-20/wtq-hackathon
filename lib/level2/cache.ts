import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';

export interface CacheInput {
  imageBase64: string;
  question: string;
  billJson: string;
}

export function answerCacheKey(input: CacheInput): string {
  return createHash('sha256')
    .update(input.imageBase64)
    .update('\u0001')
    .update(input.question)
    .update('\u0001')
    .update(input.billJson)
    .digest('hex');
}

export async function loadJsonCache(filePath: string): Promise<Map<string, string>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const value = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(value));
  } catch {
    return new Map();
  }
}

export async function saveJsonCache(
  filePath: string,
  cache: Map<string, string>,
): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(Object.fromEntries(cache), null, 2), 'utf8');
}