import { apiClient } from '@/client/utils/apiClient';
import {
    API_CREATE_PROMPT_PRESET,
    API_GET_PROMPT_PRESETS,
    API_UPDATE_PROMPT_PRESET,
    API_DELETE_PROMPT_PRESET
} from './index';
import type {
    CreatePromptPresetPayload,
    CreatePromptPresetResponse,
    GetPromptPresetsPayload,
    GetPromptPresetsResponse,
    UpdatePromptPresetPayload,
    UpdatePromptPresetResponse,
    DeletePromptPresetPayload,
    DeletePromptPresetResponse
} from './types';

export const createPromptPreset = (params: CreatePromptPresetPayload) =>
    apiClient.call<CreatePromptPresetResponse, CreatePromptPresetPayload>(API_CREATE_PROMPT_PRESET, params);

export const getPromptPresets = (params: GetPromptPresetsPayload = {}) =>
    apiClient.call<GetPromptPresetsResponse, GetPromptPresetsPayload>(API_GET_PROMPT_PRESETS, params);

export const updatePromptPreset = (params: UpdatePromptPresetPayload) =>
    apiClient.call<UpdatePromptPresetResponse, UpdatePromptPresetPayload>(API_UPDATE_PROMPT_PRESET, params);

export const deletePromptPreset = (params: DeletePromptPresetPayload) =>
    apiClient.call<DeletePromptPresetResponse, DeletePromptPresetPayload>(API_DELETE_PROMPT_PRESET, params);


