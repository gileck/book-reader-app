export * from './index';

import {
    API_GENERATE_TTS
} from './index';

import { synthesizeSpeechWithTiming } from '../../server/tts/ttsService';
import type {
    GenerateTtsPayload,
    GenerateTtsResponse
} from './types';

import { process as generateTtsProcess } from './handlers/generateTtsHandler';

export async function generateTts(payload: GenerateTtsPayload): Promise<GenerateTtsResponse> {
    try {
        const { text, voiceId = 'en-US-Neural2-F' } = payload;

        if (!text?.trim()) {
            return {
                success: false,
                error: 'Text is required'
            };
        }

        const result = await synthesizeSpeechWithTiming(text, voiceId);

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

// processTextChunks removed - text chunking happens during PDF import, not at runtime

export const ttsApiHandlers = {
    [API_GENERATE_TTS]: { process: generateTtsProcess }
}; 