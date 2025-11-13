import { ObjectId } from 'mongodb';

/**
 * Translation cache for storing previously translated text
 * Reduces API calls and costs
 */
export interface TranslationCache {
  _id: ObjectId;
  textHash: string; // Hash of the original text for efficient lookup
  originalText: string; // Store original text for reference
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  characterCount: number;
  createdAt: Date;
  expiresAt: Date; // TTL index - cache for 90 days
}

/**
 * Type for creating a new translation cache entry
 */
export type TranslationCacheCreate = Omit<TranslationCache, '_id'>;

