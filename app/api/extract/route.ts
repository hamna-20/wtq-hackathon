import { z } from 'zod';
import { extractBill } from '@/lib/level1/extract';

const RequestSchema = z.object({
  imageDataUrl: z.string().min(1),
});

function decodeImage(dataUrl: string): { data: Buffer; mimeType: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid image data URL');
  }
  return { data: Buffer.from(match[2], 'base64'), mimeType: match[1] };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Bad request' }, { status: 400 });
  }

  try {
    const { data, mimeType } = decodeImage(parsed.data.imageDataUrl);
    const bill = await extractBill({ data, mimeType, fileName: 'uploaded-bill' });
    return Response.json({ bill });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}