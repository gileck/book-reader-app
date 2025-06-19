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