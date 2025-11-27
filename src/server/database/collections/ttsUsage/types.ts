import { ObjectId } from 'mongodb';

export interface TtsUsageRecord {
    _id?: ObjectId;
    id: string;
    timestamp: Date;
    provider: 'google' | 'polly' | 'elevenlabs';
    voiceId: string;
    voiceType: 'standard' | 'wavenet' | 'neural' | 'neural2' | 'polyglot' | 'studio' | 'chirp3-hd' | 'long-form' | 'generative';
    textLength: number;
    audioLength: number;
    cost: number;
    endpoint: string;
    userId?: string;
    fromCache?: boolean; // Whether this request was served from cache (undefined for old records)
    createdAt: Date;
    updatedAt: Date;
}

export type TtsUsageRecordCreate = Omit<TtsUsageRecord, '_id' | 'createdAt' | 'updatedAt'>;
export type TtsUsageRecordUpdate = Partial<Omit<TtsUsageRecord, '_id' | 'id' | 'createdAt'>>; 