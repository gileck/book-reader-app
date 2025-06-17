import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GENERATE_TTS, API_GET_TTS_PROVIDERS, API_SET_TTS_PROVIDER } from './index';
import type {
    GenerateTtsPayload,
    GenerateTtsResponse,
    GetTtsProvidersResponse,
    SetTtsProviderPayload,
    SetTtsProviderResponse
} from './types';

export async function generateTts(payload: GenerateTtsPayload): Promise<CacheResult<GenerateTtsResponse>> {
    return apiClient.call(API_GENERATE_TTS, payload);
}

export async function getTtsProviders(): Promise<CacheResult<GetTtsProvidersResponse>> {
    return apiClient.call(API_GET_TTS_PROVIDERS, {});
}

export async function setTtsProvider(payload: SetTtsProviderPayload): Promise<CacheResult<SetTtsProviderResponse>> {
    return apiClient.call(API_SET_TTS_PROVIDER, payload);
} 