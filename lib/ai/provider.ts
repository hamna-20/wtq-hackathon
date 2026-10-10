import {
  generateContentWithGemini,
  generateTextWithGemini,
  type GeminiOptions,
  type GeminiPart,
} from './gemini';

export type AIProvider = 'gemini';

export async function generateWithFallback(
  parts: GeminiPart[],
  options?: GeminiOptions,
): Promise<string> {
  return generateContentWithGemini(parts, options);
}

export async function generateTextWithFallback(prompt: string): Promise<string> {
  return generateTextWithGemini(prompt);
}
