import { v4 as uuidv4 } from 'uuid';
import { ttsUsage, ttsErrors } from '../database/collections';
import type { TtsUsageSummary, TtsErrorSummary } from '../../apis/ttsUsage/types';
import { type TtsProvider } from '../../common/tts/ttsUtils';

// Helper function to determine voice type from voiceId
function getVoiceType(voiceId: string, provider: TtsProvider): 'standard' | 'neural' | 'long-form' | 'generative' {
  if (provider === 'polly') {
    const longFormVoices = ['Danielle', 'Gregory', 'Burrow'];
    const neuralVoices = ['Emma', 'Olivia', 'Aria', 'Ayanda', 'Ivy'];
    const standardVoices = ['Joanna', 'Matthew', 'Amy', 'Brian', 'Joey', 'Justin', 'Kendra', 'Kimberly', 'Salli', 'Kevin', 'Stephen'];

    if (longFormVoices.includes(voiceId)) return 'long-form';
    if (neuralVoices.includes(voiceId)) return 'neural';
    if (standardVoices.includes(voiceId)) return 'standard';
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
  userId?: string
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
      userId
    };

    const record = await ttsUsage.createTtsUsageRecord(recordData);
    console.log(`TTS usage record saved: ${record.id}`);
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

export const getTtsUsageSummary = async (): Promise<TtsUsageSummary> => {
  const records = await getAllTtsUsageRecords();

  const summary: TtsUsageSummary = {
    totalCost: 0,
    totalCalls: 0,
    totalTextLength: 0,
    totalAudioLength: 0,
    usageByProvider: {},
    usageByDay: {}
  };

  records.forEach(record => {
    summary.totalCost += record.cost;
    summary.totalCalls += 1;
    summary.totalTextLength += record.textLength;
    summary.totalAudioLength += record.audioLength;

    if (!summary.usageByProvider[record.provider]) {
      summary.usageByProvider[record.provider] = {
        totalCost: 0,
        totalCalls: 0,
        totalTextLength: 0,
        totalAudioLength: 0,
        usageByVoiceType: {}
      };
    }
    const providerStats = summary.usageByProvider[record.provider];
    providerStats.totalCost += record.cost;
    providerStats.totalCalls += 1;
    providerStats.totalTextLength += record.textLength;
    providerStats.totalAudioLength += record.audioLength;

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
        totalCalls: 0
      };
    }
    summary.usageByDay[day].totalCost += record.cost;
    summary.usageByDay[day].totalCalls += 1;
  });

  return summary;
};

export const getTtsErrorSummary = async (): Promise<TtsErrorSummary> => {
  const records = await getAllTtsErrorRecords();

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