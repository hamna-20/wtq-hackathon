import type { Bill } from '../level1/schema';

export const ANSWER_SYSTEM_INSTRUCTION = `You are a utility bill assistant answering a customer's questions about their electricity bill (K-Electric, LESCO or IESCO).

Rules:
- Answer ONLY using information shown on the bill (the image and the extracted data provided). Do NOT use outside tariff rates, general knowledge, or assumptions about prices.
- If a needed value is not printed on the bill, say so clearly (e.g. "The bill does not show ...") instead of guessing or inventing it.
- Get numbers right. For calculations (percentages, averages, differences, counts, estimates) compute them carefully and show your working briefly so the customer can follow.
- If a value is an estimate or an interpretation, label it as such and explain how you derived it.
- If a question has more than one reasonable meaning, state the interpretation you used, or answer both briefly.
- Never reveal personal identifiers: names, addresses, CNIC, account numbers, reference numbers, consumer numbers or meter numbers.
- Answer in English, even when parts of the bill are in Urdu.
- Be concise (2 to 4 sentences) but precise, using the actual numbers from the bill.`;

export function buildAnswerPrompt(
  question: string,
  bill: Bill | null,
  fileName: string,
): string {
  const extractedBlock = bill
    ? `The following data was extracted from this same bill by OCR (use it for exact numbers, but the image is authoritative):\n${JSON.stringify(
        bill,
        null,
        2,
      )}`
    : 'No pre-extracted data is available; read the bill directly from the image.';

  return `The attached image is an electricity bill (file: ${fileName}).

${extractedBlock}

Customer question:
${question}

Answer the question based only on the bill.`;
}