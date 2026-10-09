const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;

const GEMINI_KEYS = [
  { keyName: 'GEMINI_API_KEY_PRIMARY', model: GEMINI_MODELS[0] },
  { keyName: 'GEMINI_API_KEY_PRIMARY', model: GEMINI_MODELS[1] },
  { keyName: 'GEMINI_API_KEY_SECONDARY', model: GEMINI_MODELS[0] },
  { keyName: 'GEMINI_API_KEY_SECONDARY', model: GEMINI_MODELS[1] },
] as const;

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

export async function generateTextWithGemini(prompt: string): Promise<string> {
  const errors: string[] = [];

  for (const attempt of GEMINI_KEYS) {
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
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `Gemini ${attempt.model} (${attempt.keyName}) error: ${response.status} ${errorText}`;
        errors.push(errorMsg);
        if (!isRetryableGeminiError(errorText) && response.status !== 429) {
          throw new Error(errorMsg);
        }
        continue;
      }

      const data = (await response.json()) as {
        candidates: Array<{
          content: {
            parts: Array<{ text: string }>;
          };
        }>;
      };

      if (!data.candidates || data.candidates.length === 0 || !data.candidates[0]?.content?.parts?.[0]?.text) {
        const errorMsg = `Invalid response from Gemini ${attempt.model} (${attempt.keyName})`;
        errors.push(errorMsg);
        continue;
      }

      return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
      continue;
    }
  }

  throw new Error(`All Gemini attempts failed: ${errors.join(', ')}`);
}
