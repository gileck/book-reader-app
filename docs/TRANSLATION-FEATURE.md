# Translation Feature Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Configuration](#setup--configuration)
4. [User Guide](#user-guide)
5. [Cost Management](#cost-management)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [Caching Strategy](#caching-strategy)
9. [Troubleshooting](#troubleshooting)
10. [Future Enhancements](#future-enhancements)

---

## Overview

The Translation Feature provides on-demand text translation for reading content using the Google Cloud Translation API. It enables users to translate individual sentences or multiple consecutive sentences while reading, with comprehensive usage tracking and cost management.

### Key Features

- **On-Demand Translation**: Translate 1-10 consecutive sentences with a double-click
- **16 Language Support**: Spanish, French, German, Italian, Portuguese, Russian, Japanese, Chinese, Korean, Arabic, Hebrew, Hindi, Dutch, Polish, Turkish, Vietnamese
- **Smart Caching**: Server-side MongoDB cache reduces API calls and costs
- **Free Tier Tracking**: Monitor usage against Google Cloud's 500,000 character/month free tier
- **Usage Analytics**: Comprehensive dashboard with cost breakdowns, cache statistics, and usage trends
- **RTL Language Support**: Proper rendering for Hebrew, Arabic, and other RTL languages
- **Dark Mode Compatible**: Full theme support across all UI components
- **Language Persistence**: Remember user's preferred translation language

### Implementation Approach

Unlike the original plan to use AI models with text selection, the implemented solution:
- Uses **Google Cloud Translation API** for professional-grade translations
- Employs a **double-click/double-tap interaction** for simpler UX
- Includes **Material-UI dashboard** for usage analytics
- Implements **proportional cost calculation** respecting the free tier
- Provides **multi-sentence translation** for better context
- Supports **mobile touch gestures** with double-tap detection

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────┐  │
│  │ TranslationPopup │    │ TranslationUsage Dashboard  │  │
│  │  - Language sel. │    │  - Cost analytics           │  │
│  │  - Sentence cnt. │    │  - Free tier tracking       │  │
│  │  - Translate btn │    │  - Cache statistics         │  │
│  └──────────────────┘    └─────────────────────────────┘  │
│           │                         │                        │
│  ┌────────▼─────────────────────────▼────────────────────┐ │
│  │           ReaderContent Component                       │ │
│  │  - Double-click handler                                 │ │
│  │  - Translation state management                         │ │
│  │  - Settings persistence                                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   API Client   │
                    │  - translateText│
                    │  - getUsage    │
                    └───────┬────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                      SERVER LAYER                            │
├───────────────────────────┼──────────────────────────────────┤
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │           Translation API Handlers                      │ │
│  │  - translateTextHandler                                 │ │
│  │  - getTranslationUsageSummary                           │ │
│  │  - getTranslationUsageRecords                           │ │
│  └────────┬───────────────────────────────┬────────────────┘ │
│           │                               │                  │
│  ┌────────▼────────┐          ┌──────────▼──────────────┐  │
│  │ Google Translate│          │ Usage Monitoring        │  │
│  │ - API client    │          │ - Cost calculation      │  │
│  │ - Credentials   │          │ - Free tier tracking    │  │
│  │ - Error handling│          │ - Record creation       │  │
│  └────────┬────────┘          └──────────┬──────────────┘  │
│           │                               │                  │
└───────────┼───────────────────────────────┼──────────────────┘
            │                               │
┌───────────▼───────────────────────────────▼──────────────────┐
│                     MONGODB LAYER                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐│
│  │  Translation Cache       │  │  Translation Usage       ││
│  │  Collection              │  │  Collection              ││
│  │  - text (indexed)        │  │  - timestamp (indexed)   ││
│  │  - targetLanguage (idx)  │  │  - userId                ││
│  │  - translatedText        │  │  - textLength            ││
│  │  - TTL: 30 days          │  │  - cost                  ││
│  └──────────────────────────┘  └──────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── apis/
│   ├── translation/                    # Translation API module
│   │   ├── index.ts                   # API name export
│   │   ├── types.ts                   # Request/response types
│   │   ├── client.ts                  # Client-side API calls
│   │   ├── server.ts                  # Server exports
│   │   └── handlers/
│   │       └── translateTextHandler.ts # Translation handler
│   │
│   └── translationUsage/              # Usage tracking API
│       ├── index.ts
│       ├── types.ts
│       ├── client.ts
│       ├── server.ts
│       └── handlers/
│           ├── getTranslationUsageSummaryHandler.ts
│           └── getTranslationUsageRecordsHandler.ts
│
├── client/
│   ├── routes/
│   │   ├── Reader/components/
│   │   │   ├── TranslationPopup.tsx    # Language selection popup
│   │   │   ├── ReaderContent.tsx       # Translation integration
│   │   │   ├── ChunkRenderer.tsx       # Props passing
│   │   │   └── chunks/
│   │   │       └── TextChunk.tsx       # Translation display
│   │   │
│   │   └── TranslationUsage/           # Usage dashboard
│   │       ├── TranslationUsage.tsx
│   │       ├── TranslationUsage.module.css
│   │       └── index.ts
│   │
│   └── settings/
│       ├── SettingsContext.tsx         # Language persistence
│       └── types.ts                    # Settings types
│
└── server/
    ├── translation/
    │   └── googleTranslate.ts          # Google Cloud API client
    │
    ├── translation-usage-monitoring/   # Cost calculation logic
    │   └── index.ts
    │
    └── database/collections/
        ├── translation/                # Cache collection
        │   ├── index.ts
        │   └── types.ts
        │
        └── translationUsage/           # Usage records
            ├── index.ts
            └── types.ts
```

---

## Setup & Configuration

### Prerequisites

1. **Google Cloud Account** with Translation API enabled
2. **Service Account** with Translation API permissions
3. **MongoDB** instance (for caching and usage tracking)

### Environment Variables

Add these to your `.env` file:

```bash
# Google Cloud Translation API
GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account","project_id":"your-project",...}'
# OR
GOOGLE_APPLICATION_CREDENTIALS='/path/to/service-account-key.json'

# Alternative: Project ID (if credentials don't include it)
GOOGLE_CLOUD_PROJECT_ID='your-project-id'

# MongoDB connection (if not already configured)
MONGODB_URI='mongodb://localhost:27017/your-db'
```

### Google Cloud Setup

#### 1. Enable Translation API

```bash
# Using gcloud CLI
gcloud services enable translate.googleapis.com
```

Or via Google Cloud Console:
- Navigate to **APIs & Services > Library**
- Search for "Cloud Translation API"
- Click **Enable**

#### 2. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create translation-service \
  --display-name="Translation Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:translation-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtranslate.user"

# Generate key
gcloud iam service-accounts keys create service-account-key.json \
  --iam-account=translation-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### 3. Configure Credentials

**Option A: JSON String (Recommended for deployment)**
```bash
# Copy entire contents of service-account-key.json
GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'
```

**Option B: File Path (Good for local development)**
```bash
GOOGLE_APPLICATION_CREDENTIALS='/absolute/path/to/service-account-key.json'
```

**Option C: Base64 Encoded (Alternative for deployment)**
```bash
# Encode the JSON file
base64 service-account-key.json > credentials.base64

# Use in .env
GOOGLE_APPLICATION_CREDENTIALS='base64:ENCODED_STRING_HERE'
```

### MongoDB Indexes

The system automatically creates these indexes on startup:

```javascript
// Translation cache collection
db.translation.createIndex({ text: 1, targetLanguage: 1 }, { unique: true });
db.translation.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

// Translation usage collection
db.translationUsage.createIndex({ timestamp: -1 });
db.translationUsage.createIndex({ userId: 1 });
db.translationUsage.createIndex({ targetLanguage: 1 });
```

### Verification

Test your setup:

```bash
# Run the application
yarn dev

# Check logs for translation initialization
# Should see: "[Translation] Google Translate initialized"

# Try translating a sentence in the reader
# Check dashboard at: http://localhost:3000/translation-usage
```

---

## User Guide

### How to Translate Text

#### Step 1: Double-Click/Double-Tap a Sentence
While reading, **double-click** (desktop) or **double-tap** (mobile) any sentence to open the translation popup.

#### Step 2: Select Language
Choose your target language from the dropdown (default: Spanish).
Available languages:
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Japanese (ja)
- Chinese (zh)
- Korean (ko)
- Arabic (ar)
- Hebrew (he)
- Hindi (hi)
- Dutch (nl)
- Polish (pl)
- Turkish (tr)
- Vietnamese (vi)

#### Step 3: Choose Sentence Count
Select how many consecutive sentences to translate (1-10).

#### Step 4: Translate
Click the "Translate" button. The popup will close and translated text will replace the original.

### Translation Display

Once translated, the sentence shows:
- **Translated text** with proper RTL support (for Arabic/Hebrew)
- **Usage information**: Character count and free tier percentage
- **Cost indicator**: Dollar amount (only if exceeding free tier)
- **Cache status**: 💾 icon if loaded from cache

### Translation Controls

Two buttons appear at the bottom of translated text:

| Button | Icon | Function |
|--------|------|----------|
| **Toggle** | ⇄ | Switch between original and translated text |
| **Remove** | ✕ | Clear translation and show original text |

### Viewing Usage Statistics

Navigate to **Translation Usage** in the app menu to see:
- **Total Cost**: Actual billable cost (respects free tier)
- **Total Characters**: All translated characters
- **Cache Hit Ratio**: Percentage of translations served from cache
- **Cost Savings**: Money saved from cached translations
- **Free Tier Progress**: Visual bar showing 500k/month usage
- **Per-Language Stats**: Breakdown by target language
- **Daily Usage**: Last 7 days of translation activity
- **Recent Translations**: Last 24 hours of individual translations

### Tips for Efficient Use

1. **Use Multi-Sentence Translation**: Translating 5 sentences at once provides better context than 5 individual translations
2. **Watch Your Free Tier**: Monitor the progress bar to stay within 500k characters/month
3. **Leverage Cache**: Re-translating the same text is free (served from cache)
4. **Choose Languages Wisely**: The same text cached in one language won't help with another language
5. **Translation Persists**: Your last selected language is remembered for next time

---

## Cost Management

### Google Cloud Translation Pricing

```
Free Tier:  500,000 characters/month
Paid Tier:  $20 per 1 million characters
Cost Per Character: $0.00002
```

### Examples

| Characters | Within Free Tier | Cost |
|-----------|------------------|------|
| 100,000 | ✅ Yes | $0.00 |
| 500,000 | ✅ Yes | $0.00 |
| 600,000 | ❌ No | $2.00 (100k × $0.00002) |
| 1,000,000 | ❌ No | $10.00 (500k × $0.00002) |

### Free Tier Billing Logic

The system implements **fair free tier calculation**:

```typescript
// Example: 600,000 characters used in current month
const freeTierLimit = 500000;
const totalUsed = 600000;

// Only charge for characters beyond free tier
const billableChars = Math.max(0, totalUsed - freeTierLimit); // 100,000
const cost = billableChars * 0.00002; // $2.00

// NOT: totalUsed * 0.00002 = $12.00 ❌ (incorrect)
```

**Key Point**: You're never charged for the first 500k characters each month, even if you exceed the limit.

### Cost Distribution

Costs are distributed proportionally when you exceed the free tier:

```typescript
// Scenario: 600k chars used across 3 translations
// Translation A: 200k chars
// Translation B: 300k chars  
// Translation C: 100k chars

// Billable: 100k chars beyond free tier
// Translation A gets: (200k/600k) × $2.00 = $0.67
// Translation B gets: (300k/600k) × $2.00 = $1.00
// Translation C gets: (100k/600k) × $2.00 = $0.33
```

### Caching Benefits

Cached translations:
- ✅ **Count toward free tier** (recorded for tracking)
- ✅ **Show $0.00 cost** (no API call made)
- ✅ **Improve cache hit ratio** (displayed on dashboard)
- ✅ **Save money** (cost savings tracked separately)

### Cache Savings Calculation

```typescript
// Example: Same 50k character passage translated 4 times
// 1st translation: API call = 50k chars counted
// 2nd translation: Cache hit = 50k chars counted, $0 cost
// 3rd translation: Cache hit = 50k chars counted, $0 cost  
// 4th translation: Cache hit = 50k chars counted, $0 cost

// Total characters: 200k (all 4 count toward free tier)
// Actual API usage: 50k
// Cache savings: 3 × $1.00 = $3.00 (if all were beyond free tier)
```

### Monitoring Usage

The Translation Usage Dashboard provides:

1. **Real-time free tier tracking**
   - Characters used / 500,000
   - Percentage bar with color coding:
     - Green: 0-75%
     - Orange: 75-90%
     - Red: 90-100%

2. **Monthly reset awareness**
   - Current month usage shown prominently
   - Historical months show their stored costs
   - Free tier resets automatically on 1st of each month

3. **Cost alerts**
   - Warning at 75% of free tier
   - Error alert at 90% of free tier
   - Dollar costs only shown when exceeding free tier

### Best Practices

1. **Stay Within Free Tier**
   - Monitor dashboard regularly
   - 500k characters ≈ 250 pages of text
   - Plan heavy translation sessions accordingly

2. **Maximize Cache Hits**
   - Common phrases get cached automatically
   - Re-reading translated books is essentially free
   - Popular languages benefit more from shared cache

3. **Use Multi-Sentence Translation**
   - Better context = better translations
   - More efficient than single sentences
   - Same cost, better quality

4. **Set Usage Alerts**
   - Check dashboard weekly if translating frequently
   - Watch for approaching 75% threshold
   - Consider upgrading to paid tier if consistently exceeding

---

## API Reference

### Translation API

#### `translateText`

Translate text to target language with caching and usage tracking.

**Request:**
```typescript
interface TranslateTextRequest {
  text: string;              // Text to translate (max ~5000 chars)
  targetLanguage: string;    // ISO 639-1 language code (e.g., 'es')
  sourceLanguage?: string;   // Optional source language (auto-detect if omitted)
}
```

**Response:**
```typescript
interface TranslateTextResponse {
  success: boolean;
  translatedText: string;
  detectedSourceLanguage?: string;  // Auto-detected if not specified
  characterCount?: number;           // Number of characters translated
  cost?: number;                     // Cost in USD (may be 0 if cached)
  fromCache?: boolean;               // True if served from cache
  freeTierUsage?: {
    used: number;                    // Current month usage
    total: number;                   // 500,000
    remaining: number;               // Characters remaining
    percentUsed: number;             // Percentage of free tier used
  };
  error?: string;                    // Error message if success=false
}
```

**Example:**
```typescript
import { translateText } from '@/apis/translation/client';

const result = await translateText({
  text: "Hello, world!",
  targetLanguage: "es"
});

if (result.data?.success) {
  console.log(result.data.translatedText); // "¡Hola, mundo!"
  console.log(result.data.fromCache);       // true/false
  console.log(result.data.freeTierUsage);   // { used: 1234, total: 500000, ... }
}
```

### Usage Tracking API

#### `getTranslationUsageSummary`

Get aggregated translation usage statistics for a time period.

**Request:**
```typescript
interface GetTranslationUsageSummaryRequest {
  rangeDays?: number | 'current-month' | 'previous-month';
  // Default: 30 days
}
```

**Response:**
```typescript
interface TranslationUsageSummary {
  totalCost: number;                 // Total billable cost (respects free tier)
  totalCalls: number;                // Number of translation requests
  totalCharacters: number;           // Total characters translated
  totalCacheHits: number;            // Translations served from cache
  totalCacheMisses: number;          // Translations that required API calls
  cacheHitRatio: number;             // Percentage (0-100)
  costSavingsFromCache: number;      // Money saved from cache hits
  freeTierMonthUsage: number;        // Current month non-cached characters
  
  usageByLanguage: Record<string, {
    totalCost: number;
    totalCalls: number;
    totalCharacters: number;
    cacheHits: number;
    cacheMisses: number;
  }>;
  
  usageByDay: Record<string, {      // ISO date string keys
    totalCost: number;
    totalCalls: number;
    totalCharacters: number;
    cacheHits: number;
    cacheMisses: number;
  }>;
}
```

**Example:**
```typescript
import { getTranslationUsageSummary } from '@/apis/translationUsage/client';

const result = await getTranslationUsageSummary({
  rangeDays: 'current-month'
});

if (result.data?.success) {
  const summary = result.data.summary;
  console.log(`Total Cost: $${summary.totalCost.toFixed(4)}`);
  console.log(`Cache Hit Ratio: ${summary.cacheHitRatio.toFixed(1)}%`);
  console.log(`Free Tier: ${summary.freeTierMonthUsage} / 500,000`);
}
```

#### `getTranslationUsageRecords`

Get individual translation records for detailed analysis.

**Request:**
```typescript
interface GetTranslationUsageRecordsRequest {
  startDate?: Date;    // Default: 24 hours ago
  endDate?: Date;      // Default: now
  limit?: number;      // Max records to return
}
```

**Response:**
```typescript
interface TranslationUsageRecord {
  id: string;
  timestamp: Date;
  textLength: number;
  cost: number;
  targetLanguage: string;
  sourceLanguage?: string;
  userId?: string;
  fromCache: boolean;
  endpoint: string;
}
```

---

## Database Schema

### Translation Cache Collection

**Collection Name**: `translation`

```typescript
interface TranslationCache {
  _id: ObjectId;
  text: string;                    // Original text (indexed)
  translatedText: string;          // Translated text
  targetLanguage: string;          // Target language code (indexed)
  sourceLanguage: string;          // Detected source language
  characterCount: number;          // Character count
  createdAt: Date;                 // Creation timestamp (TTL indexed)
}
```

**Indexes:**
```javascript
{ text: 1, targetLanguage: 1 }  // Compound unique index for lookups
{ createdAt: 1 }                // TTL index (expire after 30 days)
```

**TTL (Time To Live)**: 30 days
- Translations automatically deleted after 30 days
- Reduces database size
- Forces fresh translations for stale content

### Translation Usage Collection

**Collection Name**: `translationUsage`

```typescript
interface TranslationUsageRecord {
  _id: ObjectId;
  id: string;                      // UUID for external reference
  timestamp: Date;                 // When translation occurred (indexed)
  textLength: number;              // Characters translated
  cost: number;                    // Cost in USD
  targetLanguage: string;          // Target language (indexed)
  sourceLanguage?: string;         // Source language (if detected)
  userId?: string;                 // User ID (indexed, optional)
  fromCache: boolean;              // Whether served from cache
  endpoint: string;                // API endpoint used
}
```

**Indexes:**
```javascript
{ timestamp: -1 }     // Descending for recent records
{ userId: 1 }         // For per-user analytics
{ targetLanguage: 1 } // For language-specific analytics
```

### User Settings Extension

**Collection Name**: `userSettings`

```typescript
interface UserSettings {
  // ... existing fields ...
  lastTranslationLanguage?: string;  // Most recent target language
}
```

**Purpose**: Persists user's language preference across sessions.

---

## Caching Strategy

### Multi-Level Caching

```
┌─────────────────────────────────────────────────────────┐
│                    Translation Request                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   1. Check MongoDB Cache      │
         │   (text + targetLanguage)     │
         └───────────┬───────────────────┘
                     │
            ┌────────┴────────┐
            │                 │
         Hit│                 │Miss
            │                 │
            ▼                 ▼
   ┌────────────────┐  ┌──────────────────┐
   │ Return Cached  │  │  Call Google API │
   │  Translation   │  │                  │
   │  cost = $0     │  │  cost = $0.00002 │
   └────────────────┘  └────────┬─────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │  Save to MongoDB Cache │
                    │  TTL: 30 days          │
                    └────────────────────────┘
```

### Cache Key Generation

```typescript
// Cache key is composite of text and target language
const cacheKey = {
  text: "Hello, world!",
  targetLanguage: "es"
};

// Same text to different languages = different cache entries
// "Hello" -> Spanish: cached separately
// "Hello" -> French:  cached separately
```

### Cache Invalidation

- **Time-based**: 30-day TTL (automatic MongoDB expiration)
- **No manual invalidation**: Translations are considered immutable
- **Storage cost**: Minimal (text is compressed by MongoDB)

### Cache Hit Optimization

Best practices for maximizing cache hits:

1. **Consistent Text**: Same text = cache hit
   - Including punctuation and spacing
   - Case-sensitive matching

2. **Popular Languages**: More users = more shared cache
   - Spanish, French, German have higher hit rates
   - Rare language pairs cache less effectively

3. **Common Phrases**: Frequently translated text benefits most
   - Book introductions
   - Common literary phrases
   - Repeated sentences in text

4. **Multi-Sentence Translation**: Larger chunks improve hit rate
   - Fewer unique combinations
   - Better context preservation
   - More efficient caching

### Cache Performance Metrics

Monitor these on the dashboard:

- **Cache Hit Ratio**: Target >60% for cost efficiency
- **Cost Savings**: How much money cache saved
- **Cache Hits per Language**: Which languages cache well

---

## Troubleshooting

### Common Issues

#### 1. Translation Not Working

**Symptoms**: Popup appears but translation fails

**Checks**:
```bash
# Verify Google Cloud credentials
echo $GOOGLE_APPLICATION_CREDENTIALS

# Check if Translation API is enabled
gcloud services list --enabled | grep translate

# Test API access
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://translation.googleapis.com/language/translate/v2?key=YOUR_API_KEY" \
  -d '{"q":"Hello","target":"es"}'
```

**Solutions**:
- Verify credentials are correct JSON
- Check service account has `roles/cloudtranslate.user` permission
- Ensure Translation API is enabled in Google Cloud Console
- Check server logs for detailed error messages

#### 2. Credentials Error: ENAMETOOLONG

**Error**: `Error: ENAMETOOLONG: name too long, open '/Users/.../ewogICJ0e...'`

**Cause**: Google Cloud client treating JSON string as file path

**Solution**: The application automatically handles this. If you see this error:
```bash
# Ensure credentials are properly formatted
# Option 1: File path (preferred for local)
GOOGLE_APPLICATION_CREDENTIALS='/absolute/path/to/key.json'

# Option 2: JSON string (preferred for deployment)
GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'

# Option 3: Base64 encoded
GOOGLE_APPLICATION_CREDENTIALS='base64:YOUR_BASE64_STRING'
```

#### 3. Popup Closes Immediately

**Symptoms**: Can't select language or sentence count before popup disappears

**Cause**: Click outside detection triggering too aggressively

**Solution**: Fixed in current version. Popup now stays open when:
- Language dropdown is open
- Sentence count dropdown is open  
- Clicking inside popup area

If still occurring:
- Check browser console for errors
- Try updating to latest version
- Disable browser extensions that might interfere

#### 4. Translation Language Not Persisting

**Symptoms**: Language selection resets to Spanish on page refresh

**Cause**: User settings not properly saving to database

**Checks**:
```typescript
// Check browser console for setting saves
// Should see: "[SettingsContext] Updating user settings: { lastTranslationLanguage: 'fr' }"
// Should see: "[SettingsContext] Settings persisted to database: ..."

// Verify MongoDB userSettings collection has the field
db.userSettings.findOne({ userId: "YOUR_USER_ID" })
// Should include: lastTranslationLanguage: "fr"
```

**Solutions**:
- Ensure user is authenticated (feature requires login)
- Check MongoDB connection is working
- Verify `updateUserSettings` API is functioning
- Check server logs for database errors

#### 5. Dark Mode Issues

**Symptoms**: Translation UI elements not visible in dark mode

**Cause**: Hard-coded colors instead of theme variables

**Solution**: Fixed in current version. All components use Material-UI theme variables:
```typescript
// ✅ Correct (theme-aware)
<Box sx={{ color: 'text.primary', backgroundColor: 'background.paper' }} />

// ❌ Incorrect (hard-coded)
<Box sx={{ color: '#000000', backgroundColor: '#ffffff' }} />
```

#### 6. Cost Showing Incorrect Values

**Symptoms**: Dashboard shows cost when within free tier, or $0 when over limit

**Cause**: Billing logic not accounting for free tier correctly

**Solution**: Fixed in latest version. Verify you're on the correct version:
```bash
# Check commit for billing fix
git log --oneline --grep="billing logic"

# Should see: "feat: add translation feature with Google Cloud Translation API"
# With note: "Bug Fixes: Fixed critical billing logic..."
```

If issue persists:
- Clear browser cache
- Check MongoDB `translationUsage` records have correct `cost` field
- Verify current month records are being filtered correctly

#### 7. RTL Languages Not Displaying Correctly

**Symptoms**: Hebrew or Arabic text appears left-to-right

**Cause**: Missing RTL CSS properties

**Solution**: Fixed in current version. Check these CSS properties are applied:
```typescript
// TextChunk.tsx should have:
dir={!showOriginal && isRTL ? 'rtl' : 'ltr'}
style={{
  textAlign: !showOriginal && isRTL ? 'right' : 'left',
  unicodeBidi: 'embed',
}}
```

#### 8. Dashboard Not Loading

**Symptoms**: Translation Usage page shows loading spinner indefinitely

**Checks**:
```bash
# Check API endpoint is registered
grep TRANSLATION_USAGE src/apis/apis.ts

# Test API directly
curl http://localhost:3000/api/translationUsage/summary

# Check MongoDB connection
mongosh
use your_database
db.translationUsage.count()
```

**Solutions**:
- Verify MongoDB is running
- Check API is properly registered in `apis.ts`
- Look for server errors in console
- Ensure user has permission to access dashboard

### Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Text and target language are required" | Missing request parameters | Check client is sending both fields |
| "Failed to translate text" | Google API error | Check credentials and API quota |
| "Cannot find module '@/server/cache/types'" | Import path error | Use '@/common/cache/types' instead |
| "GOOGLE_APPLICATION_CREDENTIALS not set" | Missing env variable | Set credentials in .env file |
| "Translation API quota exceeded" | Exceeded Google Cloud limits | Check quota in Cloud Console |

### Debug Mode

Enable detailed logging:

```bash
# In your terminal or .env
DEBUG=translation:*

# Server will log:
# - [Translation] Cache hit for "..."
# - [Translation] Cache miss, calling Google API
# - [Translation] Saving language preference: fr
# - [Translation Usage] Calculating cost...
```

### Getting Help

If issues persist:

1. **Check Server Logs**: Most errors are logged server-side
2. **Browser Console**: Check for client-side errors
3. **MongoDB Logs**: Verify database operations
4. **Google Cloud Console**: Check API usage and errors
5. **GitHub Issues**: Report bugs with full error logs

---

## Future Enhancements

### Planned Features

1. **Text Selection Translation**
   - Drag to select arbitrary text
   - Translate selections across multiple sentences
   - Right-click context menu integration

2. **Translation History**
   - View past translations
   - Bookmark important translations
   - Export translation history

3. **Offline Mode**
   - Download translations for offline reading
   - Sync when online
   - Offline-first architecture

4. **Additional Language Pairs**
   - Expand beyond current 16 languages
   - Regional language support
   - Dialect recognition

5. **Translation Quality Options**
   - Formal vs informal translations
   - Literary vs literal translations
   - Custom glossaries for technical terms

6. **Audio Integration**
   - Hear translated text using TTS
   - Translation pronunciation guide
   - Audio playback continues with translation display

7. **Social Features**
   - Share translations with other users
   - Community translation corrections
   - Popular translations cache boost

8. **Advanced Caching**
   - Prefetch translations for next sentences
   - Smart cache warming based on reading patterns
   - Compression for large translations

9. **Cost Optimization**
   - Batch multiple requests when possible
   - Predictive caching
   - Alternative API providers fallback

10. **Analytics Dashboard Enhancements**
    - Cost projections
    - Budget alerts via email/SMS
    - Detailed language pair statistics
    - Export usage data to CSV/PDF

### Contributing

To contribute to the translation feature:

1. Review the [API Guidelines](../app-guildelines/client-server-communications.md)
2. Follow [TypeScript Guidelines](../app-guildelines/Typescript-guildelines.md)
3. Ensure [React Component Guidelines](../app-guildelines/React-components-guidelines.md) compliance
4. Run `yarn checks` before committing
5. Update this documentation with any new features

---

## Changelog

### v1.0.1 (Current)

**Bug Fixes**
- 🐛 Fixed mobile double-tap not working (added touch event support)

### v1.0.0

**Initial Release**
- ✅ Google Cloud Translation API integration
- ✅ 16 language support
- ✅ Multi-sentence translation (1-10)
- ✅ MongoDB caching with 30-day TTL
- ✅ Free tier tracking (500k chars/month)
- ✅ Material-UI usage dashboard
- ✅ RTL language support (Hebrew, Arabic)
- ✅ Dark mode compatibility
- ✅ Language preference persistence
- ✅ Proportional cost calculation
- ✅ Cache hit ratio analytics
- ✅ Cost savings tracking

**Bug Fixes**
- 🐛 Fixed critical billing logic (only charge beyond free tier)
- 🐛 Fixed popup closing on dropdown interaction
- 🐛 Fixed language preference not persisting
- 🐛 Fixed Google credentials ENAMETOOLONG error
- 🐛 Fixed dark mode visibility issues
- 🐛 Fixed RTL text alignment

---

## License & Attribution

This feature uses the [Google Cloud Translation API](https://cloud.google.com/translate/docs) which is subject to Google Cloud's terms of service and pricing.

**Pricing Information**: https://cloud.google.com/translate/pricing
**API Documentation**: https://cloud.google.com/translate/docs/reference/rest

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainer**: Development Team

