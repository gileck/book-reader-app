import { findOrCreateUserSettings, updateUserSettings as updateSettings } from '../../server/database/collections/userSettings';
import { API_GET_USER_SETTINGS, API_UPDATE_USER_SETTINGS } from './index';
import type {
    GetUserSettingsRequest,
    GetUserSettingsResponse,
    UpdateUserSettingsRequest,
    UpdateUserSettingsResponse
} from './types';

export { API_GET_USER_SETTINGS, API_UPDATE_USER_SETTINGS };

export async function getUserSettings(params: GetUserSettingsRequest): Promise<GetUserSettingsResponse> {
    try {
        const userSettings = await findOrCreateUserSettings(params.userId);

        // Convert to client format
        const clientSettings = {
            _id: userSettings._id.toString(),
            userId: userSettings.userId.toString(),
            ttsEnabled: userSettings.ttsEnabled,
            playbackSpeed: userSettings.playbackSpeed,
            selectedVoice: userSettings.voiceId || 'en-US-Neural2-A',
            selectedProvider: userSettings.selectedProvider || 'google',
            wordTimingOffset: userSettings.wordTimingOffset,
            theme: userSettings.theme,
            // Effective colors for current theme can be derived client-side; here we return placeholders for backward compatibility
            highlightColor: userSettings.theme === 'dark' ? (userSettings.highlightColorDark || '#ffeb3b') : (userSettings.highlightColorLight || '#ffeb3b'),
            sentenceHighlightColor: userSettings.theme === 'dark' ? (userSettings.sentenceHighlightColorDark || '#1a237e') : (userSettings.sentenceHighlightColorLight || '#e3f2fd'),
            fontSize: userSettings.fontSize,
            lineHeight: userSettings.lineHeight,
            fontFamily: userSettings.fontFamily,
            textColor: userSettings.theme === 'dark' ? (userSettings.textColorDark || '#ffffff') : (userSettings.textColorLight || '#000000'),
            // Also expose per-mode colors
            highlightColorLight: userSettings.highlightColorLight,
            highlightColorDark: userSettings.highlightColorDark,
            sentenceHighlightColorLight: userSettings.sentenceHighlightColorLight,
            sentenceHighlightColorDark: userSettings.sentenceHighlightColorDark,
            textColorLight: userSettings.textColorLight,
            textColorDark: userSettings.textColorDark,
            createdAt: userSettings.createdAt.toISOString(),
            updatedAt: userSettings.updatedAt.toISOString()
        };

        return {
            success: true,
            userSettings: clientSettings
        };
    } catch (error) {
        console.error('Error getting user settings:', error);
        return {
            success: false,
            userSettings: null
        };
    }
}

export async function updateUserSettings(params: UpdateUserSettingsRequest): Promise<UpdateUserSettingsResponse> {
    try {
        // Convert client settings to server format
        const serverSettings: Record<string, unknown> = {};
        if (params.settings.playbackSpeed !== undefined) {
            serverSettings.playbackSpeed = params.settings.playbackSpeed;
        }
        if (params.settings.ttsEnabled !== undefined) {
            serverSettings.ttsEnabled = params.settings.ttsEnabled;
        }
        if (params.settings.selectedVoice !== undefined) {
            serverSettings.voiceId = params.settings.selectedVoice;
        }
        if (params.settings.selectedProvider !== undefined) {
            serverSettings.selectedProvider = params.settings.selectedProvider;
        }
        if (params.settings.wordTimingOffset !== undefined) {
            serverSettings.wordTimingOffset = params.settings.wordTimingOffset;
        }
        if (params.settings.theme !== undefined) {
            serverSettings.theme = params.settings.theme;
        }
        // Legacy/effective fields (optional): if sent, apply to both modes
        if (params.settings.highlightColor !== undefined) {
            serverSettings.highlightColorLight = params.settings.highlightColor;
            serverSettings.highlightColorDark = params.settings.highlightColor;
        }
        if (params.settings.sentenceHighlightColor !== undefined) {
            serverSettings.sentenceHighlightColorLight = params.settings.sentenceHighlightColor;
            serverSettings.sentenceHighlightColorDark = params.settings.sentenceHighlightColor;
        }
        if (params.settings.fontSize !== undefined) {
            serverSettings.fontSize = params.settings.fontSize;
        }
        if (params.settings.lineHeight !== undefined) {
            serverSettings.lineHeight = params.settings.lineHeight;
        }
        if (params.settings.fontFamily !== undefined) {
            serverSettings.fontFamily = params.settings.fontFamily;
        }
        if (params.settings.textColor !== undefined) {
            serverSettings.textColorLight = params.settings.textColor;
            serverSettings.textColorDark = params.settings.textColor;
        }

        // New per-mode color fields
        if (params.settings.highlightColorLight !== undefined) serverSettings.highlightColorLight = params.settings.highlightColorLight;
        if (params.settings.highlightColorDark !== undefined) serverSettings.highlightColorDark = params.settings.highlightColorDark;
        if (params.settings.sentenceHighlightColorLight !== undefined) serverSettings.sentenceHighlightColorLight = params.settings.sentenceHighlightColorLight;
        if (params.settings.sentenceHighlightColorDark !== undefined) serverSettings.sentenceHighlightColorDark = params.settings.sentenceHighlightColorDark;
        if (params.settings.textColorLight !== undefined) serverSettings.textColorLight = params.settings.textColorLight;
        if (params.settings.textColorDark !== undefined) serverSettings.textColorDark = params.settings.textColorDark;

        const updatedSettings = await updateSettings(params.userId, serverSettings);

        if (!updatedSettings) {
            throw new Error('Failed to update user settings');
        }

        // Convert to client format
        const clientSettings = {
            _id: updatedSettings._id.toString(),
            userId: updatedSettings.userId.toString(),
            ttsEnabled: updatedSettings.ttsEnabled,
            playbackSpeed: updatedSettings.playbackSpeed,
            selectedVoice: updatedSettings.voiceId || 'en-US-Neural2-A',
            selectedProvider: updatedSettings.selectedProvider || 'google',
            wordTimingOffset: updatedSettings.wordTimingOffset,
            theme: updatedSettings.theme,
            highlightColor: updatedSettings.theme === 'dark' ? (updatedSettings.highlightColorDark || '#ffeb3b') : (updatedSettings.highlightColorLight || '#ffeb3b'),
            sentenceHighlightColor: updatedSettings.theme === 'dark' ? (updatedSettings.sentenceHighlightColorDark || '#1a237e') : (updatedSettings.sentenceHighlightColorLight || '#e3f2fd'),
            fontSize: updatedSettings.fontSize,
            lineHeight: updatedSettings.lineHeight,
            fontFamily: updatedSettings.fontFamily,
            textColor: updatedSettings.theme === 'dark' ? (updatedSettings.textColorDark || '#ffffff') : (updatedSettings.textColorLight || '#000000'),
            highlightColorLight: updatedSettings.highlightColorLight,
            highlightColorDark: updatedSettings.highlightColorDark,
            sentenceHighlightColorLight: updatedSettings.sentenceHighlightColorLight,
            sentenceHighlightColorDark: updatedSettings.sentenceHighlightColorDark,
            textColorLight: updatedSettings.textColorLight,
            textColorDark: updatedSettings.textColorDark,
            createdAt: updatedSettings.createdAt.toISOString(),
            updatedAt: updatedSettings.updatedAt.toISOString()
        };

        return {
            success: true,
            userSettings: clientSettings
        };
    } catch (error) {
        console.error('Error updating user settings:', error);
        throw error;
    }
} 