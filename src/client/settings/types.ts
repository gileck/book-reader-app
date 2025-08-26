// Define the settings type
export interface Settings {
    aiModel: string;
    contextSentencesCount: number;
    librarySortBy: 'title' | 'progress' | 'lastRead';
    theme: 'light' | 'dark';
    offlineMode: boolean;
    staleWhileRevalidate: boolean;
}

// Define the settings context type
export interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
    effectiveOffline: boolean;
    clearCache: () => Promise<{ success: boolean; message: string }>;
}

// Default settings
export const defaultSettings: Settings = {
    aiModel: '',
    contextSentencesCount: 3,
    librarySortBy: 'title',
    theme: 'light',
    offlineMode: false,
    staleWhileRevalidate: false,
}; 