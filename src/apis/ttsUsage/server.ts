import { API_GET_TTS_USAGE_SUMMARY, API_GET_TTS_USAGE_RECORDS, API_GET_TTS_ERROR_SUMMARY, API_GET_TTS_ERROR_RECORDS } from './index';
import { getTtsUsageSummary, getAllTtsUsageRecords, getTtsErrorSummary, getAllTtsErrorRecords } from '../../server/tts-usage-monitoring';
import type { GetTtsUsageSummaryResponse, GetTtsUsageRecordsResponse, GetTtsErrorSummaryResponse, GetTtsErrorRecordsResponse, TtsUsageRecord, TtsErrorRecord } from './types';

export async function getTtsUsageSummaryHandler(): Promise<GetTtsUsageSummaryResponse> {
  try {
    const summary = await getTtsUsageSummary();
    return {
      success: true,
      summary
    };
  } catch (error) {
    console.error('Get TTS usage summary error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function getTtsUsageRecordsHandler(): Promise<GetTtsUsageRecordsResponse> {
  try {
    const mongoRecords = await getAllTtsUsageRecords();

    // Convert MongoDB records to API format (Date -> string)
    const records: TtsUsageRecord[] = mongoRecords.map(record => ({
      id: record.id,
      timestamp: record.timestamp.toISOString(),
      provider: record.provider,
      voiceId: record.voiceId,
      voiceType: record.voiceType,
      textLength: record.textLength,
      audioLength: record.audioLength,
      cost: record.cost,
      endpoint: record.endpoint
    }));

    return {
      success: true,
      records
    };
  } catch (error) {
    console.error('Get TTS usage records error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function getTtsErrorSummaryHandler(): Promise<GetTtsErrorSummaryResponse> {
  try {
    const summary = await getTtsErrorSummary();
    return {
      success: true,
      summary
    };
  } catch (error) {
    console.error('Get TTS error summary error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export async function getTtsErrorRecordsHandler(): Promise<GetTtsErrorRecordsResponse> {
  try {
    const mongoRecords = await getAllTtsErrorRecords();

    // Convert MongoDB records to API format (Date -> string)
    const records: TtsErrorRecord[] = mongoRecords.map(record => ({
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
    }));

    return {
      success: true,
      records
    };
  } catch (error) {
    console.error('Get TTS error records error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

export const ttsUsageApiHandlers = {
  [API_GET_TTS_USAGE_SUMMARY]: { process: async () => await getTtsUsageSummaryHandler() },
  [API_GET_TTS_USAGE_RECORDS]: { process: async () => await getTtsUsageRecordsHandler() },
  [API_GET_TTS_ERROR_SUMMARY]: { process: async () => await getTtsErrorSummaryHandler() },
  [API_GET_TTS_ERROR_RECORDS]: { process: async () => await getTtsErrorRecordsHandler() }
}; 