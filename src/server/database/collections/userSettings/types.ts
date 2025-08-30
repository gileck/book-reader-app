import { ObjectId } from 'mongodb';

export interface UserSettings {
    _id: ObjectId;
    userId: ObjectId;

    // Audio Settings
    ttsEnabled: boolean;
    playbackSpeed: number;
    voiceId: string;
    selectedProvider: string;
    wordTimingOffset: number;

    // Visual Settings
    theme: 'light' | 'dark';
    // Per-mode colors
    highlightColorLight: string;
    highlightColorDark: string;
    sentenceHighlightColorLight: string;
    sentenceHighlightColorDark: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColorLight: string;
    textColorDark: string;

    // Reading Preferences
    autoAdvance: boolean;
    chunkSize: number;

    createdAt: Date;
    updatedAt: Date;
}

export type UserSettingsCreate = Omit<UserSettings, '_id'>;

export type UserSettingsUpdate = Partial<Omit<UserSettings, '_id' | 'userId' | 'createdAt'>> & {
    updatedAt: Date;
};

export interface UserSettingsFilter {
    _id?: ObjectId;
    userId?: ObjectId;
}

// Default settings values
export const DEFAULT_USER_SETTINGS: Omit<UserSettings, '_id' | 'userId' | 'createdAt' | 'updatedAt'> = {
    ttsEnabled: true,
    playbackSpeed: 1.0,
    voiceId: 'en-US-Neural2-A',
    selectedProvider: 'google',
    wordTimingOffset: 0,
    theme: 'light',
    highlightColorLight: '#ffeb3b',
    highlightColorDark: '#ffeb3b',
    sentenceHighlightColorLight: '#e3f2fd',
    sentenceHighlightColorDark: '#1a237e',
    fontSize: 1.0,
    lineHeight: 1.5,
    fontFamily: 'Inter, system-ui, sans-serif',
    textColorLight: '#000000',
    textColorDark: '#ffffff',
    autoAdvance: true,
    chunkSize: 10
}; 