// Define the app settings type (localStorage)
export interface Settings {
    aiModel: string;
    contextSentencesCount: number;
    librarySortBy: 'title' | 'progress' | 'lastRead';
    theme: 'light' | 'dark';
    offlineMode: boolean;
    staleWhileRevalidate: boolean;
    readingMode?: 'full' | 'focus';
}

// Define user-specific settings (from database)
export interface UserSettings {
    ttsEnabled: boolean;
    playbackSpeed: number;
    selectedVoice: string;
    selectedProvider: string;
    wordTimingOffset: number;
    theme: 'light' | 'dark';
    highlightColor: string;
    sentenceHighlightColor: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;
    // Per-mode stored colors
    highlightColorLight?: string;
    highlightColorDark?: string;
    sentenceHighlightColorLight?: string;
    sentenceHighlightColorDark?: string;
    textColorLight?: string;
    textColorDark?: string;
    // Focus mode preferences
    wordHighlightingEnabled?: boolean;
    highlightMode?: 'word' | 'line' | 'off';
}

// Define the settings context type
export interface SettingsContextType {
    // App settings (localStorage)
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
    effectiveOffline: boolean;
    clearCache: () => Promise<{ success: boolean; message: string }>;

    // User settings (database)
    userSettings: UserSettings | null;
    userSettingsLoaded: boolean;
    updateUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

// Default app settings
export const defaultSettings: Settings = {
    aiModel: '',
    contextSentencesCount: 3,
    librarySortBy: 'title',
    theme: 'light',
    offlineMode: false,
    staleWhileRevalidate: false,
    readingMode: 'full',
};

// Default user settings
export const defaultUserSettings: UserSettings = {
    ttsEnabled: true,
    playbackSpeed: 1.0,
    selectedVoice: 'en-US-Neural2-A',
    selectedProvider: 'google',
    wordTimingOffset: 0,
    theme: 'light',
    highlightColor: '#ffeb3b',
    sentenceHighlightColor: '#e3f2fd',
    fontSize: 1.0,
    lineHeight: 1.5,
    fontFamily: 'Inter, system-ui, sans-serif',
    textColor: '#000000',
    highlightColorLight: '#ffeb3b',
    highlightColorDark: '#ffeb3b',
    sentenceHighlightColorLight: '#e3f2fd',
    sentenceHighlightColorDark: '#1a237e',
    textColorLight: '#000000',
    textColorDark: '#ffffff',
    wordHighlightingEnabled: true,
    highlightMode: 'word'
}; 