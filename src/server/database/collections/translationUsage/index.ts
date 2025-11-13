import { Collection, Db } from 'mongodb';
import { getDb } from '@/server/database';
import { TranslationUsageRecord, TranslationUsageRecordCreate } from './types';

const COLLECTION_NAME = 'translationUsage';

/**
 * Get the translation usage collection
 */
export async function getCollection(): Promise<Collection<TranslationUsageRecord>> {
  const db: Db = await getDb();
  return db.collection<TranslationUsageRecord>(COLLECTION_NAME);
}

/**
 * Create a new translation usage record
 */
export async function createTranslationUsageRecord(
  data: TranslationUsageRecordCreate
): Promise<TranslationUsageRecord> {
  const collection = await getCollection();
  const now = new Date();

  const record: Omit<TranslationUsageRecord, '_id'> = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(record as TranslationUsageRecord);
  return { ...record, _id: result.insertedId } as TranslationUsageRecord;
}

/**
 * Get translation usage records within a date range
 */
export async function getTranslationUsageRecords(
  startDate: Date,
  endDate: Date
): Promise<TranslationUsageRecord[]> {
  const collection = await getCollection();

  return await collection
    .find({
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    })
    .sort({ timestamp: -1 })
    .toArray();
}

/**
 * Get recent translation usage records
 */
export async function getRecentTranslationUsageRecords(
  hours: number = 24
): Promise<TranslationUsageRecord[]> {
  const collection = await getCollection();
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  return await collection
    .find({
      timestamp: { $gte: startDate },
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray();
}

/**
 * Create indexes for the translation usage collection
 */
export async function createIndexes(): Promise<void> {
  const collection = await getCollection();

  // Index for timestamp queries
  await collection.createIndex({ timestamp: -1 });

  // Index for user queries
  await collection.createIndex({ userId: 1 });

  // Index for language queries
  await collection.createIndex({ targetLanguage: 1 });

  console.log('Translation usage indexes created');
}

