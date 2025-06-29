import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_TTS_USAGE_SUMMARY, API_GET_TTS_USAGE_RECORDS, API_GET_TTS_ERROR_SUMMARY, API_GET_TTS_ERROR_RECORDS } from './index';
import type {
  GetTtsUsageSummaryResponse,
  GetTtsUsageRecordsResponse,
  GetTtsErrorSummaryResponse,
  GetTtsErrorRecordsResponse
} from './types';

export async function getTtsUsageSummary(): Promise<CacheResult<GetTtsUsageSummaryResponse>> {
  return apiClient.call(API_GET_TTS_USAGE_SUMMARY, {});
}

export async function getTtsUsageRecords(): Promise<CacheResult<GetTtsUsageRecordsResponse>> {
  return apiClient.call(API_GET_TTS_USAGE_RECORDS, {});
}

export async function getTtsErrorSummary(): Promise<CacheResult<GetTtsErrorSummaryResponse>> {
  return apiClient.call(API_GET_TTS_ERROR_SUMMARY, {});
}

export async function getTtsErrorRecords(): Promise<CacheResult<GetTtsErrorRecordsResponse>> {
  return apiClient.call(API_GET_TTS_ERROR_RECORDS, {});
} 