// Business logic layer for offline reading and TTS cache
// Uses the generic IndexedDB manager for data operations

import type { TTSTimepoint } from '../../apis/tts/types';
import { createIndexedDBManager, IndexedDBManager } from './indexedDBManager';

export interface OfflineChapterRecord {
    chapterId: string;
    bookId: string;
    title: string;
    chapterNumber: number;
    content: unknown; // ChapterContentClient
    assets: string[];
    contentVersion?: string; // or updatedAt ISO
    downloadedAt: string; // ISO
}

export interface OfflineBookRecord {
    bookId: string;
    title?: string;
    coverUrl?: string;
    downloadedChapterIds: string[];
}

export interface TtsCacheRecord {
    cacheKey: string;              // hash(text + voiceId + provider)
    audioContent: string;          // base64 audio
    timepoints: TTSTimepoint[];    // word timing data
    createdAt: number;             // timestamp for FIFO ordering
}

// Store names
const STORE_CHAPTERS = 'chapters';
const STORE_BOOKS = 'books';
const STORE_TTS_CACHE = 'tts-cache';
const TTS_CACHE_LIMIT = 10;

// Create the IndexedDB manager
const dbManager: IndexedDBManager = createIndexedDBManager({
    dbName: 'offline-reader-db',
    version: 2,
    stores: [
        {
            name: STORE_CHAPTERS,
            keyPath: 'chapterId',
            indexes: [
                { name: 'byBook', keyPath: 'bookId', unique: false }
            ]
        },
        {
            name: STORE_BOOKS,
            keyPath: 'bookId'
        },
        {
            name: STORE_TTS_CACHE,
            keyPath: 'cacheKey'
        }
    ]
});

/**
 * Offline database API with business logic
 * Wraps the generic IndexedDB manager with type-safe, domain-specific operations
 */
export const offlineDB = {
    // ========================================
    // Chapter Operations
    // ========================================
    
    async putChapter(record: OfflineChapterRecord): Promise<void> {
        await dbManager.put(STORE_CHAPTERS, record);
        
        // Also update the book entry
        await dbManager.transaction<void>(STORE_BOOKS, 'readwrite', async (store) => {
            const getReq = store.get(record.bookId);
            const book: OfflineBookRecord = await new Promise((resolve) => {
                getReq.onsuccess = () => resolve(getReq.result || { 
                    bookId: record.bookId, 
                    downloadedChapterIds: [] 
                });
                getReq.onerror = () => resolve({ 
                    bookId: record.bookId, 
                    downloadedChapterIds: [] 
                });
            });
            
            if (!book.downloadedChapterIds.includes(record.chapterId)) {
                book.downloadedChapterIds.push(record.chapterId);
            }
            store.put(book);
            return Promise.resolve();
        });
    },

    async getChapter(chapterId: string): Promise<OfflineChapterRecord | undefined> {
        return dbManager.get<OfflineChapterRecord>(STORE_CHAPTERS, chapterId);
    },

    async getChapterByBookAndNumber(
        bookId: string, 
        chapterNumber: number
    ): Promise<OfflineChapterRecord | undefined> {
        const chapters = await dbManager.getByIndex<OfflineChapterRecord>(
            STORE_CHAPTERS,
            'byBook',
            bookId
        );
        return chapters.find((r) => r.chapterNumber === chapterNumber);
    },

    async deleteChapter(bookId: string, chapterId: string): Promise<void> {
        await dbManager.delete(STORE_CHAPTERS, chapterId);
        
        // Update the book entry
        await dbManager.transaction<void>(STORE_BOOKS, 'readwrite', async (store) => {
            const getReq = store.get(bookId);
            const book: OfflineBookRecord | undefined = await new Promise((resolve) => {
                getReq.onsuccess = () => resolve(getReq.result || undefined);
                getReq.onerror = () => resolve(undefined);
            });
            
            if (book) {
                book.downloadedChapterIds = book.downloadedChapterIds.filter(
                    (id) => id !== chapterId
                );
                store.put(book);
            }
            return Promise.resolve();
        });
    },

    // ========================================
    // Book Operations
    // ========================================

    async getBook(bookId: string): Promise<OfflineBookRecord | undefined> {
        return dbManager.get<OfflineBookRecord>(STORE_BOOKS, bookId);
    },

    async listDownloadedChapters(bookId: string): Promise<string[]> {
        const book = await this.getBook(bookId);
        return book?.downloadedChapterIds || [];
    },

    async clearAll(): Promise<void> {
        await dbManager.clear(STORE_CHAPTERS);
        await dbManager.clear(STORE_BOOKS);
    },

    // ========================================
    // TTS Cache Operations
    // ========================================

    async getTtsCache(cacheKey: string): Promise<TtsCacheRecord | undefined> {
        return dbManager.get<TtsCacheRecord>(STORE_TTS_CACHE, cacheKey);
    },

    async putTtsCache(record: TtsCacheRecord): Promise<void> {
        await dbManager.transaction<void>(STORE_TTS_CACHE, 'readwrite', async (store) => {
            // Put the new record
            store.put(record);

            // Get all entries to check count
            const getAllReq = store.getAll();
            const allEntries: TtsCacheRecord[] = await new Promise((resolve) => {
                getAllReq.onsuccess = () => resolve(getAllReq.result || []);
                getAllReq.onerror = () => resolve([]);
            });

            // If we have more than the limit, delete the oldest
            if (allEntries.length > TTS_CACHE_LIMIT) {
                // Sort by createdAt (oldest first)
                const sorted = allEntries.sort((a, b) => a.createdAt - b.createdAt);
                // Delete excess entries
                const toDelete = sorted.slice(0, allEntries.length - TTS_CACHE_LIMIT);
                toDelete.forEach(entry => store.delete(entry.cacheKey));
            }

            return Promise.resolve();
        });
    },

    async getTtsCacheStats(): Promise<{ count: number; sizeBytes: number }> {
        const entries = await dbManager.getAll<TtsCacheRecord>(STORE_TTS_CACHE);
        const count = entries.length;
        // Estimate size by stringifying all entries
        const sizeBytes = JSON.stringify(entries).length;
        return { count, sizeBytes };
    },

    async clearTtsCache(): Promise<void> {
        await dbManager.clear(STORE_TTS_CACHE);
    }
};
