import { ObjectId } from 'mongodb';

export interface TtsUsageRecord {
    _id?: ObjectId;
    id: string;
    timestamp: Date;
    provider: 'google' | 'polly' | 'elevenlabs';
    voiceId: string;
    voiceType: 'standard' | 'neural' | 'long-form' | 'generative';
    textLength: number;
    audioLength: number;
    cost: number;
    endpoint: string;
    userId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export type TtsUsageRecordCreate = Omit<TtsUsageRecord, '_id' | 'createdAt' | 'updatedAt'>;
export type TtsUsageRecordUpdate = Partial<Omit<TtsUsageRecord, '_id' | 'id' | 'createdAt'>>; 