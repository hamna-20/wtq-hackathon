import path from 'node:path';
import { billImageDataUrl, billIdFromPath, listBillImages } from '@/lib/bills';

export async function GET() {
  const inputDir = path.join(process.cwd(), 'test', 'bills');

  try {
    const files = await listBillImages(inputDir);
    const samples = [];
    for (const file of files) {
      const billId = billIdFromPath(file);
      const imageDataUrl = await billImageDataUrl(inputDir, billId);
      samples.push({ billId, imageDataUrl });
    }
    return Response.json({ samples, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ samples: [], error: message });
  }
}