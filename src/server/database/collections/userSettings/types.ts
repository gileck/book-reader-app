import { ObjectId } from 'mongodb';

export interface UserSettings {
    _id: ObjectId;
    userId: ObjectId;

    // Audio Settings
    playbackSpeed: number;
    voiceId: string;
    selectedProvider: string;
    wordTimingOffset: number;

    // Visual Settings
    theme: 'light' | 'dark';
    highlightColor: string;
    sentenceHighlightColor: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;

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
    playbackSpeed: 1.0,
    voiceId: 'en-US-Neural2-A',
    selectedProvider: 'google',
    wordTimingOffset: 0,
    theme: 'light',
    highlightColor: '#ffeb3b',
    sentenceHighlightColor: '#e3f2fd', // Light mode default - will be adjusted by theme system
    fontSize: 1.0,
    lineHeight: 1.5,
    fontFamily: 'Inter, system-ui, sans-serif',
    textColor: '#000000',
    autoAdvance: true,
    chunkSize: 10
}; 