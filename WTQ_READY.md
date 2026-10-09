# WTQ Ready Checklist & Information

## AI Models Used

The application is configured to use **only** WTQ-approved Gemini models with the following fallback order:

1. `gemini-3.5-flash-lite` - Gemini API Key Primary
2. `gemini-3.1-flash-lite` - Gemini API Key Primary  
3. `gemini-3.5-flash-lite` - Gemini API Key Secondary
4. `gemini-3.1-flash-lite` - Gemini API Key Secondary

No other models (including Groq or OpenRouter) are used in the active fallback chain.

## Environment Variables

The following environment variables must be configured:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon/Supabase/etc.) |
| `GEMINI_API_KEY_PRIMARY` | Yes | Primary Gemini API key from Google AI Studio |
| `GEMINI_API_KEY_SECONDARY` | Yes | Secondary Gemini API key from Google AI Studio |

## Deployment Steps

### Vercel Deployment

1. Connect your repository to [Vercel](https://vercel.com)
2. Configure the environment variables listed above in Project Settings > Environment Variables
3. Ensure the build command is `npm run build` (default)
4. Deploy - Vercel will automatically run Prisma generate and build

### Post-Deployment Setup

1. Run database migrations: `npx prisma migrate deploy` (if using migrations)
2. Verify the health endpoint: `https://your-app.vercel.app/api/health`
3. Test AI generation: POST to `https://your-app.vercel.app/api/ai/generate` with `{"prompt": "test"}`

## Competition Workflow

1. **Dataset Analysis**: Upload/analyze provided dataset using the application
2. **AI-Powered Insights**: Leverage Gemini models to generate insights, predictions, classifications, or recommendations as needed
3. **Working MVP**: The application provides a complete, functional solution
4. **API Endpoints**:
   - `GET /api/health` - Health check
   - `POST /api/ai/generate` - AI text generation using WTQ-approved Gemini models

## Verification Status

- ✅ TypeScript compilation passes (`tsc --noEmit`)
- ✅ Prisma schema validation passes
- ✅ AI provider restricted to allowed WTQ models only
- ✅ Fallback chain configured per WTQ requirements
- ✅ Build configuration verified
- ✅ API routes properly structured for Next.js App Router

## Notes

- The fallback mechanism automatically switches between allowed models and keys on rate limits, quota issues, or temporary failures
- All code uses strict TypeScript with no `any` types
- The implementation is server-side only for security
- Maximum output tokens are capped at 500 for efficiency
