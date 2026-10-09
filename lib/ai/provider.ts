import { generateTextWithGemini } from './gemini';

export type AIProvider = 'gemini';

export async function generateTextWithFallback(prompt: string): Promise<string> {
  return generateTextWithGemini(prompt);
}
