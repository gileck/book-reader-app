import { ObjectId } from 'mongodb';

export interface PromptPreset {
    _id: ObjectId;
    userId: ObjectId;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

export type PromptPresetCreate = Omit<PromptPreset, '_id'>;

export type PromptPresetUpdate = Partial<Omit<PromptPreset, '_id' | 'userId' | 'createdAt'>> & {
    updatedAt: Date;
};


