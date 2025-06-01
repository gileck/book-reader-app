import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GENERATE_TTS, API_PROCESS_TEXT_CHUNKS } from './index';
import type {
    GenerateTtsPayload,
    GenerateTtsResponse,
    ProcessTextChunksPayload,
    ProcessTextChunksResponse
} from './types';

export async function generateTts(payload: GenerateTtsPayload): Promise<CacheResult<GenerateTtsResponse>> {
    return apiClient.call(API_GENERATE_TTS, payload);
}

export async function processTextChunks(payload: ProcessTextChunksPayload): Promise<CacheResult<ProcessTextChunksResponse>> {
    return apiClient.call(API_PROCESS_TEXT_CHUNKS, payload);
} 