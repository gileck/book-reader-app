import { Collection } from 'mongodb';
import { getDb } from '@/server/database';
import { TtsUsageRecord, TtsUsageRecordCreate } from './types';

// Private function to get collection reference
const getTtsUsageCollection = async (): Promise<Collection<TtsUsageRecord>> => {
    const db = await getDb();
    return db.collection<TtsUsageRecord>('ttsUsage');
};

// Create a new TTS usage record
export const createTtsUsageRecord = async (
    recordData: TtsUsageRecordCreate
): Promise<TtsUsageRecord> => {
    const collection = await getTtsUsageCollection();

    const record: TtsUsageRecord = {
        ...recordData,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await collection.insertOne(record);
    return { ...record, _id: result.insertedId };
};

// Get all TTS usage records
export const getAllTtsUsageRecords = async (): Promise<TtsUsageRecord[]> => {
    const collection = await getTtsUsageCollection();
    return collection.find({}).sort({ timestamp: -1 }).toArray();
};

// Get TTS usage records by provider
export const getTtsUsageRecordsByProvider = async (
    provider: 'google' | 'polly' | 'elevenlabs'
): Promise<TtsUsageRecord[]> => {
    const collection = await getTtsUsageCollection();
    return collection.find({ provider }).sort({ timestamp: -1 }).toArray();
};

// Get TTS usage records by date range
export const getTtsUsageRecordsByDateRange = async (
    startDate: Date,
    endDate: Date
): Promise<TtsUsageRecord[]> => {
    const collection = await getTtsUsageCollection();
    return collection.find({
        timestamp: {
            $gte: startDate,
            $lte: endDate
        }
    }).sort({ timestamp: -1 }).toArray();
};

// Get TTS usage records by user
export const getTtsUsageRecordsByUser = async (
    userId: string
): Promise<TtsUsageRecord[]> => {
    const collection = await getTtsUsageCollection();
    return collection.find({ userId }).sort({ timestamp: -1 }).toArray();
};

// Get TTS usage records count
export const getTtsUsageRecordsCount = async (): Promise<number> => {
    const collection = await getTtsUsageCollection();
    return collection.countDocuments();
};

// Insert many TTS usage records (for migration)
export const insertManyTtsUsageRecords = async (
    records: TtsUsageRecordCreate[]
): Promise<void> => {
    const collection = await getTtsUsageCollection();

    const recordsWithTimestamps = records.map(record => ({
        ...record,
        createdAt: new Date(),
        updatedAt: new Date()
    }));

    await collection.insertMany(recordsWithTimestamps);
}; 