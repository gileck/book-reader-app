import { offlineDB, OfflineChapterRecord } from './offlineDB';
import { GetChapterResponse } from '@/apis/chapters/types';
import { getChapterByNumber } from '@/apis/chapters/client';
import { IMAGES_BASE_PATH } from '@/common/constants';

type ProgressListener = (info: { phase: 'fetch' | 'persist' | 'cacheAssets' | 'done'; current?: number; total?: number }) => void;

function getServiceWorkerController(): ServiceWorker | null {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.controller;
}

async function postMessageToSW(message: any): Promise<void> {
    const controller = getServiceWorkerController();
    if (!controller) return;
    controller.postMessage(message);
}

function extractAssetUrls(chapter: GetChapterResponse['chapter'], bookImageBaseURL?: string): string[] {
    if (!chapter) return [];
    const urls: string[] = [];
    const base = (bookImageBaseURL || '').startsWith('/') ? (bookImageBaseURL || '').slice(1) : (bookImageBaseURL || '');
    for (const chunk of chapter.content.chunks) {
        if (chunk.type === 'image' && chunk.imageName && base) {
            // Build the same URL used by the Reader image rendering
            const path = `${IMAGES_BASE_PATH}/${base}${chunk.imageName}`.replace(/\s+/g, '');
            urls.push(path);
        }
    }
    return Array.from(new Set(urls));
}

export const offlineManager = {
    async downloadChapter(params: {
        bookId: string;
        bookTitle?: string;
        bookImageBaseURL?: string;
        chapterNumber: number;
        onProgress?: ProgressListener;
    }): Promise<void> {
        const { bookId, chapterNumber, bookTitle, bookImageBaseURL, onProgress } = params;
        onProgress?.({ phase: 'fetch' });
        const response = await getChapterByNumber({ bookId, chapterNumber });
        const chapter = response.data?.chapter;
        if (!chapter) throw new Error('Chapter not found');

        onProgress?.({ phase: 'persist' });
        const assets = extractAssetUrls(chapter, bookImageBaseURL);
        const record: OfflineChapterRecord = {
            chapterId: chapter._id,
            bookId,
            title: chapter.title,
            chapterNumber,
            content: chapter.content,
            assets,
            contentVersion: chapter.updatedAt,
            downloadedAt: new Date().toISOString()
        };
        await offlineDB.putChapter(record);

        if (assets.length > 0) {
            onProgress?.({ phase: 'cacheAssets', total: assets.length });
            await postMessageToSW({ type: 'CACHE_URLS', urls: assets });
        }

        onProgress?.({ phase: 'done' });
    },

    async removeChapter(bookId: string, chapterId: string): Promise<void> {
        await offlineDB.deleteChapter(bookId, chapterId);
        // Note: we do not selectively evict assets yet
    },

    async isChapterDownloaded(chapterId: string): Promise<boolean> {
        const rec = await offlineDB.getChapter(chapterId);
        return !!rec;
    },

    async getDownloadedChapters(bookId: string): Promise<string[]> {
        return offlineDB.listDownloadedChapters(bookId);
    },

    async getStorageUsage(): Promise<number> {
        // Heuristic: size of IndexedDB is not easily known; return 0 for now
        // Can be implemented via serializing all records or using StorageManager API
        if (navigator && (navigator as any).storage && (navigator as any).storage.estimate) {
            try {
                const estimate = await (navigator as any).storage.estimate();
                return estimate.usage || 0;
            } catch {
                return 0;
            }
        }
        return 0;
    },

    async clearAllOfflineData(): Promise<void> {
        await offlineDB.clearAll();
        await postMessageToSW({ type: 'CLEAR_USER_CACHES' });
    }
};


