import { ObjectId } from 'mongodb';

export interface TtsErrorRecord {
    _id?: ObjectId;
    id: string;
    timestamp: Date;
    provider: 'google' | 'polly' | 'elevenlabs';
    voiceId: string;
    textLength: number;
    errorCode: string;
    errorMessage: string;
    originalError?: string;
    userId?: string;
    endpoint: string;
    createdAt: Date;
    updatedAt: Date;
}

export type TtsErrorRecordCreate = Omit<TtsErrorRecord, '_id' | 'createdAt' | 'updatedAt'>;
export type TtsErrorRecordUpdate = Partial<Omit<TtsErrorRecord, '_id' | 'id' | 'createdAt'>>; 