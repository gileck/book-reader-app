import { useState, useCallback } from 'react';
import { generateTts } from '../../../../apis/tts/client';
import { useSettings } from '../../../settings/SettingsContext';

/**
 * Reader-specific hook that wraps the centralized SettingsContext
 * with UI state (modal open/close) and handler functions
 * 
 * Data is loaded centrally in SettingsContext at app startup
 * This hook just adds Reader-specific UI behaviors
 */
export const useUserSettings = () => {
    const { userSettings, userSettingsLoaded, updateUserSettings, settings, updateSettings } = useSettings();

    // Local UI state for modals (not persisted)
    const [speedModalOpen, setSpeedModalOpen] = useState(false);
    const [themeModalOpen, setThemeModalOpen] = useState(false);

    // Safety check - should never happen due to loading gate in ReaderDataLoader
    if (!userSettings) {
        throw new Error('User settings not loaded - this should be caught by ReaderDataLoader');
    }

    const handleSpeedChange = useCallback(async (speed: number) => {
        await updateUserSettings({ playbackSpeed: speed });
    }, [updateUserSettings]);

    const handleTtsEnabledChange = useCallback(async (enabled: boolean) => {
        await updateUserSettings({ ttsEnabled: enabled });
    }, [updateUserSettings]);

    const handleVoiceChange = useCallback(async (voice: string) => {
        await updateUserSettings({ selectedVoice: voice });
    }, [updateUserSettings]);

    const handleProviderChange = useCallback(async (provider: string) => {
        await updateUserSettings({ selectedProvider: provider as 'google' | 'polly' | 'elevenlabs' });
    }, [updateUserSettings]);

    const handleWordTimingOffsetChange = useCallback(async (offset: number) => {
        await updateUserSettings({ wordTimingOffset: offset });
    }, [updateUserSettings]);

    const handlePreviewVoice = useCallback(async (voice: string, provider: string) => {
        if (!userSettings.ttsEnabled) return;
        const previewText = "Hello! This is a preview of the selected voice.";
        try {
            const result = await generateTts({
                text: previewText,
                voiceId: voice,
                provider: provider as 'google' | 'polly' | 'elevenlabs'
            });
            if (result.data?.success && result.data.audioContent) {
                const previewAudio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);
                void previewAudio.play();
            }
        } catch (error) {
            console.error('Error generating voice preview:', error);
        }
    }, [userSettings.ttsEnabled]);

    const handleSpeedSettings = useCallback(() => {
        setSpeedModalOpen(true);
    }, []);

    const handleCloseSpeedModal = useCallback(() => {
        setSpeedModalOpen(false);
    }, []);

    const handleSettings = useCallback(() => {
        setThemeModalOpen(true);
    }, []);

    const handleCloseThemeModal = useCallback(() => {
        setThemeModalOpen(false);
    }, []);

    const handleThemeChange = useCallback(async (theme: 'light' | 'dark') => {
        // Update global settings for app-wide theme
        updateSettings({ theme });
        await updateUserSettings({ theme });
    }, [updateSettings, updateUserSettings]);

    const handleHighlightColorChange = useCallback(async (highlightColor: string) => {
        const isDark = settings.theme === 'dark';
        if (isDark) {
            await updateUserSettings({ highlightColorDark: highlightColor });
        } else {
            await updateUserSettings({ highlightColorLight: highlightColor });
        }
    }, [updateUserSettings, settings.theme]);

    const handleSentenceHighlightColorChange = useCallback(async (sentenceHighlightColor: string) => {
        const isDark = settings.theme === 'dark';
        if (isDark) {
            await updateUserSettings({ sentenceHighlightColorDark: sentenceHighlightColor });
        } else {
            await updateUserSettings({ sentenceHighlightColorLight: sentenceHighlightColor });
        }
    }, [updateUserSettings, settings.theme]);

    const handleFontSizeChange = useCallback(async (fontSize: number) => {
        await updateUserSettings({ fontSize });
    }, [updateUserSettings]);

    const handleLineHeightChange = useCallback(async (lineHeight: number) => {
        await updateUserSettings({ lineHeight });
    }, [updateUserSettings]);

    const handleFontFamilyChange = useCallback(async (fontFamily: string) => {
        await updateUserSettings({ fontFamily });
    }, [updateUserSettings]);

    const handleTextColorChange = useCallback(async (textColor: string) => {
        const isDark = settings.theme === 'dark';
        if (isDark) {
            await updateUserSettings({ textColorDark: textColor });
        } else {
            await updateUserSettings({ textColorLight: textColor });
        }
    }, [updateUserSettings, settings.theme]);

    const handleResetToDefaults = useCallback(async () => {
        // Reset all theme-related settings to defaults
        await updateUserSettings({
            theme: 'light',
            highlightColorLight: '#ffeb3b',
            highlightColorDark: '#ffeb3b',
            sentenceHighlightColorLight: '#e3f2fd',
            sentenceHighlightColorDark: '#1a237e',
            fontSize: 1.0,
            lineHeight: 1.5,
            fontFamily: 'Inter, system-ui, sans-serif',
            textColorLight: '#000000',
            textColorDark: '#ffffff'
        });
    }, [updateUserSettings]);

    const handleWordHighlightingEnabledChange = useCallback(async (enabled: boolean) => {
        await updateUserSettings({ wordHighlightingEnabled: enabled });
    }, [updateUserSettings]);

    const handleHighlightModeChange = useCallback(async (mode: 'word' | 'line' | 'off') => {
        await updateUserSettings({
            highlightMode: mode,
            wordHighlightingEnabled: mode === 'word'
        });
    }, [updateUserSettings]);

    // Return the same interface as before, but data comes from Context
    return {
        // Data from Context
        ttsEnabled: userSettings.ttsEnabled,
        playbackSpeed: userSettings.playbackSpeed,
        selectedVoice: userSettings.selectedVoice,
        selectedProvider: userSettings.selectedProvider,
        wordSpeedOffset: userSettings.wordTimingOffset,
        theme: userSettings.theme,
        highlightColor: settings.theme === 'dark'
            ? (userSettings.highlightColorDark ?? '#ffeb3b')
            : (userSettings.highlightColorLight ?? '#ffeb3b'),
        sentenceHighlightColor: settings.theme === 'dark'
            ? (userSettings.sentenceHighlightColorDark ?? '#1a237e')
            : (userSettings.sentenceHighlightColorLight ?? '#e3f2fd'),
        fontSize: userSettings.fontSize,
        lineHeight: userSettings.lineHeight,
        fontFamily: userSettings.fontFamily,
        textColor: settings.theme === 'dark'
            ? (userSettings.textColorDark ?? '#ffffff')
            : (userSettings.textColorLight ?? '#000000'),
        highlightMode: userSettings.highlightMode ?? 'word',
        wordHighlightingEnabled: userSettings.wordHighlightingEnabled ?? true,
        settingsLoaded: userSettingsLoaded,

        // Local UI state
        speedModalOpen,
        themeModalOpen,

        // Handler functions
        handleSpeedChange,
        handleTtsEnabledChange,
        handleVoiceChange,
        handleProviderChange,
        handleWordTimingOffsetChange,
        handlePreviewVoice,
        handleSpeedSettings,
        handleCloseSpeedModal,
        handleSettings,
        handleCloseThemeModal,
        handleThemeChange,
        handleHighlightColorChange,
        handleSentenceHighlightColorChange,
        handleFontSizeChange,
        handleLineHeightChange,
        handleFontFamilyChange,
        handleTextColorChange,
        handleWordHighlightingEnabledChange,
        handleResetToDefaults,
        handleHighlightModeChange
    };
};
