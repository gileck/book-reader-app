import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { UPDATE_READING_POSITION_API_NAME, GET_READING_PROGRESS_API_NAME, GET_READING_STATS_API_NAME } from './index';
import type {
    UpdateReadingPositionRequest,
    UpdateReadingPositionResponse,
    GetReadingProgressRequest,
    GetReadingProgressResponse,
    GetReadingStatsRequest,
    GetReadingStatsResponse
} from './types';

export const updateReadingPosition = async (
    request: UpdateReadingPositionRequest
): Promise<CacheResult<UpdateReadingPositionResponse>> => {
    return apiClient.call(UPDATE_READING_POSITION_API_NAME, request);
};

export const getReadingProgress = async (
    request: GetReadingProgressRequest
): Promise<CacheResult<GetReadingProgressResponse>> => {
    return apiClient.call(GET_READING_PROGRESS_API_NAME, request);
};

export const getReadingStats = async (
    request: GetReadingStatsRequest
): Promise<CacheResult<GetReadingStatsResponse>> => {
    return apiClient.call(GET_READING_STATS_API_NAME, request);
}; 