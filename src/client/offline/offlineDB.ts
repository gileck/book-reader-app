// Lightweight IndexedDB wrapper for offline chapters/books
// We avoid external deps; simple versioning and typed helpers.

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

const DB_NAME = 'offline-reader-db';
const DB_VERSION = 1;
const STORE_CHAPTERS = 'chapters';
const STORE_BOOKS = 'books';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
                const store = db.createObjectStore(STORE_CHAPTERS, { keyPath: 'chapterId' });
                store.createIndex('byBook', 'bookId', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_BOOKS)) {
                db.createObjectStore(STORE_BOOKS, { keyPath: 'bookId' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
    const db = await openDB();
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        Promise.resolve(fn(store))
            .then((result) => {
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            })
            .catch(reject);
    });
}

export const offlineDB = {
    async putChapter(record: OfflineChapterRecord): Promise<void> {
        await withStore<void>(STORE_CHAPTERS, 'readwrite', (store) => {
            store.put(record);
            return Promise.resolve();
        });
        // Also update the book entry
        await withStore<void>(STORE_BOOKS, 'readwrite', async (store) => {
            const getReq = store.get(record.bookId);
            const book: OfflineBookRecord = await new Promise((resolve) => {
                getReq.onsuccess = () => resolve(getReq.result || { bookId: record.bookId, downloadedChapterIds: [] });
                getReq.onerror = () => resolve({ bookId: record.bookId, downloadedChapterIds: [] });
            });
            if (!book.downloadedChapterIds.includes(record.chapterId)) {
                book.downloadedChapterIds.push(record.chapterId);
            }
            store.put(book);
            return Promise.resolve();
        });
    },

    async getChapter(chapterId: string): Promise<OfflineChapterRecord | undefined> {
        return withStore<OfflineChapterRecord | undefined>(STORE_CHAPTERS, 'readonly', (store) => {
            const req = store.get(chapterId);
            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result || undefined);
                req.onerror = () => resolve(undefined);
            });
        });
    },

    async getChapterByBookAndNumber(bookId: string, chapterNumber: number): Promise<OfflineChapterRecord | undefined> {
        return withStore<OfflineChapterRecord | undefined>(STORE_CHAPTERS, 'readonly', (store) => {
            const req = store.index('byBook').getAll(bookId);
            return new Promise((resolve) => {
                req.onsuccess = () => {
                    const list = (req.result as OfflineChapterRecord[]) || [];
                    resolve(list.find((r) => r.chapterNumber === chapterNumber));
                };
                req.onerror = () => resolve(undefined);
            });
        });
    },

    async deleteChapter(bookId: string, chapterId: string): Promise<void> {
        await withStore<void>(STORE_CHAPTERS, 'readwrite', (store) => {
            store.delete(chapterId);
            return Promise.resolve();
        });
        await withStore<void>(STORE_BOOKS, 'readwrite', async (store) => {
            const getReq = store.get(bookId);
            const book: OfflineBookRecord | undefined = await new Promise((resolve) => {
                getReq.onsuccess = () => resolve(getReq.result || undefined);
                getReq.onerror = () => resolve(undefined);
            });
            if (book) {
                book.downloadedChapterIds = book.downloadedChapterIds.filter((id) => id !== chapterId);
                store.put(book);
            }
            return Promise.resolve();
        });
    },

    async getBook(bookId: string): Promise<OfflineBookRecord | undefined> {
        return withStore<OfflineBookRecord | undefined>(STORE_BOOKS, 'readonly', (store) => {
            const req = store.get(bookId);
            return new Promise((resolve) => {
                req.onsuccess = () => resolve(req.result || undefined);
                req.onerror = () => resolve(undefined);
            });
        });
    },

    async listDownloadedChapters(bookId: string): Promise<string[]> {
        const book = await this.getBook(bookId);
        return book?.downloadedChapterIds || [];
    },

    async clearAll(): Promise<void> {
        await withStore<void>(STORE_CHAPTERS, 'readwrite', (store) => {
            store.clear();
            return Promise.resolve();
        });
        await withStore<void>(STORE_BOOKS, 'readwrite', (store) => {
            store.clear();
            return Promise.resolve();
        });
    }
};


