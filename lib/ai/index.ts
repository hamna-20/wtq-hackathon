export {
  generateContentWithGemini,
  generateTextWithGemini,
} from './gemini';
export type { GeminiOptions, GeminiPart } from './gemini';
export { generateWithFallback, generateTextWithFallback } from './provider';
export type { AIProvider } from './provider';

import { generateTextWithFallback } from './provider';

export async function generateText(prompt: string): Promise<string> {
  return generateTextWithFallback(prompt);
}
