export const name = 'userSettings';

// API name constants
export const API_GET_USER_SETTINGS = 'userSettings/get';
export const API_UPDATE_USER_SETTINGS = 'userSettings/update';
export const API_RESET_USER_SETTINGS = 'userSettings/reset';

export const USER_SETTINGS_API_NAMES = {
    getUserSettings: 'getUserSettings',
    updateUserSettings: 'updateUserSettings'
} as const; 