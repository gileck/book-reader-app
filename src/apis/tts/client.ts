import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GENERATE_TTS } from './index';
import type {
    GenerateTtsPayload,
    GenerateTtsResponse
} from './types';

export async function generateTts(payload: GenerateTtsPayload): Promise<CacheResult<GenerateTtsResponse>> {
    return apiClient.call(API_GENERATE_TTS, payload);
} 