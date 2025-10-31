# AI Models Update - October 2025

## Summary
Updated all AI model IDs and names to use the latest supported versions by Google AI and OpenAI providers.

## Changes Made

### 1. Google Gemini Models (src/server/ai/models.ts)

**Updated Models:**
- ❌ Retired Gemini 1.5 series (Flash-8B, Flash, Pro)
- ✅ Added `gemini-2.5-flash-lite`, `gemini-2.5-flash`, and `gemini-2.5-pro`

**Updated Max Tokens:**
- Gemini 2.5 Flash Lite: 1,048,576 tokens
- Gemini 2.5 Flash: 1,048,576 tokens
- Gemini 2.5 Pro: 2,097,152 tokens

### 2. OpenAI Models (src/server/ai/models.ts)

**Updated Model Names:**
- `GPT-4O Mini` → `GPT-4o Mini` (capitalization fix)
- `GPT-4O` → `GPT-4o` (capitalization fix)
- ✨ **Added:** `gpt-4-turbo` (new model)

**Updated Max Tokens:**
- GPT-4o Mini: 8,192 → 16,384 tokens
- GPT-4o: 8,192 → 16,384 tokens
- GPT-4 Turbo: 4,096 tokens (new)

### 3. Pricing Updates (src/server/ai/price.ts)

**Updated pricing for supported model IDs:**
- Replaced Gemini 1.5 pricing with Gemini 2.5 Flash Lite / Flash / Pro
- Updated tier logic to match 200K-token thresholds used by Google pricing
- Retained OpenAI pricing, including `gpt-4-turbo`

### 4. Default Model Update (src/client/routes/Reader/hooks/useBookQA.ts)

**Changed default model:**
- ❌ `gemini-1.5-flash-8b-latest` → ✅ `gemini-2.5-flash-lite`

## Why These Changes?

### Google Gemini
Google officially retired all Gemini 1.5 series models on September 24, 2025 ([model lifecycle](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions)). The latest stable models are Gemini 2.5 (Flash Lite, Flash, Pro). Migrating ensures:
- Continued API availability (no 404 errors on retired IDs)
- Access to latest quality improvements
- Alignment with Google’s support timeline through June–July 2026

### OpenAI
- Updated token limits to reflect current API capabilities
- Added GPT-4 Turbo for more options
- Fixed capitalization to match official OpenAI naming

## Migration Notes

### For Users
If you have a saved model preference in localStorage, it will automatically fall back to the new default model (`gemini-2.5-flash-lite`) if the old model ID is not found.

### For Developers
The changes are backward compatible in the sense that:
1. Old model IDs will gracefully fail and fall back to defaults
2. New model IDs are supported by current API versions
3. All pricing data has been updated

## Available Models (After Update)

### Google Gemini
1. **Gemini 2.5 Flash Lite** (`gemini-2.5-flash-lite`)
   - Most cost-effective
   - Best for: Quick responses, summarization, lite reasoning
   - Max tokens: 1,048,576

2. **Gemini 2.5 Flash** (`gemini-2.5-flash`)
   - Balanced performance and cost
   - Best for: General Q&A, content generation, multimedia inputs
   - Max tokens: 1,048,576

3. **Gemini 2.5 Pro** (`gemini-2.5-pro`)
   - Most capable
   - Best for: Complex reasoning, long-context analysis
   - Max tokens: 2,097,152

### OpenAI
1. **GPT-4o Mini** (`gpt-4o-mini`)
   - Most cost-effective
   - Best for: Quick responses, simple tasks
   - Max tokens: 16,384

2. **GPT-4o** (`gpt-4o`)
   - High performance
   - Best for: Complex tasks, detailed responses
   - Max tokens: 16,384

3. **GPT-4 Turbo** (`gpt-4-turbo`)
   - Previous generation, still capable
   - Best for: General purpose use
   - Max tokens: 4,096

## Testing
✅ All TypeScript compilation checks pass
✅ All ESLint checks pass
✅ No breaking changes detected

## Date
October 31, 2025

