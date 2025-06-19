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

export interface GenerateTtsResponse {
    success: boolean;
    audioContent?: string; // base64 encoded audio
    timepoints?: TTSTimepoint[];
    error?: string;
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