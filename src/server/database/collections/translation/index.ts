import { Collection, Db } from 'mongodb';
import { getDb } from '@/server/database';
import { TranslationCache, TranslationCacheCreate } from './types';
import crypto from 'crypto';

const COLLECTION_NAME = 'translationCache';
const CACHE_TTL_DAYS = 90;

/**
 * Get the translation cache collection
 */
export async function getCollection(): Promise<Collection<TranslationCache>> {
  const db: Db = await getDb();
  return db.collection<TranslationCache>(COLLECTION_NAME);
}

/**
 * Create a hash of the text for efficient lookup
 */
export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Find a cached translation
 */
export async function findCachedTranslation(
  text: string,
  targetLanguage: string
): Promise<TranslationCache | null> {
  const collection = await getCollection();
  const textHash = hashText(text);

  const cached = await collection.findOne({
    textHash,
    targetLanguage,
    expiresAt: { $gt: new Date() }, // Not expired
  });

  return cached;
}

/**
 * Save a translation to cache
 */
export async function saveCachedTranslation(
  originalText: string,
  translatedText: string,
  sourceLanguage: string,
  targetLanguage: string,
  characterCount: number
): Promise<TranslationCache> {
  const collection = await getCollection();
  const textHash = hashText(originalText);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const cacheEntry: TranslationCacheCreate = {
    textHash,
    originalText,
    sourceLanguage,
    targetLanguage,
    translatedText,
    characterCount,
    createdAt: now,
    expiresAt,
  };

  const result = await collection.insertOne(cacheEntry as TranslationCache);
  return { ...cacheEntry, _id: result.insertedId } as TranslationCache;
}

/**
 * Create indexes for the translation cache collection
 */
export async function createIndexes(): Promise<void> {
  const collection = await getCollection();

  // Compound index for efficient lookups
  await collection.createIndex({ textHash: 1, targetLanguage: 1 }, { unique: true });

  // TTL index to automatically delete expired entries
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  console.log('Translation cache indexes created');
}

