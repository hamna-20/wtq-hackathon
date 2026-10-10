import { promises as fs } from 'node:fs';
import path from 'node:path';

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'];

export const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

export function mimeTypeFor(name: string): string {
  return MIME_BY_EXTENSION[path.extname(name).toLowerCase()] ?? 'image/jpeg';
}

export function billIdFromPath(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

export async function listBillImages(inputDir: string): Promise<string[]> {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!IMAGE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    files.push(path.join(inputDir, entry.name));
  }
  return files.sort((a, b) => a.localeCompare(b));
}

export async function findBillImagePath(inputDir: string, billId: string): Promise<string | null> {
  const files = await listBillImages(inputDir);
  const match = files.find((file) => billIdFromPath(file) === billId);
  return match ?? null;
}

export async function billImageDataUrl(inputDir: string, billId: string): Promise<string | null> {
  const filePath = await findBillImagePath(inputDir, billId);
  if (!filePath) {
    return null;
  }
  const data = await fs.readFile(filePath);
  return `data:${mimeTypeFor(filePath)};base64,${data.toString('base64')}`;
}