import apiClient from '@/client/utils/apiClient';
import type { CacheResult } from '@/common/cache/types';
import {
  API_GET_TRANSLATION_USAGE_SUMMARY,
  API_GET_TRANSLATION_USAGE_RECORDS,
} from './index';
import {
  TranslationUsageRangeParams,
  GetTranslationUsageSummaryResponse,
  TranslationRecordsParams,
  GetTranslationUsageRecordsResponse,
} from './types';

/**
 * Get translation usage summary
 */
export async function getTranslationUsageSummary(
  params?: TranslationUsageRangeParams
): Promise<CacheResult<GetTranslationUsageSummaryResponse>> {
  return await apiClient.call<GetTranslationUsageSummaryResponse, TranslationUsageRangeParams>(
    API_GET_TRANSLATION_USAGE_SUMMARY,
    params || {}
  );
}

/**
 * Get recent translation usage records
 */
export async function getTranslationUsageRecords(
  params?: TranslationRecordsParams
): Promise<CacheResult<GetTranslationUsageRecordsResponse>> {
  return await apiClient.call<GetTranslationUsageRecordsResponse, TranslationRecordsParams>(
    API_GET_TRANSLATION_USAGE_RECORDS,
    params || {}
  );
}

