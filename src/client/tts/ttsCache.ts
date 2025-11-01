import { generateTts } from '../../apis/tts/client';
import type { GenerateTtsPayload, GenerateTtsResponse } from '../../apis/tts/types';
import type { CacheResult } from '../../common/cache/types';
import { offlineDB } from '../offline/offlineDB';

/**
 * Simple hash function for generating cache keys
 * Reused from localStorageCache.ts
 */
const createHash = (data: string): string => {
    let hash = 0;
    if (data.length === 0) return hash.toString();

    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
};

/**
 * Generates a cache key from TTS parameters
 */
const generateCacheKey = (text: string, voiceId: string = '', provider: string = ''): string => {
    const data = `${text}:${voiceId}:${provider}`;
    return `tts_${createHash(data)}`;
};

/**
 * Wrapper around generateTts that adds transparent IndexedDB caching
 * Stores last 5 TTS responses using FIFO eviction
 * 
 * @param payload - TTS generation parameters
 * @returns Promise with TTS response and cache metadata
 */
export async function generateTtsWithCache(
    payload: GenerateTtsPayload
): Promise<CacheResult<GenerateTtsResponse>> {
    // 1. Generate cache key
    const cacheKey = generateCacheKey(
        payload.text,
        payload.voiceId || '',
        payload.provider || ''
    );

    // 2. Try IndexedDB first
    try {
        const cached = await offlineDB.getTtsCache(cacheKey);
        if (cached) {
            console.debug('TTS cache hit:', cacheKey);
            return {
                data: {
                    success: true,
                    audioContent: cached.audioContent,
                    timepoints: cached.timepoints,
                    isFromCache: true
                },
                isFromCache: true
            };
        }
    } catch (err) {
        console.error('TTS cache read failed:', err);
        // Continue to API call on cache error
    }

    // 3. Call actual API
    console.debug('TTS cache miss, fetching from API:', cacheKey);
    const result = await generateTts(payload);

    // 4. Save successful responses to cache (fire-and-forget)
    if (result.data?.success && result.data.audioContent && result.data.timepoints) {
        void offlineDB.putTtsCache({
            cacheKey,
            audioContent: result.data.audioContent,
            timepoints: result.data.timepoints,
            createdAt: Date.now()
        }).catch(err => console.error('Failed to cache TTS:', err));
    }

    return result;
}

