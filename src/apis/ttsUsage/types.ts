export interface TtsUsageRecord {
  id: string;
  timestamp: string;
  provider: 'google' | 'polly' | 'elevenlabs';
  voiceId: string;
  voiceType: 'standard' | 'neural' | 'long-form' | 'generative';
  textLength: number;
  audioLength: number;
  cost: number;
  endpoint: string;
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

export interface TtsUsageSummary {
  totalCost: number;
  totalCalls: number;
  totalTextLength: number;
  totalAudioLength: number;
  usageByProvider: Record<string, {
    totalCost: number;
    totalCalls: number;
    totalTextLength: number;
    totalAudioLength: number;
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
  }>;
  // Aggregated usage just for the current calendar month, used for Free Tier display/calculation
  freeTierMonthUsage: FreeTierMonthUsage;
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
export type TtsRangeDays = 30 | 60 | 90;

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
  };
  google: {
    standard: number;
    neural2: number;
  };
  elevenlabs: {
    total: number;
  };
}