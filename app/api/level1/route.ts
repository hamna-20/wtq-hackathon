import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '@/lib/csv';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'];

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

interface BillResult {
  billId: string;
  bill: unknown;
  imageDataUrl: string | null;
}

async function loadImageDataUrl(inputDir: string, billId: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(inputDir, { withFileTypes: true });
    const target = entries.find((entry) => {
      if (!entry.isFile()) {
        return false;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(ext)) {
        return false;
      }
      return path.basename(entry.name, path.extname(entry.name)) === billId;
    });
    if (!target) {
      return null;
    }
    const filePath = path.join(inputDir, target.name);
    const data = await fs.readFile(filePath);
    const mime = MIME_BY_EXTENSION[path.extname(target.name).toLowerCase()] ?? 'image/jpeg';
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET() {
  const inputDir = path.join(process.cwd(), 'test', 'bills');
  const csvPath = path.join(process.cwd(), 'output', 'level1.csv');

  let text: string;
  try {
    text = await fs.readFile(csvPath, 'utf8');
  } catch {
    return Response.json({
      results: [],
      error:
        'output/level1.csv not found. Run: npx tsx scripts/level1.ts, then refresh this page.',
    });
  }

  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim().length > 0));
  const dataRows = rows.slice(1);

  const results: BillResult[] = [];
  for (const row of dataRows) {
    const billId = (row[0] ?? '').trim();
    if (!billId) {
      continue;
    }
    let bill: unknown = null;
    try {
      bill = JSON.parse(row[1] ?? 'null');
    } catch {
      bill = null;
    }
    const imageDataUrl = await loadImageDataUrl(inputDir, billId);
    results.push({ billId, bill, imageDataUrl });
  }

  return Response.json({ results, error: null });
}
