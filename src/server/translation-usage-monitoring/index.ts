import { v4 as uuidv4 } from 'uuid';
import * as translationUsage from '../database/collections/translationUsage';
import type { TranslationUsageRecord, TranslationUsageRecordCreate } from '../database/collections/translationUsage/types';
import type { TranslationUsageSummary } from '@/apis/translationUsage/types';

// Free tier limits: 500,000 characters per month
export const FREE_TIER_LIMIT = 500000;
const COST_PER_CHAR = 20 / 1000000; // $20 per 1 million characters

/**
 * Add a translation usage record
 */
export async function addTranslationUsageRecord(
  textLength: number,
  cost: number,
  targetLanguage: string,
  sourceLanguage: string | undefined,
  userId: string | undefined,
  fromCache: boolean,
  endpoint: string = 'translation-api'
): Promise<TranslationUsageRecord> {
  try {
    const recordData: TranslationUsageRecordCreate = {
      id: uuidv4(),
      timestamp: new Date(),
      textLength,
      cost,
      targetLanguage,
      sourceLanguage,
      userId,
      fromCache,
      endpoint,
    };

    const record = await translationUsage.createTranslationUsageRecord(recordData);
    console.log(
      `Translation usage record saved: ${record.id} (fromCache: ${fromCache}, language: ${targetLanguage}, chars: ${textLength})`
    );
    return record;
  } catch (error) {
    console.error('Error saving translation usage record:', error);
    throw error;
  }
}

/**
 * Get translation usage summary
 */
export async function getTranslationUsageSummary(params?: {
  rangeDays?: number | 'current-month' | 'previous-month';
}): Promise<TranslationUsageSummary> {
  const rangeDays = params?.rangeDays ?? 30;

  let startDate: Date;
  let endDate: Date = new Date();

  if (rangeDays === 'current-month') {
    // Start of current month
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  } else if (rangeDays === 'previous-month') {
    // Previous month
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0); // Last day of previous month
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); // First day of previous month
  } else {
    startDate = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  }

  const records = await translationUsage.getTranslationUsageRecords(startDate, endDate);

  // Build summary
  const summary: TranslationUsageSummary = {
    totalCost: 0,
    totalCalls: 0,
    totalCharacters: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
    cacheHitRatio: 0,
    costSavingsFromCache: 0,
    usageByLanguage: {},
    usageByDay: {},
    freeTierMonthUsage: 0,
  };

  // Calculate current month usage for free tier
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const currentMonthRecords = await translationUsage.getTranslationUsageRecords(
    currentMonthStart,
    new Date()
  );

  summary.freeTierMonthUsage = currentMonthRecords.reduce(
    (sum, record) => sum + (record.fromCache ? 0 : record.textLength),
    0
  );

  // Process all records to gather statistics
  records.forEach(record => {
    summary.totalCalls += 1;
    summary.totalCharacters += record.textLength;

    // Track cache hits/misses
    if (record.fromCache === true) {
      summary.totalCacheHits += 1;
    } else if (record.fromCache === false) {
      summary.totalCacheMisses += 1;
    }

    // Calculate cost savings from cache
    if (record.fromCache) {
      summary.costSavingsFromCache += record.cost;
    }

    // Usage by language
    if (!summary.usageByLanguage[record.targetLanguage]) {
      summary.usageByLanguage[record.targetLanguage] = {
        totalCost: 0,
        totalCalls: 0,
        totalCharacters: 0,
        cacheHits: 0,
        cacheMisses: 0,
      };
    }
    const langStats = summary.usageByLanguage[record.targetLanguage];
    langStats.totalCost += 0; // Will calculate actual cost after processing all records
    langStats.totalCalls += 1;
    langStats.totalCharacters += record.textLength;
    if (record.fromCache === true) {
      langStats.cacheHits += 1;
    } else if (record.fromCache === false) {
      langStats.cacheMisses += 1;
    }

    // Usage by day
    const day = record.timestamp.toISOString().split('T')[0];
    if (!summary.usageByDay[day]) {
      summary.usageByDay[day] = {
        totalCost: 0,
        totalCalls: 0,
        totalCharacters: 0,
        cacheHits: 0,
        cacheMisses: 0,
      };
    }
    const dayStats = summary.usageByDay[day];
    dayStats.totalCost += 0; // Will calculate actual cost after processing all records
    dayStats.totalCalls += 1;
    dayStats.totalCharacters += record.textLength;
    if (record.fromCache === true) {
      dayStats.cacheHits += 1;
    } else if (record.fromCache === false) {
      dayStats.cacheMisses += 1;
    }
  });

  // Calculate cache hit ratio
  const totalCacheOps = summary.totalCacheHits + summary.totalCacheMisses;
  summary.cacheHitRatio = totalCacheOps > 0 ? (summary.totalCacheHits / totalCacheOps) * 100 : 0;

  /**
   * Calculate total billable cost with proper free tier handling
   * 
   * Algorithm:
   * 1. For current month: Calculate total non-cached characters used
   * 2. Only charge for characters BEYOND the 500k free tier (e.g., if 600k used, charge for 100k)
   * 3. For historical months: Use pre-stored costs (already calculated with their month's free tier)
   * 4. Distribute current month billable cost proportionally across languages and days
   * 
   * Example: If current month has 600k chars used across 6 translations of 100k each:
   * - Free tier covers first 500k (5 translations = $0)
   * - Last 100k is billable = 100k * $0.00002 = $2.00
   * - Each translation gets: (100k/600k) * $2.00 = $0.33 cost attribution
   */
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Separate current month and historical records
  const currentMonthRecordsInRange = records.filter(record => {
    const recordDate = new Date(record.timestamp);
    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
  });

  const historicalRecordsInRange = records.filter(record => {
    const recordDate = new Date(record.timestamp);
    return recordDate.getMonth() !== currentMonth || recordDate.getFullYear() !== currentYear;
  });

  // For current month: calculate billable characters (beyond free tier)
  const currentMonthBillableChars = Math.max(0, summary.freeTierMonthUsage - FREE_TIER_LIMIT);
  const currentMonthBillableCost = currentMonthBillableChars * COST_PER_CHAR;
  summary.totalCost = currentMonthBillableCost;

  // Add historical costs (already stored with their own month's free tier calculations)
  historicalRecordsInRange.forEach(record => {
    if (!record.fromCache) {
      summary.totalCost += record.cost;
    }
  });

  // Distribute costs proportionally to languages and days for current month
  if (currentMonthBillableChars > 0) {
    // Calculate proportion of billable chars for each language/day
    let currentMonthNonCachedChars = 0;
    currentMonthRecordsInRange.forEach(record => {
      if (!record.fromCache) {
        currentMonthNonCachedChars += record.textLength;
      }
    });

    // Distribute cost proportionally
    currentMonthRecordsInRange.forEach(record => {
      if (!record.fromCache && currentMonthNonCachedChars > 0) {
        const proportion = record.textLength / currentMonthNonCachedChars;
        const recordCost = currentMonthBillableCost * proportion;

        // Add to language stats
        if (summary.usageByLanguage[record.targetLanguage]) {
          summary.usageByLanguage[record.targetLanguage].totalCost += recordCost;
        }

        // Add to day stats
        const day = record.timestamp.toISOString().split('T')[0];
        if (summary.usageByDay[day]) {
          summary.usageByDay[day].totalCost += recordCost;
        }
      }
    });
  }

  // Add historical costs to language and day stats
  historicalRecordsInRange.forEach(record => {
    if (!record.fromCache) {
      // Add to language stats
      if (summary.usageByLanguage[record.targetLanguage]) {
        summary.usageByLanguage[record.targetLanguage].totalCost += record.cost;
      }

      // Add to day stats
      const day = record.timestamp.toISOString().split('T')[0];
      if (summary.usageByDay[day]) {
        summary.usageByDay[day].totalCost += record.cost;
      }
    }
  });

  return summary;
}

/**
 * Get current month's free tier usage
 */
export async function getMonthlyFreeTierUsage(): Promise<{
  used: number;
  total: number;
  remaining: number;
  percentUsed: number;
}> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const records = await translationUsage.getTranslationUsageRecords(currentMonthStart, now);

  let currentMonthChars = 0;
  records.forEach(record => {
    if (!record.fromCache) { // Only count non-cached usage towards free tier
      currentMonthChars += record.textLength;
    }
  });

  return {
    used: currentMonthChars,
    total: FREE_TIER_LIMIT,
    remaining: Math.max(0, FREE_TIER_LIMIT - currentMonthChars),
    percentUsed: (currentMonthChars / FREE_TIER_LIMIT) * 100,
  };
}


