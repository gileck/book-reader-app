import { type TtsProvider } from '../../common/tts/ttsUtils';

export interface TTSTimepoint {
    markName: string;
    timeSeconds: number;
}

export interface TTSChunk {
    text: string;
    words: string[];
    startIndex: number;
    endIndex: number;
}

export interface GenerateTtsPayload {
    text: string;
    voiceId?: string;
    provider?: TtsProvider;
}

export interface TtsErrorDetail {
    code: string;
    message: string;
    provider?: TtsProvider;
    voiceId?: string;
    textLength?: number;
    originalError?: string;
    timestamp: string;
    userId?: string;
}

export interface GenerateTtsResponse {
    success: boolean;
    audioContent?: string; // base64 encoded audio
    timepoints?: TTSTimepoint[];
    error?: string;
    errorDetail?: TtsErrorDetail;
}

export interface GetTtsProvidersResponse {
    success: boolean;
    providers?: TtsProvider[];
    currentProvider?: TtsProvider;
    error?: string;
}

export interface SetTtsProviderPayload {
    provider: TtsProvider;
}

export interface SetTtsProviderResponse {
    success: boolean;
    error?: string;
} 