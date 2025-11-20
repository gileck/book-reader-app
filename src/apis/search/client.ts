import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_SEARCH_CURRENT_CHAPTER
} from './index';
import {
    SearchCurrentChapterPayload,
    SearchCurrentChapterResponse
} from './types';

export async function searchCurrentChapter(
    payload: SearchCurrentChapterPayload
): Promise<CacheResult<SearchCurrentChapterResponse>> {
    return apiClient.call(API_SEARCH_CURRENT_CHAPTER, payload);
}

