# WTQ Utility Bill Decoder

AI-powered assistant that reads Pakistani electricity bills (K-Electric, LESCO, IESCO) from images,
extracts their structured billing data (Level 1), and answers customer questions in plain English (Level 2).

Built for the WTQ Build Track 2026 "Utility Bill Decoder" challenge.

## Runtime

- Node.js **22.14.0** (>= 22 recommended). State your version above in the submission README.

## What it does

1. **Level 1 – Extraction**: a Gemini vision call reads each bill image and returns one JSON object
   with provider, tariff, sanctioned load, bill month, dates, readings, charges, taxes and payable
   amounts. Personal identifiers are never returned. Result is written to `output/level1.csv`.
2. **Level 2 – Questions**: for every `(bill, question)` row in the Level 2 template, a Gemini vision
   call answers the question grounded only in that bill's image + extracted JSON (numbers, dates,
   percentages computed from the bill). 180 answers total (10 bills x 18 questions). Result is
   written to `output/level2.csv`.
3. **Assistant UI**: a local web app (`/`) where you upload or pick a bill, extract it with AI and chat
   with it. Extraction results also viewable at `/level1`.

## Architecture

```
test/bills/            bill images (training or test dataset)
test/bills/csv/        CSV templates as distributed (level1.csv, level2.csv)
output/                generated level1.csv + level2.csv (submission deliverables)
lib/ai/                Gemini client with primary/secondary API key + model fallback
lib/level1/            extraction: prompt, Zod schema, normalization
lib/level2/            Q&A engine: prompt rules + answer generation
lib/csv.ts             CSV writer/parser (quoting per RFC, UTF-8)
lib/bills.ts           bill image discovery + data-URL helpers
scripts/level1.ts      batch runner: bill images -> output/level1.csv
scripts/level2.ts      batch runner: template -> output/level2.csv
app/api/extract        POST image -> Level 1 JSON (used by the UI)
app/api/ask            POST image + question -> answer (used by the UI)
app/api/bills          GET sample bills (used by the UI)
app/api/level1         GET Level 1 results (viewer)
```

## Setup

```bash
npm install
copy .env.example .env     # then put your real Gemini API keys in .env
```

Required environment variables (see `.env.example`):

| Variable | Value | Notes |
| --- | --- | --- |
| `MODEL_PROVIDER` | `google` | Only provider supported in the shipped build |
| `MODEL_NAME` | `gemini-3.5-flash-lite` | Any allowed model: `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `claude-haiku-4-5`, `gpt-4.1-mini`, `gpt-5-mini` |
| `AI_PROVIDER` | `gemini` | Alias kept for compatibility |
| `GEMINI_API_KEY_PRIMARY` | your key | Required. Get a free key at https://aistudio.google.com |
| `GEMINI_API_KEY_SECONDARY` | your key | Optional fallback key |
| `DATABASE_URL` | _unused_ | The app ships without a database; CSV files are written directly |

## Generating the submission CSVs

### Level 1 (bill images -> level1.csv)

```bash
npx tsx scripts/level1.ts --input test/bills --out output/level1.csv --delay 3200
```

Each bill image file name becomes the `bill_id`. The JSON for each bill is written on one line in the
`json` column with RFC-style doubled quotes inside the quoted cell.

### Level 2 (template -> level2.csv)

```bash
npx tsx scripts/level2.ts \
  --template test/bills/csv/level2.csv \
  --input test/bills \
  --level1 output/level1.csv \
  --out output/level2.csv \
  --delay 4500
```

The runner keeps the template's column names and row order, fills only the `answer` column, and never
changes `bill_id`, `question_id` or `question`. If `--level1` is missing it answers from the image alone.

Useful flags on both runners: `--limit N` (first N rows), `--filter STRING` (subset by bill_id/question_id).

### Verified end-to-end run

```bash
npx tsx scripts/level1.ts --input test/bills --out output/level1.csv --delay 3200
npx tsx scripts/level2.ts --template test/bills/csv/level2.csv --input test/bills --level1 output/level1.csv --out output/level2.csv --delay 4500
```

Run on the **10 test bills** with the released templates to produce `output/level1.csv` (10 rows) and
`output/level2.csv` (180 rows) for submission.

## Level 1 rules implemented

- Values extracted **as printed**; no recalculation, rounding or "correction" (exception: guide was
  found wrong on a sample bill and the printed bill values are kept).
- Numbers in PKR without currency labels or commas; credits and subsidies negative.
- Dates normalized to `YYYY-MM-DD`, months to `YYYY-MM`.
- `null` for unavailable values, `[]` for empty lists. Never guessed.
- Personal identifiers (names, addresses, CNIC, account, reference, consumer, meter numbers) excluded.
- LESCO-style bills without a tax breakdown: `taxes: []`, combined amount in `total_taxes`.
- Multi-register meters: scalar readings = main register; extra `readings[]` array holds every register.
- `payable_after_due_date` uses the highest printed late-payment amount; "NOT TO BE PAID" = `0`.

## Level 2 rules implemented

- Answers draw only from the bill image + extracted JSON. No outside tariff/rate knowledge.
- Numbers (percentages, averages, differences, counts) computed from printed values; estimates are
  labelled and explained.
- When the bill does not show a needed value the answer says so instead of guessing.
- Ambiguous questions: the interpretation is stated, or both readings answered.
- Personal identifiers excluded; answers always in English.

## AI usage (required disclosure)

| Category | Used | Details |
| --- | --- | --- |
| Model(s) at runtime | Gemini 3.5 Flash-Lite (primary), Gemini 3.1 Flash-Lite (fallback) | Google AI Studio. `MODEL_NAME` pins the model; both are in the allowed list. |
| Provider(s) | Google Generative Language API | `MODEL_PROVIDER=google` |
| Local OCR libraries | None | Vision is done by the Gemini model with the image attached. |
| Invoice/receipt extraction agents | None | No Azure/prebuilt/Textract/Mindee services. |
| AI tools used to write the code | opencode CLI assisting agent (model id `opencode/big-pickle`) | Used interactively to implement, test and debug this codebase in this working directory. |

No other AI services or libraries are used.

## Submission packaging

Build one ZIP (max 15 MB) with this structure:

```
submission.zip
├── output/
│   ├── level1.csv         10 rows: bill_id,json
│   └── level2.csv         180 rows: bill_id,question_id,question,answer
├── source/
│   ├── README.md
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   └── ... project code
└── demo/                  optional: demo.mp4 / .mov / .webm (<= 3 min)
```

To build it on Windows PowerShell from the project root:

```powershell
$sub = Join-Path (Get-Location) 'submission'
Remove-Item -Recurse -Force $sub -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "$sub\output"   | Out-Null
New-Item -ItemType Directory -Path "$sub\source"   | Out-Null
Copy-Item output\level1.csv, output\level2.csv -Destination "$sub\output"
# copy project code (exclude .env, node_modules, .next, submission):
robocopy . "$sub\source" /E /XD node_modules .next submission /XF .env *.log
Compress-Archive -Path "$sub\*" -DestinationPath submission.zip -Force
Get-Item submission.zip | Select-Object Name, Length
```

**Important:** never include `.env`, API keys, `node_modules`, or `.next` in the ZIP. Inspect the ZIP
before uploading at https://build.womentechquest.com/submit.