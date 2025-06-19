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
            playbackSpeed: userSettings.playbackSpeed,
            selectedVoice: userSettings.voiceId || 'en-US-Neural2-A',
            selectedProvider: userSettings.selectedProvider || 'google',
            wordTimingOffset: userSettings.wordTimingOffset,
            theme: userSettings.theme,
            highlightColor: userSettings.highlightColor,
            sentenceHighlightColor: userSettings.sentenceHighlightColor,
            fontSize: userSettings.fontSize,
            lineHeight: userSettings.lineHeight,
            fontFamily: userSettings.fontFamily,
            textColor: userSettings.textColor,
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
        if (params.settings.highlightColor !== undefined) {
            serverSettings.highlightColor = params.settings.highlightColor;
        }
        if (params.settings.sentenceHighlightColor !== undefined) {
            serverSettings.sentenceHighlightColor = params.settings.sentenceHighlightColor;
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
            serverSettings.textColor = params.settings.textColor;
        }

        const updatedSettings = await updateSettings(params.userId, serverSettings);

        if (!updatedSettings) {
            throw new Error('Failed to update user settings');
        }

        // Convert to client format
        const clientSettings = {
            _id: updatedSettings._id.toString(),
            userId: updatedSettings.userId.toString(),
            playbackSpeed: updatedSettings.playbackSpeed,
            selectedVoice: updatedSettings.voiceId || 'en-US-Neural2-A',
            selectedProvider: updatedSettings.selectedProvider || 'google',
            wordTimingOffset: updatedSettings.wordTimingOffset,
            theme: updatedSettings.theme,
            highlightColor: updatedSettings.highlightColor,
            sentenceHighlightColor: updatedSettings.sentenceHighlightColor,
            fontSize: updatedSettings.fontSize,
            lineHeight: updatedSettings.lineHeight,
            fontFamily: updatedSettings.fontFamily,
            textColor: updatedSettings.textColor,
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