import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { CREATE_READING_LOG_API_NAME, GET_READING_SESSIONS_API_NAME } from './index';
import type {
    CreateReadingLogRequest,
    CreateReadingLogResponse,
    GetReadingSessionsRequest,
    GetReadingSessionsResponse
} from './types';

export const createReadingLog = async (
    request: CreateReadingLogRequest
): Promise<CacheResult<CreateReadingLogResponse>> => {
    return apiClient.call(CREATE_READING_LOG_API_NAME, request);
};

export const getReadingSessions = async (
    request: GetReadingSessionsRequest
): Promise<CacheResult<GetReadingSessionsResponse>> => {
    return apiClient.call(GET_READING_SESSIONS_API_NAME, request);
}; 