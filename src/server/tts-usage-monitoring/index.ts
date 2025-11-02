import { v4 as uuidv4 } from 'uuid';
import { ttsUsage, ttsErrors } from '../database/collections';
import type { TtsUsageSummary, TtsErrorSummary, TtsUsageRangeParams, TtsErrorRangeParams, FreeTierMonthUsage, TtsRecordsParams } from '../../apis/ttsUsage/types';
import { type TtsProvider } from '../../common/tts/ttsUtils';
import { awsCostExplorer } from '../aws-cost-explorer';

// Helper function to determine voice type from voiceId
function getVoiceType(voiceId: string, provider: TtsProvider): 'standard' | 'neural' | 'long-form' | 'generative' {
  if (provider === 'polly') {
    const longFormVoices = ['Danielle', 'Gregory', 'Burrow'];
    const neuralVoices = ['Emma', 'Olivia', 'Aria', 'Ayanda', 'Ivy'];
    const standardVoices = ['Joanna', 'Matthew', 'Amy', 'Brian', 'Joey', 'Justin', 'Kendra', 'Kimberly', 'Salli', 'Kevin', 'Stephen'];

    if (longFormVoices.includes(voiceId)) return 'long-form';
    if (neuralVoices.includes(voiceId)) return 'neural';
    if (standardVoices.includes(voiceId)) return 'standard';
    
    // Log unknown voice to help identify classification issues
    console.warn(`⚠️ Unknown Polly voice: "${voiceId}" - defaulting to 'standard'. This may cause discrepancy with AWS billing.`);
  } else if (provider === 'google') {
    // Google voices - all Neural2 voices are neural tier
    if (voiceId.includes('Neural2')) return 'neural';
  }

  return 'standard'; // fallback
}

export const addTtsUsageRecord = async (
  provider: TtsProvider,
  voiceId: string,
  textLength: number,
  audioLength: number,
  cost: number,
  endpoint: string = 'unknown',
  voiceType?: 'standard' | 'neural' | 'long-form' | 'generative',
  userId?: string,
  fromCache?: boolean
): Promise<ttsUsage.TtsUsageRecord> => {
  try {
    const recordData: ttsUsage.TtsUsageRecordCreate = {
      id: uuidv4(),
      timestamp: new Date(),
      provider,
      voiceId,
      voiceType: voiceType || getVoiceType(voiceId, provider),
      textLength,
      audioLength,
      cost,
      endpoint,
      userId,
      fromCache
    };

    const record = await ttsUsage.createTtsUsageRecord(recordData);
    console.log(`TTS usage record saved: ${record.id} (fromCache: ${fromCache ?? 'undefined'})`);
    return record;
  } catch (error) {
    console.error('Error saving TTS usage record:', error);
    throw error;
  }
};

export const addTtsErrorRecord = async (
  provider: TtsProvider,
  voiceId: string,
  textLength: number,
  errorCode: string,
  errorMessage: string,
  originalError?: string,
  userId?: string,
  endpoint: string = 'unknown'
): Promise<ttsErrors.TtsErrorRecord> => {
  try {
    const recordData: ttsErrors.TtsErrorRecordCreate = {
      id: uuidv4(),
      timestamp: new Date(),
      provider,
      voiceId,
      textLength,
      errorCode,
      errorMessage,
      originalError,
      userId,
      endpoint
    };

    const record = await ttsErrors.createTtsErrorRecord(recordData);
    console.log(`TTS error record saved: ${record.id}`);
    return record;
  } catch (error) {
    console.error('Error saving TTS error record:', error);
    throw error;
  }
};

export const getAllTtsUsageRecords = async (): Promise<ttsUsage.TtsUsageRecord[]> => {
  try {
    console.log('Fetching TTS usage records from MongoDB...');
    const records = await ttsUsage.getAllTtsUsageRecords();
    console.log(`Retrieved ${records.length} TTS usage records`);
    return records;
  } catch (error) {
    console.error('Error retrieving TTS usage records:', error);
    return [];
  }
};

export const getAllTtsErrorRecords = async (): Promise<ttsErrors.TtsErrorRecord[]> => {
  try {
    console.log('Fetching TTS error records from MongoDB...');
    const records = await ttsErrors.getAllTtsErrorRecords();
    console.log(`Retrieved ${records.length} TTS error records`);
    return records;
  } catch (error) {
    console.error('Error retrieving TTS error records:', error);
    return [];
  }
};

function getDateRangeForDays(rangeDays: 30 | 60 | 90 | 'current-month' | 'previous-month'): { start: Date; end: Date } {
  if (rangeDays === 'current-month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date();
    return { start, end };
  } else if (rangeDays === 'previous-month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end };
  } else {
    const end = new Date();
    const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    return { start, end };
  }
}

async function getUsageRecordsForRange(rangeDays: 30 | 60 | 90 | 'current-month' | 'previous-month'): Promise<ttsUsage.TtsUsageRecord[]> {
  const { start, end } = getDateRangeForDays(rangeDays);
  return await ttsUsage.getTtsUsageRecordsByDateRange(start, end);
}

async function getErrorRecordsForRange(rangeDays: 30 | 60 | 90 | 'current-month' | 'previous-month'): Promise<ttsErrors.TtsErrorRecord[]> {
  const { start, end } = getDateRangeForDays(rangeDays);
  return await ttsErrors.getTtsErrorRecordsByDateRange(start, end);
}

function getCurrentMonthBounds(): { start: Date; end: Date; monthKey: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return { start, end, monthKey };
}

async function getFreeTierMonthUsage(rangeDays: 30 | 60 | 90 | 'current-month' | 'previous-month'): Promise<FreeTierMonthUsage> {
  // Determine which month to show based on range
  let start: Date;
  let end: Date;
  
  if (rangeDays === 'current-month') {
    // Current month from 1st to today
    const now = new Date();
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    end = new Date();
  } else if (rangeDays === 'previous-month') {
    // Previous month from 1st to last day
    const now = new Date();
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  } else {
    // For day-based ranges, show current month for comparison
    const bounds = getCurrentMonthBounds();
    start = bounds.start;
    end = bounds.end;
  }
  
  const monthRecords = await ttsUsage.getTtsUsageRecordsByDateRange(start, end);

  const polly = { standard: 0, neural: 0, longform: 0 };
  const google = { standard: 0, neural2: 0 };
  const elevenlabs = { total: 0 };

  monthRecords.forEach((record) => {
    if (record.provider === 'polly') {
      if (record.voiceType === 'neural') polly.neural += record.textLength;
      else if (record.voiceType === 'long-form') polly.longform += record.textLength;
      else polly.standard += record.textLength;
    } else if (record.provider === 'google') {
      if (record.voiceType === 'standard') google.standard += record.textLength;
      else google.neural2 += record.textLength;
    } else if (record.provider === 'elevenlabs') {
      elevenlabs.total += record.textLength;
    }
  });

  return { polly, google, elevenlabs };
}

export const getTtsUsageSummary = async (params?: TtsUsageRangeParams): Promise<TtsUsageSummary> => {
  const rangeDays = (params?.rangeDays ?? 30);
  
  // Calculate date range based on the range type
  let startDate: Date;
  let endDate: Date;
  let numDaysForAws: number;
  
  if (rangeDays === 'current-month') {
    // Current month from 1st to today
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date();
    numDaysForAws = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  } else if (rangeDays === 'previous-month') {
    // Previous month from 1st to last day
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 1);
    numDaysForAws = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    // Number of days from today
    endDate = new Date();
    startDate = new Date();
    startDate.setDate(startDate.getDate() - (rangeDays as number));
    numDaysForAws = rangeDays as number;
  }
  
  const records = await getUsageRecordsForRange(rangeDays);

  const summary: TtsUsageSummary = {
    totalCost: 0,
    totalCalls: 0,
    totalTextLength: 0,
    totalAudioLength: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
    cacheHitRatio: 0,
    costSavingsFromCache: 0,
    usageByProvider: {},
    usageByDay: {},
    freeTierMonthUsage: { polly: { standard: 0, neural: 0, longform: 0 }, google: { standard: 0, neural2: 0 }, elevenlabs: { total: 0 } }
  };

  records.forEach(record => {
    summary.totalCost += record.cost;
    summary.totalCalls += 1;
    summary.totalTextLength += record.textLength;
    summary.totalAudioLength += record.audioLength;

    // Track cache hits/misses - ONLY for records with explicit fromCache value
    if (record.fromCache === true) {
      summary.totalCacheHits += 1;
    } else if (record.fromCache === false) {
      summary.totalCacheMisses += 1;
    }
    // If fromCache is undefined, don't count it in cache statistics

    if (!summary.usageByProvider[record.provider]) {
      summary.usageByProvider[record.provider] = {
        totalCost: 0,
        totalCalls: 0,
        totalTextLength: 0,
        totalAudioLength: 0,
        cacheHits: 0,
        cacheMisses: 0,
        usageByVoiceType: {}
      };
    }
    const providerStats = summary.usageByProvider[record.provider];
    providerStats.totalCost += record.cost;
    providerStats.totalCalls += 1;
    providerStats.totalTextLength += record.textLength;
    providerStats.totalAudioLength += record.audioLength;

    // Only count cache stats for records with explicit fromCache value
    if (record.fromCache === true) {
      providerStats.cacheHits += 1;
    } else if (record.fromCache === false) {
      providerStats.cacheMisses += 1;
    }

    // Track usage by voice type within provider
    if (!providerStats.usageByVoiceType[record.voiceType]) {
      providerStats.usageByVoiceType[record.voiceType] = {
        totalCost: 0,
        totalCalls: 0,
        totalTextLength: 0,
        totalAudioLength: 0
      };
    }
    const voiceTypeStats = providerStats.usageByVoiceType[record.voiceType];
    voiceTypeStats.totalCost += record.cost;
    voiceTypeStats.totalCalls += 1;
    voiceTypeStats.totalTextLength += record.textLength;
    voiceTypeStats.totalAudioLength += record.audioLength;

    const day = record.timestamp.toISOString().split('T')[0];
    if (!summary.usageByDay[day]) {
      summary.usageByDay[day] = {
        totalCost: 0,
        totalCalls: 0,
        cacheHits: 0,
        cacheMisses: 0
      };
    }
    summary.usageByDay[day].totalCost += record.cost;
    summary.usageByDay[day].totalCalls += 1;

    // Only count cache stats for records with explicit fromCache value
    if (record.fromCache === true) {
      summary.usageByDay[day].cacheHits += 1;
    } else if (record.fromCache === false) {
      summary.usageByDay[day].cacheMisses += 1;
    }
  });

  // Calculate cache hit ratio - ONLY from records with explicit fromCache values
  const recordsWithCacheInfo = summary.totalCacheHits + summary.totalCacheMisses;
  if (recordsWithCacheInfo > 0) {
    summary.cacheHitRatio = (summary.totalCacheHits / recordsWithCacheInfo) * 100;
  }

  // Calculate cost savings from cache by looking at cached records and estimating their cost
  // We use the average cost per character from non-cached requests
  const cachedRecords = records.filter(r => r.fromCache === true);
  const nonCachedRecords = records.filter(r => r.fromCache === false);

  if (nonCachedRecords.length > 0 && cachedRecords.length > 0) {
    const totalNonCachedCost = nonCachedRecords.reduce((sum, r) => sum + r.cost, 0);
    const totalNonCachedChars = nonCachedRecords.reduce((sum, r) => sum + r.textLength, 0);

    if (totalNonCachedChars > 0) {
      const avgCostPerChar = totalNonCachedCost / totalNonCachedChars;
      const cachedChars = cachedRecords.reduce((sum, r) => sum + r.textLength, 0);
      summary.costSavingsFromCache = cachedChars * avgCostPerChar;
    }
  }

  // Attach monthly free-tier usage (based on selected range)
  summary.freeTierMonthUsage = await getFreeTierMonthUsage(rangeDays);

  // Fetch AWS Cost Explorer data (real AWS billing data for Polly ONLY)
  // Note: Google TTS and ElevenLabs data is NOT available from AWS Cost Explorer
  // and must continue to use our internal tracking system
  try {
    // For month-based ranges, fetch that specific month's data
    // For day-based ranges, fetch current month for free-tier comparison
    const shouldFetchCurrentMonth = typeof rangeDays === 'number';
    
    const [rangeData, freeTierMonthData] = await Promise.all([
      // Fetch range data based on selection
      rangeDays === 'current-month' || rangeDays === 'previous-month'
        ? awsCostExplorer.getPollyUsage(startDate, endDate)
        : awsCostExplorer.getPollyUsageForLastDays(numDaysForAws),
      // Fetch appropriate month for free-tier:
      // - If viewing specific month, use range data's free-tier
      // - If viewing days range, fetch current month for comparison
      shouldFetchCurrentMonth 
        ? awsCostExplorer.getPollyUsageForCurrentMonth()
        : Promise.resolve(null) // Will use rangeData's free-tier instead
    ]);
    
    // Use range data and determine which free-tier to show
    summary.awsData = {
      ...rangeData,
      // For month ranges, use the range's own free-tier data
      // For day ranges, use current month's free-tier
      currentMonthFreeTier: shouldFetchCurrentMonth 
        ? freeTierMonthData?.currentMonthFreeTier 
        : rangeData.currentMonthFreeTier
    };
  } catch (error) {
    console.error('Error fetching AWS Cost Explorer data:', error);
    // Don't fail the entire request if AWS data is unavailable
    summary.awsData = {
      totalCharacters: 0,
      totalCost: 0,
      usageByDay: {},
      periodStart: startDate.toISOString().split('T')[0],
      periodEnd: endDate.toISOString().split('T')[0],
      dataAvailable: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  return summary;
};

export const getTtsErrorSummary = async (params?: TtsErrorRangeParams): Promise<TtsErrorSummary> => {
  const rangeDays = (params?.rangeDays ?? 30) as 30 | 60 | 90;
  const records = await getErrorRecordsForRange(rangeDays);

  const summary: TtsErrorSummary = {
    totalErrors: records.length,
    errorsByProvider: {},
    errorsByDay: {},
    recentErrors: records.slice(0, 10).map(record => ({
      id: record.id,
      timestamp: record.timestamp.toISOString(),
      provider: record.provider,
      voiceId: record.voiceId,
      textLength: record.textLength,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      originalError: record.originalError,
      userId: record.userId,
      endpoint: record.endpoint
    }))
  };

  records.forEach(record => {
    // Provider-level error tracking
    if (!summary.errorsByProvider[record.provider]) {
      summary.errorsByProvider[record.provider] = {
        totalErrors: 0,
        errorsByCode: {}
      };
    }
    const providerStats = summary.errorsByProvider[record.provider];
    providerStats.totalErrors += 1;

    // Error code tracking within provider
    if (!providerStats.errorsByCode[record.errorCode]) {
      providerStats.errorsByCode[record.errorCode] = {
        count: 0,
        latestError: '',
        latestTimestamp: ''
      };
    }
    const errorCodeStats = providerStats.errorsByCode[record.errorCode];
    errorCodeStats.count += 1;
    const recordTimestamp = record.timestamp.toISOString();
    if (!errorCodeStats.latestTimestamp || recordTimestamp > errorCodeStats.latestTimestamp) {
      errorCodeStats.latestError = record.errorMessage;
      errorCodeStats.latestTimestamp = recordTimestamp;
    }

    // Daily error tracking
    const day = record.timestamp.toISOString().split('T')[0];
    if (!summary.errorsByDay[day]) {
      summary.errorsByDay[day] = {
        totalErrors: 0
      };
    }
    summary.errorsByDay[day].totalErrors += 1;
  });

  return summary;
};

export const getRecentTtsUsageRecords = async (params?: TtsRecordsParams): Promise<ttsUsage.TtsUsageRecord[]> => {
  const lastHours = params?.lastHours ?? 24;
  const end = new Date();
  const start = new Date(end.getTime() - lastHours * 60 * 60 * 1000);
  return await ttsUsage.getTtsUsageRecordsByDateRange(start, end);
};