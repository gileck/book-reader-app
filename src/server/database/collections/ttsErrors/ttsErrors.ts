import { Collection } from 'mongodb';
import { getDb } from '@/server/database';
import { TtsErrorRecord, TtsErrorRecordCreate } from './types';

// Private function to get collection reference
const getTtsErrorsCollection = async (): Promise<Collection<TtsErrorRecord>> => {
    const db = await getDb();
    return db.collection<TtsErrorRecord>('ttsErrors');
};

// Create a new TTS error record
export const createTtsErrorRecord = async (
    recordData: TtsErrorRecordCreate
): Promise<TtsErrorRecord> => {
    const collection = await getTtsErrorsCollection();

    const record: TtsErrorRecord = {
        ...recordData,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await collection.insertOne(record);
    return { ...record, _id: result.insertedId };
};

// Get all TTS error records
export const getAllTtsErrorRecords = async (): Promise<TtsErrorRecord[]> => {
    const collection = await getTtsErrorsCollection();
    return collection.find({}).sort({ timestamp: -1 }).toArray();
};

// Get TTS error records by provider
export const getTtsErrorRecordsByProvider = async (
    provider: 'google' | 'polly' | 'elevenlabs'
): Promise<TtsErrorRecord[]> => {
    const collection = await getTtsErrorsCollection();
    return collection.find({ provider }).sort({ timestamp: -1 }).toArray();
};

// Get TTS error records by error code
export const getTtsErrorRecordsByCode = async (
    errorCode: string
): Promise<TtsErrorRecord[]> => {
    const collection = await getTtsErrorsCollection();
    return collection.find({ errorCode }).sort({ timestamp: -1 }).toArray();
};

// Get TTS error records by date range
export const getTtsErrorRecordsByDateRange = async (
    startDate: Date,
    endDate: Date
): Promise<TtsErrorRecord[]> => {
    const collection = await getTtsErrorsCollection();
    return collection.find({
        timestamp: {
            $gte: startDate,
            $lte: endDate
        }
    }).sort({ timestamp: -1 }).toArray();
};

// Get TTS error records by user
export const getTtsErrorRecordsByUser = async (
    userId: string
): Promise<TtsErrorRecord[]> => {
    const collection = await getTtsErrorsCollection();
    return collection.find({ userId }).sort({ timestamp: -1 }).toArray();
};

// Get TTS error records count
export const getTtsErrorRecordsCount = async (): Promise<number> => {
    const collection = await getTtsErrorsCollection();
    return collection.countDocuments();
};

// Insert many TTS error records (for migration)
export const insertManyTtsErrorRecords = async (
    records: TtsErrorRecordCreate[]
): Promise<void> => {
    const collection = await getTtsErrorsCollection();

    const recordsWithTimestamps = records.map(record => ({
        ...record,
        createdAt: new Date(),
        updatedAt: new Date()
    }));

    await collection.insertMany(recordsWithTimestamps);
}; 