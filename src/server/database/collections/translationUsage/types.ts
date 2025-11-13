import { ObjectId } from 'mongodb';

/**
 * Translation usage record for tracking API usage and costs
 */
export interface TranslationUsageRecord {
  _id: ObjectId;
  id: string; // UUID for easy reference
  timestamp: Date;
  textLength: number; // Character count
  cost: number; // Cost in USD
  targetLanguage: string;
  sourceLanguage?: string;
  fromCache: boolean; // Whether this translation was served from cache
  userId?: string; // Optional user tracking
  endpoint: string; // Which endpoint was used
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type for creating a new translation usage record
 */
export type TranslationUsageRecordCreate = Omit<TranslationUsageRecord, '_id' | 'createdAt' | 'updatedAt'>;

