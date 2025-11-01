import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GENERATE_CHAPTER_OVERVIEW, API_ESTIMATE_CHAPTER_OVERVIEW_COST } from './index';
import { ChapterOverviewRequest, ChapterOverviewResponse, ChapterOverviewCostEstimateRequest, ChapterOverviewCostEstimateResponse } from './types';

export async function generateChapterOverview(payload: ChapterOverviewRequest): Promise<CacheResult<ChapterOverviewResponse>> {
    return apiClient.call(API_GENERATE_CHAPTER_OVERVIEW, payload);
}

export async function estimateChapterOverviewCost(payload: ChapterOverviewCostEstimateRequest): Promise<CacheResult<ChapterOverviewCostEstimateResponse>> {
    return apiClient.call(API_ESTIMATE_CHAPTER_OVERVIEW_COST, payload);
}

