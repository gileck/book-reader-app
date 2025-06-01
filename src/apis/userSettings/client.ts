import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_USER_SETTINGS, API_UPDATE_USER_SETTINGS } from './index';
import type {
    GetUserSettingsRequest,
    GetUserSettingsResponse,
    UpdateUserSettingsRequest,
    UpdateUserSettingsResponse
} from './types';

export async function getUserSettings(params: GetUserSettingsRequest): Promise<CacheResult<GetUserSettingsResponse>> {
    return apiClient.call(API_GET_USER_SETTINGS, params);
}

export async function updateUserSettings(params: UpdateUserSettingsRequest): Promise<CacheResult<UpdateUserSettingsResponse>> {
    return apiClient.call(API_UPDATE_USER_SETTINGS, params);
} 