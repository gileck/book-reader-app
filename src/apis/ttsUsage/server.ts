import { API_GET_TTS_USAGE_SUMMARY, API_GET_TTS_USAGE_RECORDS, API_GET_TTS_ERROR_SUMMARY, API_GET_TTS_ERROR_RECORDS } from './index';
import { getTtsUsageSummary, getRecentTtsUsageRecords, getTtsErrorSummary } from '../../server/tts-usage-monitoring';
import type { GetTtsUsageSummaryResponse, GetTtsUsageRecordsResponse, GetTtsErrorSummaryResponse, GetTtsErrorRecordsResponse, TtsUsageRecord, TtsErrorRecord, TtsUsageRangeParams, TtsErrorRangeParams, TtsRecordsParams } from './types';

export async function getTtsUsageSummaryHandler(params?: TtsUsageRangeParams): Promise<GetTtsUsageSummaryResponse> {
  try {
    const summary = await getTtsUsageSummary(params);
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

export async function getTtsUsageRecordsHandler(params?: TtsRecordsParams): Promise<GetTtsUsageRecordsResponse> {
  try {
    const mongoRecords = await getRecentTtsUsageRecords(params);

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
      endpoint: record.endpoint,
      fromCache: record.fromCache
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

export async function getTtsErrorSummaryHandler(params?: TtsErrorRangeParams): Promise<GetTtsErrorSummaryResponse> {
  try {
    const summary = await getTtsErrorSummary(params);
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
    // We no longer expose a heavy error-records list unless needed; keep current behavior minimal
    const { getAllTtsErrorRecords } = await import('../../server/tts-usage-monitoring');
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
  [API_GET_TTS_USAGE_SUMMARY]: { process: async (params: TtsUsageRangeParams) => await getTtsUsageSummaryHandler(params) },
  [API_GET_TTS_USAGE_RECORDS]: { process: async (params: TtsRecordsParams) => await getTtsUsageRecordsHandler(params) },
  [API_GET_TTS_ERROR_SUMMARY]: { process: async (params: TtsErrorRangeParams) => await getTtsErrorSummaryHandler(params) },
  [API_GET_TTS_ERROR_RECORDS]: { process: async () => await getTtsErrorRecordsHandler() }
}; 