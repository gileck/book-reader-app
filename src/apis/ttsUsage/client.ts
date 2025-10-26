import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_TTS_USAGE_SUMMARY, API_GET_TTS_USAGE_RECORDS, API_GET_TTS_ERROR_SUMMARY, API_GET_TTS_ERROR_RECORDS } from './index';
import type {
  GetTtsUsageSummaryResponse,
  GetTtsUsageRecordsResponse,
  GetTtsErrorSummaryResponse,
  GetTtsErrorRecordsResponse,
  TtsUsageRangeParams,
  TtsErrorRangeParams,
  TtsRecordsParams
} from './types';

export async function getTtsUsageSummary(params?: TtsUsageRangeParams): Promise<CacheResult<GetTtsUsageSummaryResponse>> {
  return apiClient.call(API_GET_TTS_USAGE_SUMMARY, params ?? {});
}

export async function getTtsUsageRecords(params?: TtsRecordsParams): Promise<CacheResult<GetTtsUsageRecordsResponse>> {
  return apiClient.call(API_GET_TTS_USAGE_RECORDS, params ?? {});
}

export async function getTtsErrorSummary(params?: TtsErrorRangeParams): Promise<CacheResult<GetTtsErrorSummaryResponse>> {
  return apiClient.call(API_GET_TTS_ERROR_SUMMARY, params ?? {});
}

export async function getTtsErrorRecords(): Promise<CacheResult<GetTtsErrorRecordsResponse>> {
  return apiClient.call(API_GET_TTS_ERROR_RECORDS, {});
} 