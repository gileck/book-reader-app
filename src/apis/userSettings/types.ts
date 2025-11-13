import type { CacheResult } from '../../common/cache/types';

// Client-facing DTOs
export interface UserSettings {
    ttsEnabled: boolean;
    playbackSpeed: number;
    selectedVoice: string;
    selectedProvider: string;
    wordTimingOffset: number;
    theme: 'light' | 'dark';
    // Effective colors (derived using current theme)
    highlightColor: string;
    sentenceHighlightColor: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;
    // Focus mode preferences
    wordHighlightingEnabled?: boolean; // legacy toggle
    highlightMode?: 'word' | 'line' | 'off';
    autoFontScaling?: boolean;
    // Reading mode preference
    readingMode?: 'focus' | 'full';
    // Per-mode color storage
    highlightColorLight?: string;
    highlightColorDark?: string;
    sentenceHighlightColorLight?: string;
    sentenceHighlightColorDark?: string;
    textColorLight?: string;
    textColorDark?: string;
}

export interface UserSettingsClient extends UserSettings {
    _id: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
}

// Request payloads
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetUserSettingsPayload {
    // No params - uses userId from context
}

export interface UpdateUserSettingsPayload {
    // Audio Settings
    ttsEnabled?: boolean;
    playbackSpeed?: number;
    voiceId?: string;
    selectedProvider?: string;
    wordTimingOffset?: number;

    // Visual Settings
    theme?: 'light' | 'dark';
    highlightColor?: string; // legacy/effective (optional)
    sentenceHighlightColor?: string; // legacy/effective (optional)
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
    textColor?: string; // legacy/effective (optional)
    // New per-mode color fields
    highlightColorLight?: string;
    highlightColorDark?: string;
    sentenceHighlightColorLight?: string;
    sentenceHighlightColorDark?: string;
    textColorLight?: string;
    textColorDark?: string;

    // Focus Mode
    wordHighlightingEnabled?: boolean;
    highlightMode?: 'word' | 'line' | 'off';
    autoFontScaling?: boolean;

    // Reading Mode Preference
    readingMode?: 'focus' | 'full';

    // Reading Preferences
    autoAdvance?: boolean;
    chunkSize?: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ResetUserSettingsPayload {
    // No params - uses userId from context
}

// Response payloads
export interface GetUserSettingsResponse {
    success: boolean;
    userSettings: UserSettingsClient | null;
}

export interface UpdateUserSettingsResponse {
    success: boolean;
    userSettings: UserSettingsClient;
}

export interface ResetUserSettingsResponse {
    settings: UserSettingsClient | null;
}

// API Request/Response Types
export interface GetUserSettingsRequest {
    userId: string;
}

export interface UpdateUserSettingsRequest {
    userId: string;
    settings: Partial<UserSettings>;
}

// Client API Types
export type GetUserSettingsClientResult = CacheResult<GetUserSettingsResponse>;
export type UpdateUserSettingsClientResult = CacheResult<UpdateUserSettingsResponse>; 