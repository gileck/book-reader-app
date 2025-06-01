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
}

export interface GenerateTtsResponse {
    success: boolean;
    audioContent?: string; // base64 encoded audio
    timepoints?: TTSTimepoint[];
    error?: string;
}

export interface ProcessTextChunksPayload {
    text: string;
    minWords?: number;
    maxWords?: number;
}

export interface ProcessTextChunksResponse {
    success: boolean;
    chunks?: TTSChunk[];
    error?: string;
} 