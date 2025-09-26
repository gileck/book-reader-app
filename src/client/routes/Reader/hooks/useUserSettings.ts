import { useState, useEffect, useCallback } from 'react';
import { getUserSettings, updateUserSettings } from '../../../../apis/userSettings/client';
import { generateTts } from '../../../../apis/tts/client';
import { useSettings } from '../../../settings/SettingsContext';

interface UserSettingsState {
    ttsEnabled: boolean;
    playbackSpeed: number;
    selectedVoice: string;
    selectedProvider: string;
    wordSpeedOffset: number;
    speedModalOpen: boolean;
    themeModalOpen: boolean;
    theme: 'light' | 'dark';
    highlightColor: string;
    sentenceHighlightColor: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;
    // Per-mode stored colors
    highlightColorLight: string;
    highlightColorDark: string;
    sentenceHighlightColorLight: string;
    sentenceHighlightColorDark: string;
    textColorLight: string;
    textColorDark: string;
    // Focus mode
    wordHighlightingEnabled: boolean;
    highlightMode: 'word' | 'line' | 'off';
}

const getDefaultUserSettingsState = (): UserSettingsState => ({
    ttsEnabled: true,
    playbackSpeed: 1.0,
    selectedVoice: 'en-US-Neural2-A',
    selectedProvider: 'google',
    wordSpeedOffset: 0,
    speedModalOpen: false,
    themeModalOpen: false,
    theme: 'light',
    highlightColor: '#ffeb3b',
    sentenceHighlightColor: '#e3f2fd', // Light mode default
    fontSize: 1.0,
    lineHeight: 1.5,
    fontFamily: 'Inter, system-ui, sans-serif',
    textColor: '#000000',
    highlightColorLight: '#ffeb3b',
    highlightColorDark: '#ffeb3b',
    sentenceHighlightColorLight: '#e3f2fd',
    sentenceHighlightColorDark: '#1a237e',
    textColorLight: '#000000',
    textColorDark: '#ffffff'
    ,
    wordHighlightingEnabled: true,
    highlightMode: 'word'
});

export const useUserSettings = (userId: string) => {
    const [state, setState] = useState(getDefaultUserSettingsState());
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const { settings, updateSettings } = useSettings();

    const updateState = useCallback((partialState: Partial<UserSettingsState>) => {
        setState(prev => ({ ...prev, ...partialState }));
    }, []);

    // Load user settings on mount
    useEffect(() => {
        const loadUserSettings = async () => {
            try {
                const settingsResult = await getUserSettings({ userId });
                if (settingsResult.data?.success && settingsResult.data.userSettings) {
                    const s = settingsResult.data.userSettings;
                    const theme = s.theme as 'light' | 'dark';
                    const highlightLight = s.highlightColorLight ?? s.highlightColor ?? '#ffeb3b';
                    const highlightDark = s.highlightColorDark ?? s.highlightColor ?? '#ffeb3b';
                    const sentenceLight = s.sentenceHighlightColorLight ?? s.sentenceHighlightColor ?? '#e3f2fd';
                    const sentenceDark = s.sentenceHighlightColorDark ?? '#1a237e';
                    const textLight = s.textColorLight ?? s.textColor ?? '#000000';
                    const textDark = s.textColorDark ?? '#ffffff';
                    updateState({
                        ttsEnabled: s.ttsEnabled ?? true,
                        playbackSpeed: s.playbackSpeed,
                        selectedVoice: s.selectedVoice,
                        selectedProvider: s.selectedProvider || 'google',
                        wordSpeedOffset: s.wordTimingOffset,
                        theme,
                        highlightColor: theme === 'dark' ? highlightDark : highlightLight,
                        sentenceHighlightColor: theme === 'dark' ? sentenceDark : sentenceLight,
                        fontSize: s.fontSize,
                        lineHeight: s.lineHeight,
                        fontFamily: s.fontFamily,
                        textColor: theme === 'dark' ? textDark : textLight,
                        highlightColorLight: highlightLight,
                        highlightColorDark: highlightDark,
                        sentenceHighlightColorLight: sentenceLight,
                        sentenceHighlightColorDark: sentenceDark,
                        textColorLight: textLight,
                        textColorDark: textDark
                        ,
                        wordHighlightingEnabled: s.wordHighlightingEnabled ?? true,
                        highlightMode: (s.highlightMode as 'word' | 'line' | 'off') ?? (s.wordHighlightingEnabled === false ? 'off' : 'word')
                    });


                    // CSS variables are now set locally in ReaderContent component
                    // No global CSS variable setting needed
                }
            } catch (error) {
                console.error('Error loading user settings:', error);
            } finally {
                setSettingsLoaded(true);
            }
        };

        loadUserSettings();
    }, [userId, updateState]);

    // Keep local theme in sync with global SettingsContext (e.g., TopNavBar toggle)
    useEffect(() => {
        if (!settings) return;
        const newTheme = settings.theme;
        if (state.theme !== newTheme) {
            const effectiveHighlight = newTheme === 'dark' ? state.highlightColorDark : state.highlightColorLight;
            const effectiveSentence = newTheme === 'dark' ? state.sentenceHighlightColorDark : state.sentenceHighlightColorLight;
            const effectiveText = newTheme === 'dark' ? state.textColorDark : state.textColorLight;
            updateState({ theme: newTheme, highlightColor: effectiveHighlight, sentenceHighlightColor: effectiveSentence, textColor: effectiveText });
        }
        // We intentionally do not persist here; the header already saves when authenticated
    }, [settings.theme, state.theme, state.highlightColorDark, state.highlightColorLight, state.sentenceHighlightColorDark, state.sentenceHighlightColorLight, state.textColorDark, state.textColorLight, updateState]);


    const handleSpeedChange = useCallback(async (speed: number) => {
        updateState({ playbackSpeed: speed });

        try {
            await updateUserSettings({
                userId,
                settings: { playbackSpeed: speed }
            });
        } catch (error) {
            console.error('Error updating playback speed:', error);
        }
    }, [userId, updateState]);

    const handleTtsEnabledChange = useCallback(async (enabled: boolean) => {
        updateState({ ttsEnabled: enabled });

        try {
            await updateUserSettings({
                userId,
                settings: { ttsEnabled: enabled }
            });
        } catch (error) {
            console.error('Error updating TTS enabled setting:', error);
        }
    }, [userId, updateState]);

    const handleVoiceChange = useCallback(async (voice: string) => {
        updateState({ selectedVoice: voice });

        try {
            await updateUserSettings({
                userId,
                settings: { selectedVoice: voice }
            });
        } catch (error) {
            console.error('Error updating voice selection:', error);
        }
    }, [userId, updateState]);

    const handleProviderChange = useCallback(async (provider: string) => {
        updateState({ selectedProvider: provider });

        try {
            await updateUserSettings({
                userId,
                settings: { selectedProvider: provider }
            });
        } catch (error) {
            console.error('Error updating provider selection:', error);
        }
    }, [userId, updateState]);

    const handleWordTimingOffsetChange = useCallback(async (offset: number) => {
        updateState({ wordSpeedOffset: offset });

        try {
            await updateUserSettings({
                userId,
                settings: { wordTimingOffset: offset }
            });
        } catch (error) {
            console.error('Error updating word timing offset:', error);
        }
    }, [userId, updateState]);

    const handlePreviewVoice = useCallback(async (voice: string, provider: string) => {
        if (!state.ttsEnabled) return;
        const previewText = "Hello! This is a preview of the selected voice.";
        try {
            const result = await generateTts({
                text: previewText,
                voiceId: voice,
                provider: provider as 'google' | 'polly' | 'elevenlabs'
            });
            if (result.data?.success && result.data.audioContent) {
                const previewAudio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);
                previewAudio.play();
            }
        } catch (error) {
            console.error('Error generating voice preview:', error);
        }
    }, [state.ttsEnabled]);

    const handleSpeedSettings = useCallback(() => {
        updateState({ speedModalOpen: true });
    }, [updateState]);

    const handleCloseSpeedModal = useCallback(() => {
        updateState({ speedModalOpen: false });
    }, [updateState]);

    const handleSettings = useCallback(() => {
        updateState({ themeModalOpen: true });
    }, [updateState]);

    const handleCloseThemeModal = useCallback(() => {
        updateState({ themeModalOpen: false });
    }, [updateState]);

    const handleThemeChange = useCallback(async (theme: 'light' | 'dark') => {
        updateState({ theme });

        // Update global settings for app-wide theme
        updateSettings({ theme });

        try {
            await updateUserSettings({
                userId,
                settings: { theme }
            });
        } catch (error) {
            console.error('Error updating theme:', error);
        }
    }, [userId, updateState, updateSettings]);

    const handleHighlightColorChange = useCallback(async (highlightColor: string) => {
        const isDark = (settings?.theme ?? state.theme) === 'dark';
        if (isDark) {
            updateState({ highlightColorDark: highlightColor, highlightColor });
        } else {
            updateState({ highlightColorLight: highlightColor, highlightColor });
        }

        try {
            await updateUserSettings({
                userId,
                settings: isDark ? { highlightColorDark: highlightColor } : { highlightColorLight: highlightColor }
            });
        } catch (error) {
            console.error('Error updating highlight color:', error);
        }
    }, [userId, updateState, settings?.theme, state.theme]);

    const handleSentenceHighlightColorChange = useCallback(async (sentenceHighlightColor: string) => {
        const isDark = (settings?.theme ?? state.theme) === 'dark';
        if (isDark) {
            updateState({ sentenceHighlightColorDark: sentenceHighlightColor, sentenceHighlightColor });
        } else {
            updateState({ sentenceHighlightColorLight: sentenceHighlightColor, sentenceHighlightColor });
        }

        try {
            await updateUserSettings({
                userId,
                settings: isDark ? { sentenceHighlightColorDark: sentenceHighlightColor } : { sentenceHighlightColorLight: sentenceHighlightColor }
            });
        } catch (error) {
            console.error('Error updating sentence highlight color:', error);
        }
    }, [userId, updateState, settings?.theme, state.theme]);

    const handleFontSizeChange = useCallback(async (fontSize: number) => {
        updateState({ fontSize });

        try {
            await updateUserSettings({
                userId,
                settings: { fontSize }
            });
        } catch (error) {
            console.error('Error updating font size:', error);
        }
    }, [userId, updateState]);

    const handleLineHeightChange = useCallback(async (lineHeight: number) => {
        updateState({ lineHeight });

        try {
            await updateUserSettings({
                userId,
                settings: { lineHeight }
            });
        } catch (error) {
            console.error('Error updating line height:', error);
        }
    }, [userId, updateState]);

    const handleFontFamilyChange = useCallback(async (fontFamily: string) => {
        updateState({ fontFamily });

        try {
            await updateUserSettings({
                userId,
                settings: { fontFamily }
            });
        } catch (error) {
            console.error('Error updating font family:', error);
        }
    }, [userId, updateState]);

    const handleTextColorChange = useCallback(async (textColor: string) => {
        const isDark = (settings?.theme ?? state.theme) === 'dark';
        if (isDark) {
            updateState({ textColorDark: textColor, textColor });
        } else {
            updateState({ textColorLight: textColor, textColor });
        }

        try {
            await updateUserSettings({
                userId,
                settings: isDark ? { textColorDark: textColor } : { textColorLight: textColor }
            });
        } catch (error) {
            console.error('Error updating text color:', error);
        }
    }, [userId, updateState, settings?.theme, state.theme]);

    const handleResetToDefaults = useCallback(async () => {
        // Get default values
        const defaults = getDefaultUserSettingsState();

        // Update state with all defaults
        updateState({
            theme: defaults.theme,
            highlightColor: defaults.highlightColor,
            sentenceHighlightColor: defaults.sentenceHighlightColor,
            fontSize: defaults.fontSize,
            lineHeight: defaults.lineHeight,
            fontFamily: defaults.fontFamily,
            textColor: defaults.textColor
        });

        try {
            // Save all default theme settings to backend
            await updateUserSettings({
                userId,
                settings: {
                    theme: defaults.theme,
                    highlightColorLight: defaults.highlightColorLight,
                    highlightColorDark: defaults.highlightColorDark,
                    sentenceHighlightColorLight: defaults.sentenceHighlightColorLight,
                    sentenceHighlightColorDark: defaults.sentenceHighlightColorDark,
                    fontSize: defaults.fontSize,
                    lineHeight: defaults.lineHeight,
                    fontFamily: defaults.fontFamily,
                    textColorLight: defaults.textColorLight,
                    textColorDark: defaults.textColorDark
                }
            });
        } catch (error) {
            console.error('Error resetting theme to defaults:', error);
        }
    }, [userId, updateState]);

    const handleWordHighlightingEnabledChange = useCallback(async (enabled: boolean) => {
        updateState({ wordHighlightingEnabled: enabled });
        try {
            await updateUserSettings({ userId, settings: { wordHighlightingEnabled: enabled } });
        } catch (error) {
            console.error('Error updating word highlighting setting:', error);
        }
    }, [userId, updateState]);

    const handleHighlightModeChange = useCallback(async (mode: 'word' | 'line' | 'off') => {
        updateState({ highlightMode: mode, wordHighlightingEnabled: mode === 'word' });
        try {
            await updateUserSettings({ userId, settings: { highlightMode: mode, wordHighlightingEnabled: mode === 'word' ? true : mode === 'off' ? false : state.wordHighlightingEnabled } });
        } catch (error) {
            console.error('Error updating highlight mode:', error);
        }
    }, [userId, updateState, state.wordHighlightingEnabled]);

    return {
        ttsEnabled: state.ttsEnabled,
        playbackSpeed: state.playbackSpeed,
        selectedVoice: state.selectedVoice,
        selectedProvider: state.selectedProvider,
        wordSpeedOffset: state.wordSpeedOffset,
        speedModalOpen: state.speedModalOpen,
        themeModalOpen: state.themeModalOpen,
        theme: state.theme,
        highlightColor: state.highlightColor,
        sentenceHighlightColor: state.sentenceHighlightColor,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        fontFamily: state.fontFamily,
        textColor: state.textColor,
        highlightMode: state.highlightMode,
        wordHighlightingEnabled: state.wordHighlightingEnabled,
        settingsLoaded,
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