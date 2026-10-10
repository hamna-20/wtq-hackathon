import { generateWithFallback } from '../ai';
import type { Bill } from '../level1/schema';
import { ANSWER_SYSTEM_INSTRUCTION, buildAnswerPrompt } from './prompt';

export interface AnswerInput {
  data: Buffer;
  mimeType: string;
  fileName: string;
  question: string;
  bill: Bill | null;
}

export async function answerBillQuestion(input: AnswerInput): Promise<string> {
  const raw = await generateWithFallback(
    [
      { text: buildAnswerPrompt(input.question, input.bill, input.fileName) },
      {
        inlineData: {
          mimeType: input.mimeType,
          data: input.data.toString('base64'),
        },
      },
    ],
    {
      systemInstruction: ANSWER_SYSTEM_INSTRUCTION,
      temperature: 0,
      maxOutputTokens: 1024,
    },
  );

  return raw.trim();
}