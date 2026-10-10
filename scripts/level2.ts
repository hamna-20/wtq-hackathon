import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { findBillImagePath, mimeTypeFor } from '../lib/bills';
import { parseCsv, toCsv } from '../lib/csv';
import { answerCacheKey, loadJsonCache, saveJsonCache } from '../lib/level2/cache';
import { answerBillQuestion } from '../lib/level2/answer';
import { BillSchema, type Bill } from '../lib/level1/schema';

interface Options {
  template: string;
  input: string;
  out: string;
  level1: string;
  cache: string;
  limit: number | null;
  filter: string | null;
  delayMs: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    template: path.join('test', 'bills', 'csv', 'level2.csv'),
    input: path.join('test', 'bills'),
    out: path.join('output', 'level2.csv'),
    level1: path.join('output', 'level1.csv'),
    cache: path.join('output', '.level2-cache.json'),
    limit: null,
    filter: null,
    delayMs: 4500,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--template' && next) {
      options.template = next;
      i += 1;
    } else if (arg === '--input' && next) {
      options.input = next;
      i += 1;
    } else if (arg === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (arg === '--level1' && next) {
      options.level1 = next;
      i += 1;
    } else if (arg === '--cache' && next) {
      options.cache = next;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadBillsFromLevel1(level1Path: string): Promise<Map<string, Bill>> {
  const bills = new Map<string, Bill>();
  try {
    const text = await fs.readFile(level1Path, 'utf8');
    const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim().length > 0));
    for (const row of rows.slice(1)) {
      const billId = (row[0] ?? '').trim();
      if (!billId) {
        continue;
      }
      try {
        bills.set(billId, BillSchema.parse(JSON.parse(row[1] ?? 'null')));
      } catch {
        bills.set(billId, null as unknown as Bill);
      }
    }
  } catch {
    // no level1 file; questions will rely on the image only
  }
  return bills;
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const options = parseArgs(process.argv.slice(2));

  const templateText = await fs.readFile(options.template, 'utf8');
  const rows = parseCsv(templateText).filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length < 2) {
    throw new Error(`Template ${options.template} has no data rows`);
  }

  const headers = rows[0];
  const billIdCol = headers.indexOf('bill_id');
  const questionIdCol = headers.indexOf('question_id');
  const questionCol = headers.indexOf('question');
  const answerCol = headers.indexOf('answer');

  if (billIdCol === -1 || questionIdCol === -1 || questionCol === -1 || answerCol === -1) {
    throw new Error(
      `Template must have columns bill_id, question_id, question, answer (found: ${headers.join(', ')})`,
    );
  }

  const bills = await loadBillsFromLevel1(options.level1);
  const dataRows = rows.slice(1);

  const cache = await loadJsonCache(options.cache);
  let cacheHits = 0;

  let workRows = dataRows;
  if (options.filter) {
    workRows = workRows.filter((row) => (row[billIdCol] ?? '').toLowerCase().includes(options.filter as string) || (row[questionIdCol] ?? '').toLowerCase().includes(options.filter as string));
  }
  if (options.limit !== null) {
    workRows = workRows.slice(0, options.limit);
  }

  console.log(
    `Answering ${workRows.length} question(s) from ${path.basename(options.template)} (filter="${options.filter ?? 'all'}")`,
  );

  let answered = 0;
  for (let i = 0; i < workRows.length; i += 1) {
    const row = workRows[i];
    const billId = (row[billIdCol] ?? '').trim();
    const questionId = (row[questionIdCol] ?? '').trim();
    const question = (row[questionCol] ?? '').trim();

    const imagePath = await findBillImagePath(options.input, billId);
    const bill = bills.get(billId) ?? null;

    if (!imagePath) {
      console.error(`[${i + 1}/${workRows.length}] ${billId} ${questionId}: no image found`);
      row[answerCol] = 'Bill image not found.';
      answered += 1;
      continue;
    }

    try {
      const data = await fs.readFile(imagePath);
      const imageBase64 = data.toString('base64');
      const billJson = JSON.stringify(bill);
      const cacheKey = answerCacheKey({ imageBase64, question, billJson });

      const cachedAnswer = cache.get(cacheKey);
      if (cachedAnswer !== undefined) {
        row[answerCol] = cachedAnswer;
        answered += 1;
        cacheHits += 1;
        console.log(`[${i + 1}/${workRows.length}] ${billId} ${questionId}: cached`);
      } else {
        const answer = await answerBillQuestion({
          data,
          mimeType: mimeTypeFor(imagePath),
          fileName: path.basename(imagePath),
          question,
          bill,
        });
        cache.set(cacheKey, answer);
        row[answerCol] = answer;
        answered += 1;
        console.log(`[${i + 1}/${workRows.length}] ${billId} ${questionId}: answered`);
      }
      await saveJsonCache(options.cache, cache);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      row[answerCol] = `Error generating answer: ${message}`;
      answered += 1;
      console.error(`[${i + 1}/${workRows.length}] ${billId} ${questionId}: FAILED - ${message}`);
    }

    if (i < workRows.length - 1 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const output = [headers, ...rows.slice(1)].map((row) =>
    row.map((cell, index) => (index === answerCol && cell === undefined ? '' : cell)),
  );

  await fs.mkdir(path.dirname(options.out), { recursive: true });
  await fs.writeFile(options.out, toCsv(output[0], output.slice(1)), 'utf8');
  console.log(
    `Wrote ${answered} answer(s) to ${options.out} (${cacheHits} from cache)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});