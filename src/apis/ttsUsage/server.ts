import { API_GET_TTS_USAGE_SUMMARY, API_GET_TTS_USAGE_RECORDS } from './index';
import { getTtsUsageSummary, getAllTtsUsageRecords } from '../../server/tts-usage-monitoring';
import type { GetTtsUsageSummaryResponse, GetTtsUsageRecordsResponse } from './types';

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
    const records = await getAllTtsUsageRecords();
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

export const ttsUsageApiHandlers = {
  [API_GET_TTS_USAGE_SUMMARY]: { process: async () => await getTtsUsageSummaryHandler() },
  [API_GET_TTS_USAGE_RECORDS]: { process: async () => await getTtsUsageRecordsHandler() }
}; 