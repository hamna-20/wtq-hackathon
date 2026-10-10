import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { toCsv } from '../lib/csv';
import { extractBillFromFile } from '../lib/level1/extract';
import { emptyBill, type Bill } from '../lib/level1/schema';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']);

interface Options {
  input: string;
  out: string;
  limit: number | null;
  filter: string | null;
  delayMs: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    input: path.join('test', 'bills'),
    out: path.join('output', 'level1.csv'),
    limit: null,
    filter: null,
    delayMs: 4000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--input' && next) {
      options.input = next;
      i += 1;
    } else if (arg === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (arg === '--limit' && next) {
      options.limit = Number.parseInt(next, 10);
      i += 1;
    } else if (arg === '--filter' && next) {
      options.filter = next.toLowerCase();
      i += 1;
    } else if (arg === '--delay' && next) {
      options.delayMs = Number.parseInt(next, 10);
      i += 1;
    }
  }

  return options;
}

async function listBillImages(input: string): Promise<string[]> {
  const entries = await fs.readdir(input, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    files.push(path.join(input, entry.name));
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function billIdFromPath(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const options = parseArgs(process.argv.slice(2));

  let files = await listBillImages(options.input);
  if (options.filter) {
    files = files.filter((file) => path.basename(file).toLowerCase().includes(options.filter as string));
  }
  if (options.limit !== null) {
    files = files.slice(0, options.limit);
  }

  if (files.length === 0) {
    throw new Error(`No bill images found in ${options.input}`);
  }

  console.log(`Processing ${files.length} bill(s) from ${options.input}`);

  const rows: string[][] = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const billId = billIdFromPath(file);
    let bill: Bill;

    try {
      bill = await extractBillFromFile(file);
      console.log(`[${i + 1}/${files.length}] ${billId}: extracted (provider=${bill.provider ?? 'null'})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${i + 1}/${files.length}] ${billId}: FAILED - ${message}`);
      bill = emptyBill(null);
    }

    rows.push([billId, JSON.stringify(bill)]);

    if (i < files.length - 1 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  await fs.mkdir(path.dirname(options.out), { recursive: true });
  await fs.writeFile(options.out, toCsv(['bill_id', 'json'], rows), 'utf8');
  console.log(`Wrote ${rows.length} row(s) to ${options.out}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
