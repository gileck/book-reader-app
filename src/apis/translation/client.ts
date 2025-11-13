import apiClient from '@/client/utils/apiClient';
import type { CacheResult } from '@/common/cache/types';
import { API_TRANSLATE_TEXT } from './index';
import { TranslateTextRequest, TranslateTextResponse } from './types';

/**
 * Translate text to target language
 */
export async function translateText(
  request: TranslateTextRequest
): Promise<CacheResult<TranslateTextResponse>> {
  return await apiClient.call<TranslateTextResponse, TranslateTextRequest>(API_TRANSLATE_TEXT, request);
}

