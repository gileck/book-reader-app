import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchResultItem, SearchChapterEvent } from '@/apis/search/types';
import { searchChapter as searchChapterUtil } from '../utils/searchUtils';
import { searchCache } from '../utils/searchCache';
import type { ChapterClient } from '@/apis/chapters/types';

interface UseSearchProps {
    bookId: string;
    currentChapter: ChapterClient | null;
    searchScope: 'current' | 'all';
    query: string;
}

interface UseSearchReturn {
    results: SearchResultItem[];
    isSearching: boolean;
    isCached: boolean;
    error: string | null;
    progress: {
        searchedChapters: number;
        totalChapters: number;
    } | null;
    executeSearch: () => void;
    clearResults: () => void;
    clearCache: () => void;
}

export function useSearch({
    bookId,
    currentChapter,
    searchScope,
    query
}: UseSearchProps): UseSearchReturn {
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCached, setIsCached] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{
        searchedChapters: number;
        totalChapters: number;
    } | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Check cache when query or scope changes
    useEffect(() => {
        if (!query.trim() || !bookId) {
            setIsCached(false);
            return;
        }

        const cached = searchCache.get(bookId, searchScope, query);
        if (cached) {
            setResults(cached.results);
            setIsCached(true);
            if (cached.searchedChapters && cached.totalChapters) {
                setProgress({
                    searchedChapters: cached.searchedChapters,
                    totalChapters: cached.totalChapters
                });
            }
        } else {
            setIsCached(false);
        }
    }, [bookId, searchScope, query]);

    /**
     * Search current chapter (client-side or via API)
     */
    const searchCurrentChapterFunc = useCallback(async () => {
        if (!currentChapter || !query.trim()) {
            setResults([]);
            return;
        }

        // Check cache first
        const cached = searchCache.get(bookId, 'current', query);
        if (cached) {
            setResults(cached.results);
            setIsCached(true);
            return;
        }

        setIsSearching(true);
        setError(null);
        setProgress(null);
        setIsCached(false);

        try {
            // Use client-side search for current chapter (faster)
            const searchResults = searchChapterUtil(currentChapter, query);
            setResults(searchResults);
            
            // Save to cache
            searchCache.save(bookId, 'current', query, searchResults);
            setIsCached(true);
        } catch (err) {
            console.error('Search current chapter error:', err);
            setError(err instanceof Error ? err.message : 'Search failed');
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [bookId, currentChapter, query]);

    /**
     * Search all chapters (SSE streaming)
     */
    const searchAllChapters = useCallback(async () => {
        if (!bookId || !query.trim()) {
            setResults([]);
            return;
        }

        // Check cache first
        const cached = searchCache.get(bookId, 'all', query);
        if (cached) {
            setResults(cached.results);
            setIsCached(true);
            if (cached.searchedChapters && cached.totalChapters) {
                setProgress({
                    searchedChapters: cached.searchedChapters,
                    totalChapters: cached.totalChapters
                });
            }
            return;
        }

        setIsSearching(true);
        setError(null);
        setResults([]);
        setProgress({ searchedChapters: 0, totalChapters: 0 });
        setIsCached(false);

        // Create abort controller for this search
        abortControllerRef.current = new AbortController();

        // Temporary buffer for accumulating results
        const allResults: SearchResultItem[] = [];

        try {
            const response = await fetch('/api/search/all-chapters', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ bookId, query }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('Response body is null');
            }

            // Process SSE stream
            const streamReader = response.body.getReader();
            const decoder = new TextDecoder();
            // let finalProgress = { searchedChapters: 0, totalChapters: 0 };

            while (true) {
                const { done, value } = await streamReader.read();
                
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.substring(6)) as SearchChapterEvent;
                        
                        if (data.type === 'chapter-start') {
                            const newProgress = {
                                searchedChapters: data.searchedChapters || 0,
                                totalChapters: data.totalChapters || 0
                            };
                            setProgress(newProgress);
                            // finalProgress = newProgress;
                        } else if (data.type === 'results' && data.results) {
                            // Append results to existing list
                            setResults(prev => [...prev, ...data.results!]);
                            allResults.push(...data.results!);
                        } else if (data.type === 'complete') {
                            const newProgress = {
                                searchedChapters: data.searchedChapters || 0,
                                totalChapters: data.totalChapters || 0
                            };
                            setProgress(newProgress);
                            // finalProgress = newProgress;
                            
                            // Save to cache only on complete success
                            searchCache.save(bookId, 'all', query, allResults, newProgress);
                            setIsCached(true);
                        } else if (data.type === 'error') {
                            console.error('Search error:', data.error);
                            setError(data.error || 'Search error occurred');
                        }
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                // Search was cancelled - not an error
                console.log('Search cancelled');
            } else {
                console.error('Search all chapters error:', err);
                setError(err instanceof Error ? err.message : 'Search failed');
                setResults([]);
            }
        } finally {
            setIsSearching(false);
            abortControllerRef.current = null;
        }
    }, [bookId, query]);

    /**
     * Execute search based on scope
     */
    const executeSearch = useCallback(() => {
        // Cancel any existing search
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        if (searchScope === 'current') {
            void searchCurrentChapterFunc();
        } else {
            void searchAllChapters();
        }
    }, [searchScope, searchCurrentChapterFunc, searchAllChapters]);

    /**
     * Clear results
     */
    const clearResults = useCallback(() => {
        setResults([]);
        setError(null);
        setProgress(null);
        setIsCached(false);
    }, []);

    /**
     * Remove current query from cache
     */
    const clearCache = useCallback(() => {
        searchCache.remove(bookId, searchScope, query);
        setIsCached(false);
        setResults([]);
    }, [bookId, searchScope, query]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        results,
        isSearching,
        isCached,
        error,
        progress,
        executeSearch,
        clearResults,
        clearCache
    };
}
