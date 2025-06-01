export * from './index';

import {
    API_GENERATE_TTS,
    API_PROCESS_TEXT_CHUNKS
} from './index';

import { synthesizeSpeechWithTiming, processTextForTTS } from '../../server/tts/ttsService';
import type {
    GenerateTtsPayload,
    GenerateTtsResponse,
    ProcessTextChunksPayload,
    ProcessTextChunksResponse
} from './types';

import { process as generateTtsProcess } from './handlers/generateTtsHandler';
import { process as processTextChunksProcess } from './handlers/processTextChunksHandler';

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

export async function processTextChunks(payload: ProcessTextChunksPayload): Promise<ProcessTextChunksResponse> {
    try {
        const { text } = payload;

        if (!text?.trim()) {
            return {
                success: false,
                error: 'Text is required'
            };
        }

        const chunks = processTextForTTS(text);

        return {
            success: true,
            chunks
        };
    } catch (error) {
        console.error('Process text chunks error:', error);
        return {
            success: false,
            error: 'Internal server error'
        };
    }
}

export const ttsApiHandlers = {
    [API_GENERATE_TTS]: { process: generateTtsProcess },
    [API_PROCESS_TEXT_CHUNKS]: { process: processTextChunksProcess }
}; 