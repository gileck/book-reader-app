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
import { addTtsErrorRecord } from '../../server/tts-usage-monitoring';
import type {
    GenerateTtsPayload,
    GenerateTtsResponse,
    GetTtsProvidersResponse,
    SetTtsProviderPayload,
    SetTtsProviderResponse,
    TtsErrorDetail
} from './types';

import { process as generateTtsProcess } from './handlers/generateTtsHandler';

// Helper function to classify TTS errors
function classifyTtsError(error: unknown, provider: string): { code: string; message: string; originalError: string } {
    const errorStr = error instanceof Error ? error.message : String(error);
    const lowerError = errorStr.toLowerCase();

    // API Key related errors
    if (lowerError.includes('api key') || lowerError.includes('apikey') || lowerError.includes('unauthorized') ||
        lowerError.includes('credentials') || lowerError.includes('authentication') || lowerError.includes('invalid key')) {
        return {
            code: 'AUTH_ERROR',
            message: `${provider} API key is missing, invalid, or unauthorized. Please check your API credentials.`,
            originalError: errorStr
        };
    }

    // Rate limiting errors
    if (lowerError.includes('rate limit') || lowerError.includes('too many requests') ||
        lowerError.includes('quota') || lowerError.includes('throttl')) {
        return {
            code: 'RATE_LIMIT_ERROR',
            message: `${provider} API rate limit exceeded. Please try again later.`,
            originalError: errorStr
        };
    }

    // Network/connectivity errors
    if (lowerError.includes('network') || lowerError.includes('connection') || lowerError.includes('timeout') ||
        lowerError.includes('dns') || lowerError.includes('econnrefused') || lowerError.includes('enotfound')) {
        return {
            code: 'NETWORK_ERROR',
            message: `Network connectivity issue when connecting to ${provider}. Please check your internet connection.`,
            originalError: errorStr
        };
    }

    // Service unavailable errors
    if (lowerError.includes('service unavailable') || lowerError.includes('503') ||
        lowerError.includes('502') || lowerError.includes('internal server error')) {
        return {
            code: 'SERVICE_UNAVAILABLE',
            message: `${provider} service is temporarily unavailable. Please try again later.`,
            originalError: errorStr
        };
    }

    // Voice/provider specific errors
    if (lowerError.includes('voice') && (lowerError.includes('not found') || lowerError.includes('invalid'))) {
        return {
            code: 'INVALID_VOICE',
            message: `The selected voice is not available for ${provider}. Please select a different voice.`,
            originalError: errorStr
        };
    }

    // Text content errors
    if (lowerError.includes('text too long') || lowerError.includes('maximum length') ||
        lowerError.includes('character limit')) {
        return {
            code: 'TEXT_TOO_LONG',
            message: `Text content exceeds the maximum length allowed by ${provider}.`,
            originalError: errorStr
        };
    }

    // Client initialization errors
    if (lowerError.includes('failed to initialize') || lowerError.includes('client') ||
        lowerError.includes('credentials not found')) {
        return {
            code: 'INIT_ERROR',
            message: `Failed to initialize ${provider} TTS client. Please check your configuration.`,
            originalError: errorStr
        };
    }

    // Default to generic error
    return {
        code: 'UNKNOWN_ERROR',
        message: `An unexpected error occurred with ${provider} TTS service: ${errorStr}`,
        originalError: errorStr
    };
}

export async function generateTts(payload: GenerateTtsPayload): Promise<GenerateTtsResponse> {
    const { text, voiceId = 'en-US-Neural2-F', provider } = payload;

    try {
        if (!text?.trim()) {
            const errorDetail: TtsErrorDetail = {
                code: 'VALIDATION_ERROR',
                message: 'Text is required for TTS generation',
                provider,
                voiceId,
                textLength: 0,
                timestamp: new Date().toISOString()
            };

            // Track validation error
            await addTtsErrorRecord(
                (provider || 'google') as 'google' | 'polly' | 'elevenlabs',
                voiceId,
                0,
                errorDetail.code,
                errorDetail.message,
                'Empty text provided',
                undefined,
                'tts-api'
            ).catch(err => console.error('Error tracking TTS error:', err));

            return {
                success: false,
                error: 'Text is required',
                errorDetail
            };
        }

        const result = await synthesizeSpeechWithTiming(text, voiceId, provider);

        if (!result) {
            const currentProvider = provider || getCurrentTtsProvider();
            const errorDetail: TtsErrorDetail = {
                code: 'GENERATION_FAILED',
                message: `Failed to generate speech using ${currentProvider}. The TTS service may be unavailable or misconfigured.`,
                provider: currentProvider,
                voiceId,
                textLength: text.length,
                timestamp: new Date().toISOString()
            };

            // Track generation failure
            await addTtsErrorRecord(
                currentProvider,
                voiceId,
                text.length,
                errorDetail.code,
                errorDetail.message,
                'TTS synthesis returned null result',
                undefined,
                'tts-api'
            ).catch(err => console.error('Error tracking TTS error:', err));

            return {
                success: false,
                error: 'Failed to generate speech',
                errorDetail
            };
        }

        return {
            success: true,
            audioContent: result.audioContent,
            timepoints: result.timepoints
        };
    } catch (error) {
        console.error('Generate TTS error:', error);

        const currentProvider = provider || getCurrentTtsProvider();
        const { code, message, originalError } = classifyTtsError(error, currentProvider);

        const errorDetail: TtsErrorDetail = {
            code,
            message,
            provider: currentProvider,
            voiceId,
            textLength: text?.length || 0,
            originalError,
            timestamp: new Date().toISOString()
        };

        // Track the error
        await addTtsErrorRecord(
            currentProvider,
            voiceId,
            text?.length || 0,
            code,
            message,
            originalError,
            undefined,
            'tts-api'
        ).catch(err => console.error('Error tracking TTS error:', err));

        return {
            success: false,
            error: message,
            errorDetail
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