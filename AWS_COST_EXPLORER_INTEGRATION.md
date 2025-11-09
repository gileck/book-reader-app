# AWS Cost Explorer Integration for TTS Usage Tracking

## Overview
Integrated AWS Cost Explorer API to track real Amazon Polly (TTS) usage and costs directly from AWS billing data, while maintaining internal tracking for all providers.

## Implementation Summary

### 1. AWS Cost Explorer Wrapper (`src/server/aws-cost-explorer/index.ts`)
- **Purpose**: Encapsulates AWS Cost Explorer API calls for Amazon Polly usage tracking
- **Key Features**:
  - Fetch Polly usage by date range (daily/monthly granularity)
  - Parse AWS responses into structured data (characters used, costs, usage types)
  - **Free-tier tracking**: Automatically categorizes usage by voice type (Standard, Neural, Long-Form)
  - Graceful error handling when AWS credentials are unavailable
  - Singleton instance for easy access across the application

**Important**: This wrapper ONLY tracks Amazon Polly usage. Google TTS and ElevenLabs are NOT tracked by AWS Cost Explorer.

### 2. Type Definitions (`src/apis/ttsUsage/types.ts`)
- Added `AwsTtsData` interface to represent AWS Cost Explorer data
- Extended `TtsUsageSummary` to include optional `awsData` field
- Added `currentMonthFreeTier` breakdown for Standard, Neural, and Long-Form voices
- Maintains backward compatibility with existing internal tracking

### 3. Server Integration (`src/server/tts-usage-monitoring/index.ts`)
- Updated `getTtsUsageSummary()` to fetch AWS Cost Explorer data
- **Fetches both**: Range data (for selected period) AND current month data (for free-tier)
- AWS data is fetched asynchronously alongside internal tracking
- Non-blocking: If AWS data fails, internal tracking still works
- AWS data has 24-48 hour delay (inherent to AWS Cost Explorer)

### 4. Dashboard UI (`src/client/routes/TtsUsage/TtsUsage.tsx`)
- Added dedicated "AWS Cost Explorer - Amazon Polly" section
- **Range Selector with Dynamic Month Names**:
  - Current Month (e.g., "Current Month (November)")
  - Previous Month (e.g., "Previous Month (October)")
  - Last 30 days
  - Last 60 days
  - Last 90 days
- **Only displays when**:
  - AWS data is available
  - Polly provider exists in usage summary
- **Displays**:
  - AWS Polly cost vs internal Polly cost comparison
  - Tracking accuracy percentage
  - Daily usage breakdown (last 10 days)
  - **Free-tier usage for current month** with progress bars
  - Clear indication that Google TTS & ElevenLabs use internal tracking

### 5. Free-Tier Display
- **Visual progress bars** showing usage against free-tier limits:
  - Standard: 5M characters/month
  - Neural: 1M characters/month
  - Long-Form: 500K characters/month
- **Color-coded status**:
  - Green (< 70%): Safe
  - Orange (70-90%): Warning
  - Red (> 90%): Danger
- **Mobile-first design** with responsive grid layout

## Key Benefits

### ✅ Accurate Billing Data
- AWS Cost Explorer provides the **actual billed amount** for Polly
- No need to maintain complex pricing calculations for Polly
- Validates internal tracking accuracy

### ✅ Dual Tracking System
- **Internal tracking**: Real-time, all providers (Polly, Google, ElevenLabs)
  - Used for rate limiting
  - Used for immediate feedback
  - Used for cache hit/miss statistics
  
- **AWS tracking**: Delayed but accurate, Polly only
  - Source of truth for billing
  - Used for cost validation
  - Used for monthly billing reports

### ✅ Provider-Specific Display
- AWS data only shown for Amazon Polly (where it's available)
- Google TTS and ElevenLabs continue using internal tracking
- Clear UI messaging about data sources

## Configuration

### Environment Variables
Required in `.env` file:
```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

### IAM Permissions
The AWS user/role needs:
- `ce:GetCostAndUsage` permission
- Attach policy: `CostExplorerReadOnlyAccess` or custom inline policy

## Usage

### Automatic Integration
The AWS data is automatically fetched when calling:
```typescript
const summary = await getTtsUsageSummary({ rangeDays: 30 });
// summary.awsData contains AWS Cost Explorer data (if available)
```

### Manual Usage
You can also use the wrapper directly:
```typescript
import { awsCostExplorer } from '@/server/aws-cost-explorer';

// Last 30 days
const data = await awsCostExplorer.getPollyUsageForLastDays(30);

// Current month
const monthData = await awsCostExplorer.getPollyUsageForCurrentMonth();

// Custom date range
const customData = await awsCostExplorer.getPollyUsage(startDate, endDate);
```

## Data Flow

```
User visits TTS Dashboard
         ↓
Client calls getTtsUsageSummary()
         ↓
Server fetches:
  1. Internal tracking data (MongoDB) → All providers, real-time
  2. AWS Cost Explorer data → Polly only, 24-48h delay
         ↓
Client receives combined data
         ↓
Dashboard displays:
  - Total usage (all providers, internal tracking)
  - AWS Polly section (AWS data vs internal comparison)
  - Provider breakdown (internal tracking)
  - Cache performance (internal tracking)
```

## Important Notes

1. **AWS Data Delay**: Cost Explorer has 24-48 hour delay. Latest data is from 1-2 days ago.
2. **Polly Only**: AWS Cost Explorer ONLY tracks Amazon Polly. Google TTS and ElevenLabs must use internal tracking.
3. **Non-blocking**: If AWS credentials are missing or AWS API fails, the dashboard still works with internal tracking.
4. **Cost Comparison**: The dashboard shows both AWS actual cost and internal estimated cost for Polly, helping validate tracking accuracy.
5. **Real-time tracking still needed**: AWS data cannot be used for rate limiting due to delay. Internal tracking remains essential for real-time decisions.
6. **⚠️ Billing Validation Critical**: AWS Cost Explorer revealed a 68% discrepancy in Long-Form voice billing. See `AWS_POLLY_BILLING_CRITICAL_FINDINGS.md` for details.

## Billing Discovery & Fix

### Critical Finding (November 2025)
AWS Cost Explorer integration revealed a **68% discrepancy** between internal tracking and actual AWS billing for Long-Form voices.

**Root Cause**: AWS counts SSML `<mark>` attribute names as billable characters for Long-Form voices, despite documentation stating "SSML tags are not counted."

**Impact**: 
- Internal tracking: ~99,600 characters
- AWS actual billing: ~168,000 characters
- Unexpected charge: $15.66

**Resolution**: Updated `pollyTtsAdapter.ts` to correctly calculate billable characters for Long-Form voices.

See `AWS_POLLY_BILLING_CRITICAL_FINDINGS.md` for complete analysis.

## Future Enhancements

Potential improvements:
- [ ] Add AWS cost alerts when exceeding thresholds
- [ ] Historical cost trends and predictions
- [ ] Export AWS data to CSV/reports
- [x] ~~Auto-reconciliation of internal vs AWS costs~~ (Implemented via dashboard comparison)
- [ ] Multi-region AWS cost aggregation (if needed)

## Testing

Test script was used during development (`test-aws-cost-explorer.js`) to verify AWS API integration.
The script has been removed after successful integration into the main codebase.

## Files Modified/Created

### Created:
- `src/server/aws-cost-explorer/index.ts` - AWS wrapper

### Modified:
- `src/apis/ttsUsage/types.ts` - Added AWS data types
- `src/server/tts-usage-monitoring/index.ts` - Integrated AWS fetching
- `src/client/routes/TtsUsage/TtsUsage.tsx` - Added AWS data display
- `package.json` - Added `@aws-sdk/client-cost-explorer` dependency

---

**Status**: ✅ Complete and tested
**Checks**: All TypeScript and ESLint checks passing

