const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;

const GEMINI_KEY_NAMES = ['GEMINI_API_KEY_PRIMARY', 'GEMINI_API_KEY_SECONDARY'] as const;

function resolveModels(): readonly string[] {
  const pinned = process.env.MODEL_NAME?.trim();
  if (pinned) {
    return [pinned, ...GEMINI_MODELS.filter((model) => model !== pinned)];
  }
  return [...GEMINI_MODELS];
}

function resolveAttempts(): Array<{ keyName: string; model: string }> {
  const attempts: Array<{ keyName: string; model: string }> = [];
  for (const keyName of GEMINI_KEY_NAMES) {
    for (const model of resolveModels()) {
      attempts.push({ keyName, model });
    }
  }
  return attempts;
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  systemInstruction?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
}

function isRetryableGeminiError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('unavailable') ||
    lower.includes('internal') ||
    lower.includes('timeout') ||
    lower.includes('temporary')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateContentWithGemini(
  parts: GeminiPart[],
  options: GeminiOptions = {},
): Promise<string> {
  const errors: string[] = [];
  const attempts = resolveAttempts();

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0,
    maxOutputTokens: options.maxOutputTokens ?? 1024,
  };
  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }
  if (options.responseSchema) {
    generationConfig.responseSchema = options.responseSchema;
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig,
  };
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  for (const attempt of attempts) {
    const apiKey = process.env[attempt.keyName];

    if (!apiKey) {
      errors.push(`Missing ${attempt.keyName}`);
      continue;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `Gemini ${attempt.model} (${attempt.keyName}) error: ${response.status} ${errorText}`;
        errors.push(errorMsg);
        if (!isRetryableGeminiError(errorText) && response.status !== 429) {
          throw new Error(errorMsg);
        }
        if (response.status === 429) {
          await sleep(30_000);
        }
        continue;
      }

      const data = (await response.json()) as GeminiApiResponse;
      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();

      if (!text) {
        const errorMsg = `Invalid response from Gemini ${attempt.model} (${attempt.keyName})`;
        errors.push(errorMsg);
        continue;
      }

      return text;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
      continue;
    }
  }

  throw new Error(`All Gemini attempts failed: ${errors.join(', ')}`);
}

export async function generateTextWithGemini(prompt: string): Promise<string> {
  return generateContentWithGemini([{ text: prompt }], {
    temperature: 0.7,
    maxOutputTokens: 500,
  });
}
