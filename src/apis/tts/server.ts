export * from './index';

import {
    API_GENERATE_TTS,
    API_GET_TTS_PROVIDERS,
    API_SET_TTS_PROVIDER
} from './index';

import { 
    synthesizeSpeechWithTiming, 
    getAvailableTtsProviders, 
    setTtsProvider, 
    getCurrentTtsProvider 
} from '../../server/tts/ttsService';
import type {
    GenerateTtsPayload,
    GenerateTtsResponse,
    GetTtsProvidersResponse,
    SetTtsProviderPayload,
    SetTtsProviderResponse
} from './types';

import { process as generateTtsProcess } from './handlers/generateTtsHandler';

export async function generateTts(payload: GenerateTtsPayload): Promise<GenerateTtsResponse> {
    try {
        const { text, voiceId = 'en-US-Neural2-F', provider } = payload;

        if (!text?.trim()) {
            return {
                success: false,
                error: 'Text is required'
            };
        }

        const result = await synthesizeSpeechWithTiming(text, voiceId, provider);

        if (!result) {
            return {
                success: false,
                error: 'Failed to generate speech'
            };
        }

        return {
            success: true,
            audioContent: result.audioContent,
            timepoints: result.timepoints
        };
    } catch (error) {
        console.error('Generate TTS error:', error);
        return {
            success: false,
            error: 'Internal server error'
        };
    }
}

export async function getTtsProviders(): Promise<GetTtsProvidersResponse> {
    try {
        const providers = await getAvailableTtsProviders();
        const currentProvider = getCurrentTtsProvider();

        return {
            success: true,
            providers,
            currentProvider
        };
    } catch (error) {
        console.error('Get TTS providers error:', error);
        return {
            success: false,
            error: 'Internal server error'
        };
    }
}

export async function setTtsProviderHandler(payload: SetTtsProviderPayload): Promise<SetTtsProviderResponse> {
    try {
        const { provider } = payload;
        
        if (!provider) {
            return {
                success: false,
                error: 'Provider is required'
            };
        }

        setTtsProvider(provider);

        return {
            success: true
        };
    } catch (error) {
        console.error('Set TTS provider error:', error);
        return {
            success: false,
            error: 'Internal server error'
        };
    }
}

// processTextChunks removed - text chunking happens during PDF import, not at runtime

export const ttsApiHandlers = {
    [API_GENERATE_TTS]: { process: generateTtsProcess },
    [API_GET_TTS_PROVIDERS]: { process: async () => await getTtsProviders() },
    [API_SET_TTS_PROVIDER]: { process: async (params: SetTtsProviderPayload) => await setTtsProviderHandler(params) }
}; 