import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getAllModels } from '@/server/ai';
import { clearCache as clearCacheApi } from '@/apis/settings/clearCache/client';
import { getUserSettings, updateUserSettings as updateUserSettingsApi } from '@/apis/userSettings/client';
import { UserSettings as UserSettingsApi } from '@/apis/userSettings/types';
import { Settings, UserSettings, SettingsContextType, defaultSettings, defaultUserSettings } from './types';
import { useAuth } from '@/client/context/AuthContext';

// Create the context with default values
const SettingsContext = createContext<SettingsContextType>({
    settings: defaultSettings,
    updateSettings: () => { },
    effectiveOffline: false,
    clearCache: async () => ({ success: false, message: 'Context not initialized' }),
    userSettings: null,
    userSettingsLoaded: false,
    updateUserSettings: async () => { },
});

// Custom hook to use the settings context
export const useSettings = () => useContext(SettingsContext);

// Settings provider component
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize app settings from localStorage or with defaults
    const [settings, setSettings] = useState<Settings>(() => {
        if (typeof window !== 'undefined') {
            const savedSettings = localStorage.getItem('appSettings');
            if (savedSettings) {
                try {
                    const parsedSettings = JSON.parse(savedSettings);
                    // Ensure all keys from defaultSettings are present
                    return { ...defaultSettings, ...parsedSettings };
                } catch (e) {
                    console.error("Failed to parse settings from localStorage", e);
                    // Fallback to default settings if parsing fails
                    return defaultSettings;
                }
            }
        }
        return defaultSettings;
    });

    // User-specific settings from database
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);

    // Track device online/offline and derive effectiveOffline
    const [isDeviceOffline, setIsDeviceOffline] = useState<boolean>(false);

    // Get auth context to load user settings when user is available
    const { user, isAuthenticated } = useAuth();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const update = () => setIsDeviceOffline(!navigator.onLine);
        update();
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);

    // Load user settings from API when user authenticates
    useEffect(() => {
        const loadUserSettings = async () => {
            if (!isAuthenticated || !user?.id) {
                // User not authenticated - use defaults
                setUserSettings(defaultUserSettings);
                setUserSettingsLoaded(true);
                return;
            }

            try {
                const result = await getUserSettings({ userId: user.id });

                if (!result.data?.success || !result.data.userSettings) {
                    throw new Error('Failed to load user settings from server');
                }

                const s = result.data.userSettings;

                // Server should always provide these via findOrCreateUserSettings + fallbacks
                if (!s.selectedVoice) {
                    throw new Error('Server returned user settings without selectedVoice');
                }
                if (!s.selectedProvider) {
                    throw new Error('Server returned user settings without selectedProvider');
                }

                // Process theme-specific colors
                const theme = s.theme as 'light' | 'dark';
                const highlightLight = s.highlightColorLight ?? s.highlightColor ?? '#ffeb3b';
                const highlightDark = s.highlightColorDark ?? s.highlightColor ?? '#ffeb3b';
                const sentenceLight = s.sentenceHighlightColorLight ?? s.sentenceHighlightColor ?? '#e3f2fd';
                const sentenceDark = s.sentenceHighlightColorDark ?? '#1a237e';
                const textLight = s.textColorLight ?? s.textColor ?? '#000000';
                const textDark = s.textColorDark ?? '#ffffff';

                const loadedSettings: UserSettings = {
                    ttsEnabled: s.ttsEnabled ?? true,
                    playbackSpeed: s.playbackSpeed ?? 1.0,
                    selectedVoice: s.selectedVoice,
                    selectedProvider: s.selectedProvider,
                    wordTimingOffset: s.wordTimingOffset ?? 0,
                    theme,
                    highlightColor: theme === 'dark' ? highlightDark : highlightLight,
                    sentenceHighlightColor: theme === 'dark' ? sentenceDark : sentenceLight,
                    fontSize: s.fontSize ?? 1.0,
                    lineHeight: s.lineHeight ?? 1.5,
                    fontFamily: s.fontFamily || 'Inter, system-ui, sans-serif',
                    textColor: theme === 'dark' ? textDark : textLight,
                    highlightColorLight: highlightLight,
                    highlightColorDark: highlightDark,
                    sentenceHighlightColorLight: sentenceLight,
                    sentenceHighlightColorDark: sentenceDark,
                    textColorLight: textLight,
                    textColorDark: textDark,
                    wordHighlightingEnabled: s.wordHighlightingEnabled ?? true,
                    highlightMode: (s.highlightMode as 'word' | 'line' | 'off') ?? (s.wordHighlightingEnabled === false ? 'off' : 'word'),
                    autoFontScaling: s.autoFontScaling ?? true,
                    bionicReadingEnabled: s.bionicReadingEnabled ?? false
                };

                setUserSettings(loadedSettings);

                // Sync theme with app settings
                if (settings.theme !== theme) {
                    updateAppSettings({ theme });
                }
            } catch (error) {
                console.error('Error loading user settings:', error);
                // Fallback to defaults on error
                setUserSettings(defaultUserSettings);
            } finally {
                setUserSettingsLoaded(true);
            }
        };

        loadUserSettings();
    }, [isAuthenticated, user?.id]); // Only reload when auth state or user ID changes

    // Initialize AI model if not set
    useEffect(() => {
        const initializeModel = async () => {
            if (!settings.aiModel) {
                const models = getAllModels();
                if (models.length > 0) {
                    updateAppSettings({ aiModel: models[0].id });
                }
            }
        };

        initializeModel();
    }, [settings.aiModel]);

    // Save app settings to localStorage whenever they change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('appSettings', JSON.stringify(settings));
        }
    }, [settings]);

    // Update app settings
    const updateAppSettings = useCallback((newSettings: Partial<Settings>) => {
        setSettings((prevSettings: Settings) => ({
            ...prevSettings,
            ...newSettings,
        }));
    }, []);

    // Update user settings (local state + persist to database)
    const updateUserSettingsHandler = useCallback(async (newSettings: Partial<UserSettings>) => {
        if (!user?.id) {
            console.warn('Cannot update user settings: user not authenticated');
            return;
        }

        // Update local state immediately
        setUserSettings(prev => prev ? { ...prev, ...newSettings } : null);

        // Persist to database
        try {
            await updateUserSettingsApi({
                userId: user.id,
                settings: newSettings as Partial<UserSettingsApi>
            });
        } catch (error) {
            console.error('Error updating user settings:', error);
            // TODO: Could revert local state on error
        }
    }, [user?.id]);

    // Clear cache function
    const handleClearCache = async () => {
        try {
            const response = await clearCacheApi({});
            return {
                success: response.data.success,
                message: response.data.message
            };
        } catch (error) {
            console.error('Error clearing cache:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'An unknown error occurred',
            };
        }
    };

    const effectiveOffline = settings.offlineMode || isDeviceOffline;

    return (
        <SettingsContext.Provider value={{
            settings,
            updateSettings: updateAppSettings,
            effectiveOffline,
            clearCache: handleClearCache,
            userSettings,
            userSettingsLoaded,
            updateUserSettings: updateUserSettingsHandler
        }}>
            {children}
        </SettingsContext.Provider>
    );
}; 