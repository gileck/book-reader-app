import type { SearchResultItem } from '@/apis/search/types';

const CACHE_PREFIX = 'reader_search_cache_';

interface CachedSearch {
    timestamp: number;
    results: SearchResultItem[];
    scope: 'current' | 'all';
    totalChapters?: number;
    searchedChapters?: number;
}

function getCacheKey(bookId: string, scope: 'current' | 'all', query: string): string {
    // Normalize query
    const normalizedQuery = query.trim().toLowerCase();
    return `${CACHE_PREFIX}${bookId}_${scope}_${encodeURIComponent(normalizedQuery)}`;
}

export const searchCache = {
    save: (
        bookId: string,
        scope: 'current' | 'all',
        query: string,
        results: SearchResultItem[],
        progress?: { searchedChapters: number; totalChapters: number }
    ) => {
        try {
            const key = getCacheKey(bookId, scope, query);
            const data: CachedSearch = {
                timestamp: Date.now(),
                results,
                scope,
                ...(progress && {
                    searchedChapters: progress.searchedChapters,
                    totalChapters: progress.totalChapters
                })
            };
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            // Handle quota exceeded or other errors
            console.warn('Failed to save search results to cache:', error);
        }
    },

    get: (bookId: string, scope: 'current' | 'all', query: string): CachedSearch | null => {
        try {
            const key = getCacheKey(bookId, scope, query);
            const item = localStorage.getItem(key);
            if (!item) return null;
            
            const data = JSON.parse(item) as CachedSearch;
            return data;
        } catch (error) {
            console.error('Failed to retrieve search results from cache:', error);
            return null;
        }
    },

    remove: (bookId: string, scope: 'current' | 'all', query: string) => {
        try {
            const key = getCacheKey(bookId, scope, query);
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Failed to remove search results from cache:', error);
        }
    },

    /**
     * Check if a query has cached results
     */
    has: (bookId: string, scope: 'current' | 'all', query: string): boolean => {
        const key = getCacheKey(bookId, scope, query);
        return !!localStorage.getItem(key);
    },

    /**
     * Clear all search cache for a specific book
     */
    clearBookCache: (bookId: string) => {
        try {
            const prefix = `${CACHE_PREFIX}${bookId}`;
            const keysToRemove: string[] = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.error('Failed to clear book search cache:', error);
        }
    }
};

