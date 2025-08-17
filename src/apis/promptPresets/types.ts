// Client-side types for prompt presets API

export interface PromptPresetClient {
    _id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePromptPresetPayload {
    title: string;
    content: string;
}

export interface CreatePromptPresetResponse {
    preset: PromptPresetClient;
}

export type GetPromptPresetsPayload = Record<string, never>;
export interface GetPromptPresetsResponse {
    presets: PromptPresetClient[];
}

export interface UpdatePromptPresetPayload {
    presetId: string;
    title?: string;
    content?: string;
}

export interface UpdatePromptPresetResponse {
    preset: PromptPresetClient | null;
}

export interface DeletePromptPresetPayload {
    presetId: string;
}

export interface DeletePromptPresetResponse {
    success: boolean;
}


