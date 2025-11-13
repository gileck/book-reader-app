// Translation usage tracking types

export interface TranslationUsageRecord {
  id: string;
  timestamp: string;
  textLength: number;
  cost: number;
  targetLanguage: string;
  sourceLanguage?: string;
  fromCache: boolean;
  userId?: string;
  endpoint: string;
}

export interface TranslationUsageSummary {
  totalCost: number;
  totalCalls: number;
  totalCharacters: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  cacheHitRatio: number; // Percentage (0-100)
  costSavingsFromCache: number;
  usageByLanguage: Record<
    string,
    {
      totalCost: number;
      totalCalls: number;
      totalCharacters: number;
      cacheHits: number;
      cacheMisses: number;
    }
  >;
  usageByDay: Record<
    string,
    {
      totalCost: number;
      totalCalls: number;
      totalCharacters: number;
      cacheHits: number;
      cacheMisses: number;
    }
  >;
  freeTierMonthUsage: number; // Characters used in current month (non-cached only)
}

export interface GetTranslationUsageSummaryResponse {
  success: boolean;
  summary?: TranslationUsageSummary;
  error?: string;
}

export interface GetTranslationUsageRecordsResponse {
  success: boolean;
  records?: TranslationUsageRecord[];
  error?: string;
}

// Request params
export type TranslationRangeDays = 30 | 60 | 90 | 'current-month' | 'previous-month';

export interface TranslationUsageRangeParams {
  rangeDays?: TranslationRangeDays;
}

export interface TranslationRecordsParams {
  lastHours?: number; // default 24
}

