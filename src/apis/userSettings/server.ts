import { findOrCreateUserSettings, updateUserSettings as updateSettings } from '../../server/database/collections/userSettings';
import { API_GET_USER_SETTINGS, API_UPDATE_USER_SETTINGS } from './index';
import type {
    GetUserSettingsRequest,
    GetUserSettingsResponse,
    UpdateUserSettingsRequest,
    UpdateUserSettingsResponse,
    UserSettings as ClientUserSettings
} from './types';
import type { UserSettings as DbUserSettings } from '../../server/database/collections/userSettings/types';

export { API_GET_USER_SETTINGS, API_UPDATE_USER_SETTINGS };

/**
 * Type-safe mapper from client settings to database settings.
 * 
 * This function explicitly maps each field from the client-facing API format
 * to the database schema format. By avoiding generic Record<string, unknown>
 * approaches, TypeScript can verify that all fields are properly handled.
 * 
 * Key Benefits:
 * - Type safety: TypeScript will error if we miss any field
 * - Explicit field handling: No silent data drops
 * - Field transformations: Handles naming differences (e.g., selectedVoice → voiceId)
 * - Legacy support: Handles effective colors that apply to both light/dark modes
 * 
 * @param clientSettings - Partial client settings from API request
 * @returns Partial database settings ready for MongoDB update
 */
function mapClientSettingsToDb(
    clientSettings: Partial<ClientUserSettings>
): Partial<Omit<DbUserSettings, '_id' | 'userId' | 'createdAt' | 'updatedAt'>> {
    const dbSettings: Partial<Omit<DbUserSettings, '_id' | 'userId' | 'createdAt' | 'updatedAt'>> = {};

    // Audio Settings
    if (clientSettings.playbackSpeed !== undefined) dbSettings.playbackSpeed = clientSettings.playbackSpeed;
    if (clientSettings.ttsEnabled !== undefined) dbSettings.ttsEnabled = clientSettings.ttsEnabled;
    if (clientSettings.selectedVoice !== undefined) dbSettings.voiceId = clientSettings.selectedVoice;
    if (clientSettings.selectedProvider !== undefined) dbSettings.selectedProvider = clientSettings.selectedProvider;
    if (clientSettings.wordTimingOffset !== undefined) dbSettings.wordTimingOffset = clientSettings.wordTimingOffset;

    // Visual Settings
    if (clientSettings.theme !== undefined) dbSettings.theme = clientSettings.theme;
    if (clientSettings.fontSize !== undefined) dbSettings.fontSize = clientSettings.fontSize;
    if (clientSettings.lineHeight !== undefined) dbSettings.lineHeight = clientSettings.lineHeight;
    if (clientSettings.fontFamily !== undefined) dbSettings.fontFamily = clientSettings.fontFamily;

    // Legacy/effective color fields (apply to both modes if sent)
    if (clientSettings.highlightColor !== undefined) {
        dbSettings.highlightColorLight = clientSettings.highlightColor;
        dbSettings.highlightColorDark = clientSettings.highlightColor;
    }
    if (clientSettings.sentenceHighlightColor !== undefined) {
        dbSettings.sentenceHighlightColorLight = clientSettings.sentenceHighlightColor;
        dbSettings.sentenceHighlightColorDark = clientSettings.sentenceHighlightColor;
    }
    if (clientSettings.textColor !== undefined) {
        dbSettings.textColorLight = clientSettings.textColor;
        dbSettings.textColorDark = clientSettings.textColor;
    }

    // Per-mode color fields (override legacy if both sent)
    if (clientSettings.highlightColorLight !== undefined) dbSettings.highlightColorLight = clientSettings.highlightColorLight;
    if (clientSettings.highlightColorDark !== undefined) dbSettings.highlightColorDark = clientSettings.highlightColorDark;
    if (clientSettings.sentenceHighlightColorLight !== undefined) dbSettings.sentenceHighlightColorLight = clientSettings.sentenceHighlightColorLight;
    if (clientSettings.sentenceHighlightColorDark !== undefined) dbSettings.sentenceHighlightColorDark = clientSettings.sentenceHighlightColorDark;
    if (clientSettings.textColorLight !== undefined) dbSettings.textColorLight = clientSettings.textColorLight;
    if (clientSettings.textColorDark !== undefined) dbSettings.textColorDark = clientSettings.textColorDark;

    // Focus Mode Settings
    if (clientSettings.wordHighlightingEnabled !== undefined) dbSettings.wordHighlightingEnabled = clientSettings.wordHighlightingEnabled;
    if (clientSettings.highlightMode !== undefined) dbSettings.highlightMode = clientSettings.highlightMode;
    if (clientSettings.autoFontScaling !== undefined) dbSettings.autoFontScaling = clientSettings.autoFontScaling;
    if (clientSettings.bionicReadingEnabled !== undefined) dbSettings.bionicReadingEnabled = clientSettings.bionicReadingEnabled;
    if (clientSettings.chunkSpacing !== undefined) dbSettings.chunkSpacing = clientSettings.chunkSpacing;

    // Reading Mode
    if (clientSettings.readingMode !== undefined) dbSettings.readingMode = clientSettings.readingMode;

    // Note: autoAdvance and chunkSize are not in client settings (they're DB-only)

    return dbSettings;
}

/**
 * Type-safe mapper from database settings to client settings.
 * 
 * This function transforms database documents into the client-facing API format.
 * It computes effective colors based on the current theme and ensures all
 * required fields are present with appropriate defaults.
 * 
 * Key Responsibilities:
 * - Convert ObjectId to string for _id and userId
 * - Convert Date to ISO string for timestamps
 * - Compute effective colors based on theme (highlightColor, sentenceHighlightColor, textColor)
 * - Apply defaults for optional fields
 * - Handle field name transformations (e.g., voiceId → selectedVoice)
 * 
 * @param dbSettings - Complete user settings document from MongoDB
 * @returns Client-facing settings object with effective colors and string IDs
 */
function mapDbSettingsToClient(dbSettings: DbUserSettings): Omit<ClientUserSettings, '_id' | 'userId' | 'createdAt' | 'updatedAt'> & {
    _id: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
} {
    return {
        _id: dbSettings._id.toString(),
        userId: dbSettings.userId.toString(),
        // Audio Settings
        ttsEnabled: dbSettings.ttsEnabled,
        playbackSpeed: dbSettings.playbackSpeed,
        selectedVoice: dbSettings.voiceId || 'en-US-Neural2-A',
        selectedProvider: dbSettings.selectedProvider || 'google',
        wordTimingOffset: dbSettings.wordTimingOffset,
        // Visual Settings
        theme: dbSettings.theme,
        fontSize: dbSettings.fontSize,
        lineHeight: dbSettings.lineHeight,
        fontFamily: dbSettings.fontFamily,
        // Effective colors (derived from current theme)
        highlightColor: dbSettings.theme === 'dark' 
            ? (dbSettings.highlightColorDark || '#ffeb3b') 
            : (dbSettings.highlightColorLight || '#ffeb3b'),
        sentenceHighlightColor: dbSettings.theme === 'dark' 
            ? (dbSettings.sentenceHighlightColorDark || '#1a237e') 
            : (dbSettings.sentenceHighlightColorLight || '#e3f2fd'),
        textColor: dbSettings.theme === 'dark' 
            ? (dbSettings.textColorDark || '#ffffff') 
            : (dbSettings.textColorLight || '#000000'),
        // Per-mode colors
        highlightColorLight: dbSettings.highlightColorLight,
        highlightColorDark: dbSettings.highlightColorDark,
        sentenceHighlightColorLight: dbSettings.sentenceHighlightColorLight,
        sentenceHighlightColorDark: dbSettings.sentenceHighlightColorDark,
        textColorLight: dbSettings.textColorLight,
        textColorDark: dbSettings.textColorDark,
        // Focus Mode Settings
        wordHighlightingEnabled: dbSettings.wordHighlightingEnabled,
        highlightMode: dbSettings.highlightMode,
        autoFontScaling: dbSettings.autoFontScaling,
        bionicReadingEnabled: dbSettings.bionicReadingEnabled,
        chunkSpacing: dbSettings.chunkSpacing,
        // Reading Mode
        readingMode: dbSettings.readingMode,
        // Timestamps
        createdAt: dbSettings.createdAt.toISOString(),
        updatedAt: dbSettings.updatedAt.toISOString()
    };
}

export async function getUserSettings(params: GetUserSettingsRequest): Promise<GetUserSettingsResponse> {
    try {
        const userSettings = await findOrCreateUserSettings(params.userId);
        const clientSettings = mapDbSettingsToClient(userSettings);

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
        // Convert client settings to database format using type-safe mapper
        const dbSettingsUpdate = mapClientSettingsToDb(params.settings);

        const updatedSettings = await updateSettings(params.userId, dbSettingsUpdate);

        if (!updatedSettings) {
            throw new Error('Failed to update user settings');
        }

        // Convert back to client format using type-safe mapper
        const clientSettings = mapDbSettingsToClient(updatedSettings);

        return {
            success: true,
            userSettings: clientSettings
        };
    } catch (error) {
        console.error('Error updating user settings:', error);
        throw error;
    }
} 