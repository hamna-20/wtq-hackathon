export { generateTextWithGemini } from './gemini';
export { generateTextWithFallback } from './provider';
export type { AIProvider } from './provider';
import { generateTextWithFallback } from './provider';

export async function generateText(prompt: string): Promise<string> {
  return generateTextWithFallback(prompt);
}
