import { useState, useEffect, useCallback } from 'react';
import { getUserSettings, updateUserSettings } from '../../../../apis/userSettings/client';
import { generateTts } from '../../../../apis/tts/client';

interface UserSettingsState {
    playbackSpeed: number;
    selectedVoice: string;
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
}

const getDefaultUserSettingsState = (): UserSettingsState => ({
    playbackSpeed: 1.0,
    selectedVoice: 'en-US-Neural2-A',
    wordSpeedOffset: 0,
    speedModalOpen: false,
    themeModalOpen: false,
    theme: 'light',
    highlightColor: '#ffeb3b',
    sentenceHighlightColor: '#e3f2fd', // Light mode default
    fontSize: 1.0,
    lineHeight: 1.5,
    fontFamily: 'Inter, system-ui, sans-serif',
    textColor: '#000000'
});

export const useUserSettings = (userId: string) => {
    const [state, setState] = useState(getDefaultUserSettingsState());

    const updateState = useCallback((partialState: Partial<UserSettingsState>) => {
        setState(prev => ({ ...prev, ...partialState }));
    }, []);

    // Load user settings on mount
    useEffect(() => {
        const loadUserSettings = async () => {
            try {
                const settingsResult = await getUserSettings({ userId });
                if (settingsResult.data?.success && settingsResult.data.userSettings) {
                    const settings = settingsResult.data.userSettings;
                    updateState({
                        playbackSpeed: settings.playbackSpeed,
                        selectedVoice: settings.selectedVoice,
                        wordSpeedOffset: settings.wordTimingOffset,
                        theme: settings.theme,
                        highlightColor: settings.highlightColor,
                        sentenceHighlightColor: settings.sentenceHighlightColor,
                        fontSize: settings.fontSize,
                        lineHeight: settings.lineHeight,
                        fontFamily: settings.fontFamily,
                        textColor: settings.textColor
                    });
                }
            } catch (error) {
                console.error('Error loading user settings:', error);
            }
        };

        loadUserSettings();
    }, [userId, updateState]);

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

    const handlePreviewVoice = useCallback(async (voice: string) => {
        const previewText = "Hello! This is a preview of the selected voice.";
        try {
            const result = await generateTts({ text: previewText, voiceId: voice });
            if (result.data?.success && result.data.audioContent) {
                const previewAudio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);
                previewAudio.play();
            }
        } catch (error) {
            console.error('Error generating voice preview:', error);
        }
    }, []);

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

        try {
            await updateUserSettings({
                userId,
                settings: { theme }
            });
        } catch (error) {
            console.error('Error updating theme:', error);
        }
    }, [userId, updateState]);

    const handleHighlightColorChange = useCallback(async (highlightColor: string) => {
        updateState({ highlightColor });

        try {
            await updateUserSettings({
                userId,
                settings: { highlightColor }
            });
        } catch (error) {
            console.error('Error updating highlight color:', error);
        }
    }, [userId, updateState]);

    const handleSentenceHighlightColorChange = useCallback(async (sentenceHighlightColor: string) => {
        updateState({ sentenceHighlightColor });

        try {
            await updateUserSettings({
                userId,
                settings: { sentenceHighlightColor }
            });
        } catch (error) {
            console.error('Error updating sentence highlight color:', error);
        }
    }, [userId, updateState]);

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
        updateState({ textColor });

        try {
            await updateUserSettings({
                userId,
                settings: { textColor }
            });
        } catch (error) {
            console.error('Error updating text color:', error);
        }
    }, [userId, updateState]);

    return {
        playbackSpeed: state.playbackSpeed,
        selectedVoice: state.selectedVoice,
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
        handleSpeedChange,
        handleVoiceChange,
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
        handleTextColorChange
    };
}; 