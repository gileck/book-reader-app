import { ApiHandlerContext } from '../types';
import {
    createPromptPreset as createDb,
    findPromptPresetsByUser,
    updatePromptPreset as updateDb,
    deletePromptPreset as deleteDb
} from '@/server/database/collections/promptPresets/promptPresets';
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
    DeletePromptPresetResponse,
    PromptPresetClient
} from './types';
import { ObjectId } from 'mongodb';

function toClient(preset: { _id: ObjectId; title: string; content: string; createdAt: Date; updatedAt: Date; }): PromptPresetClient {
    return {
        _id: preset._id.toString(),
        title: preset.title,
        content: preset.content,
        createdAt: preset.createdAt.toISOString(),
        updatedAt: preset.updatedAt.toISOString()
    };
}

async function createPreset(params: CreatePromptPresetPayload, context: ApiHandlerContext): Promise<CreatePromptPresetResponse> {
    const userId = context.userId;
    if (!userId) throw new Error('User must be authenticated');
    const now = new Date();
    const created = await createDb({
        userId: new ObjectId(userId),
        title: params.title,
        content: params.content,
        createdAt: now,
        updatedAt: now
    });
    return { preset: toClient(created) };
}

async function getPresets(_params: GetPromptPresetsPayload, context: ApiHandlerContext): Promise<GetPromptPresetsResponse> {
    const userId = context.userId;
    if (!userId) throw new Error('User must be authenticated');
    const presets = await findPromptPresetsByUser(userId);
    return { presets: presets.map(toClient) };
}

async function updatePreset(params: UpdatePromptPresetPayload, context: ApiHandlerContext): Promise<UpdatePromptPresetResponse> {
    const userId = context.userId;
    if (!userId) throw new Error('User must be authenticated');
    const update: { title?: string; content?: string; updatedAt: Date } = {
        updatedAt: new Date()
    };
    if (params.title !== undefined) update.title = params.title;
    if (params.content !== undefined) update.content = params.content;
    const preset = await updateDb(params.presetId, update);
    return { preset: preset ? toClient(preset) : null };
}

async function deletePreset(params: DeletePromptPresetPayload, context: ApiHandlerContext): Promise<DeletePromptPresetResponse> {
    const userId = context.userId;
    if (!userId) throw new Error('User must be authenticated');
    await deleteDb(params.presetId);
    return { success: true };
}

export const promptPresetsApiHandlers = {
    [API_CREATE_PROMPT_PRESET]: { process: createPreset },
    [API_GET_PROMPT_PRESETS]: { process: getPresets },
    [API_UPDATE_PROMPT_PRESET]: { process: updatePreset },
    [API_DELETE_PROMPT_PRESET]: { process: deletePreset }
};


