import { z } from 'zod';
import { answerBillQuestion } from '@/lib/level2/answer';
import { answerCacheKey } from '@/lib/level2/cache';
import type { Bill } from '@/lib/level1/schema';

const RequestSchema = z.object({
  imageDataUrl: z.string().min(1),
  question: z.string().min(1),
  bill: z.unknown().optional().nullable(),
  fileName: z.string().optional().default('uploaded-bill'),
});

const memoryCache = new Map<string, string>();

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

  const billJson = JSON.stringify(parsed.data.bill ?? null);
  const key = answerCacheKey({
    imageBase64: parsed.data.imageDataUrl,
    question: parsed.data.question,
    billJson,
  });

  const cached = memoryCache.get(key);
  if (cached !== undefined) {
    return Response.json({ answer: cached, cached: true });
  }

  try {
    const { data, mimeType } = decodeImage(parsed.data.imageDataUrl);
    const answer = await answerBillQuestion({
      data,
      mimeType,
      fileName: parsed.data.fileName,
      question: parsed.data.question,
      bill: (parsed.data.bill ?? null) as Bill | null,
    });
    memoryCache.set(key, answer);
    return Response.json({ answer, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}