export interface TtsUsageRecord {
  id: string;
  timestamp: string;
  provider: 'google' | 'polly' | 'elevenlabs';
  voiceId: string;
  voiceType: 'standard' | 'wavenet' | 'neural' | 'neural2' | 'polyglot' | 'studio' | 'chirp3-hd' | 'long-form' | 'generative';
  textLength: number;
  audioLength: number;
  cost: number;
  endpoint: string;
  fromCache?: boolean; // undefined for old records, true/false for new records
}

export interface TtsErrorRecord {
  id: string;
  timestamp: string;
  provider: 'google' | 'polly' | 'elevenlabs';
  voiceId: string;
  textLength: number;
  errorCode: string;
  errorMessage: string;
  originalError?: string;
  userId?: string;
  endpoint: string;
}

export interface AwsTtsData {
  totalCharacters: number;
  totalCost: number;
  usageByDay: Record<string, {
    characters: number;
    cost: number;
    usageTypes: Record<string, {
      characters: number;
      cost: number;
    }>;
  }>;
  periodStart: string;
  periodEnd: string;
  dataAvailable: boolean;
  error?: string;
  // Current month free-tier breakdown (if this is current month data)
  currentMonthFreeTier?: {
    standard: number;
    neural: number;
    longform: number;
    generative: number;
  };
}

export interface TtsUsageSummary {
  totalCost: number;
  totalCalls: number;
  totalTextLength: number;
  totalAudioLength: number;
  // Cache statistics
  totalCacheHits: number;
  totalCacheMisses: number;
  cacheHitRatio: number; // Percentage (0-100)
  costSavingsFromCache: number; // Cost that would have been incurred without cache
  usageByProvider: Record<string, {
    totalCost: number;
    totalCalls: number;
    totalTextLength: number;
    totalAudioLength: number;
    cacheHits: number;
    cacheMisses: number;
    usageByVoiceType: Record<string, {
      totalCost: number;
      totalCalls: number;
      totalTextLength: number;
      totalAudioLength: number;
    }>;
  }>;
  usageByDay: Record<string, {
    totalCost: number;
    totalCalls: number;
    cacheHits: number;
    cacheMisses: number;
  }>;
  // Aggregated usage just for the current calendar month, used for Free Tier display/calculation
  freeTierMonthUsage: FreeTierMonthUsage;
  // AWS Cost Explorer data (real AWS billing data)
  awsData?: AwsTtsData;
}

export interface TtsErrorSummary {
  totalErrors: number;
  errorsByProvider: Record<string, {
    totalErrors: number;
    errorsByCode: Record<string, {
      count: number;
      latestError: string;
      latestTimestamp: string;
    }>;
  }>;
  errorsByDay: Record<string, {
    totalErrors: number;
  }>;
  recentErrors: TtsErrorRecord[];
}

export interface GetTtsUsageSummaryResponse {
  success: boolean;
  summary?: TtsUsageSummary;
  error?: string;
}

export interface GetTtsUsageRecordsResponse {
  success: boolean;
  records?: TtsUsageRecord[];
  error?: string;
}

export interface GetTtsErrorSummaryResponse {
  success: boolean;
  summary?: TtsErrorSummary;
  error?: string;
}

export interface GetTtsErrorRecordsResponse {
  success: boolean;
  records?: TtsErrorRecord[];
  error?: string;
}

// Request params
export type TtsRangeDays = 30 | 60 | 90 | 'current-month' | 'previous-month';

export interface TtsUsageRangeParams {
  rangeDays?: TtsRangeDays;
}

export interface TtsRecordsParams {
  lastHours?: number; // default 24
}

export interface TtsErrorRangeParams {
  rangeDays?: TtsRangeDays;
}

// Free tier monthly usage structure
export interface FreeTierMonthUsage {
  polly: {
    standard: number;
    neural: number;
    longform: number;
    generative: number;
  };
  google: {
    standard: number;
    wavenet: number;
    neural2: number;
    polyglot: number;
    studio: number;
    chirp3hd: number;
  };
  elevenlabs: {
    total: number;
  };
}