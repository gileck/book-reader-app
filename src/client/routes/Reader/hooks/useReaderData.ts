import { useCallback, useState, useEffect } from 'react';
import { useRouter } from '../../../router';
import { getBook } from '../../../../apis/books/client';
import { getChapterByNumber } from '../../../../apis/chapters/client';
import { offlineDB } from '../../../offline/offlineDB';
import { getReadingProgress } from '../../../../apis/readingProgress/client';
import type { BookClient } from '../../../../apis/books/types';
import type { ChapterClient } from '../../../../apis/chapters/types';
import type { OfflineChapterRecord } from '../../../offline/offlineDB';
import { useAuth } from '@/client/context/AuthContext';
import { apiUpdateProfile } from '@/apis/auth/client';

interface ReaderData {
    book: BookClient;
    chapter: ChapterClient;
    currentChapterNumber: number;
    currentSentenceIndex: number;
}

interface UseReaderDataResult {
    data: ReaderData | null;
    loading: boolean;
    error: string | null;
}

export const useReaderData = (): UseReaderDataResult => {
    const { queryParams, navigate } = useRouter();
    const { user, isInitialLoading } = useAuth();
    const { bookId: queryBookId, chapter: queryChapter, chunk: queryChunk } = queryParams;

    const [bookId, setBookId] = useState<string | undefined>(queryBookId);
    const [bookIdResolved, setBookIdResolved] = useState<boolean>(false);
    const [data, setData] = useState<ReaderData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Helper to build chapter from offline record
    const buildChapterFromLocal = useCallback((localRec: OfflineChapterRecord): ChapterClient => {
        return {
            _id: localRec.chapterId,
            bookId: localRec.bookId,
            chapterNumber: localRec.chapterNumber,
            title: localRec.title,
            content: localRec.content as unknown as ChapterClient['content'],
            wordCount: (localRec.content as unknown as ChapterClient['content'])?.chunks?.length || 0,
            createdAt: localRec.downloadedAt,
            updatedAt: localRec.contentVersion || localRec.downloadedAt
        };
    }, []);

    const loadChapterPreferOffline = useCallback(async (
        bookIdParam: string,
        chapterNumber: number
    ): Promise<{ chapter: ChapterClient | null; fromLocal: boolean }> => {
        // Always call the API - it handles caching automatically:
        // - When online: fetches from network and caches the response
        // - When offline: returns cached response or throws error
        try {
            const chapterResult = await getChapterByNumber({ bookId: bookIdParam, chapterNumber });

            // Check if this came from cache
            const fromCache = chapterResult.isFromCache || false;

            return {
                chapter: chapterResult.data?.chapter || null,
                fromLocal: fromCache
            };
        } catch (error) {
            // If API call fails (offline with no cache), try IndexedDB as last resort
            console.warn('API call failed, checking IndexedDB:', error);
            const localRec = await offlineDB.getChapterByBookAndNumber(bookIdParam, chapterNumber);
            if (localRec) {
                return { chapter: buildChapterFromLocal(localRec), fromLocal: true };
            }

            // No cached version available anywhere
            throw error;
        }
    }, [buildChapterFromLocal]);

    // Get current book ID from user.activeBookId
    const getCurrentBookId = useCallback(async (): Promise<string | null> => {
        try {
            const activeBookIdFromUser = user?.activeBookId;
            return activeBookIdFromUser || null;
        } catch (error) {
            console.error('Error getting current book ID:', error);
            return null;
        }
    }, [user?.activeBookId]);

    // Handle Active Book concept (resolve bookId)
    useEffect(() => {
        const resolveBookId = async () => {
            // Wait for initial auth load
            if (isInitialLoading) return;

            if (queryBookId) {
                // Persist the provided bookId as the active book
                if (user?.id && user?.activeBookId !== queryBookId) {
                    try {
                        await apiUpdateProfile({ activeBookId: queryBookId });
                    } catch (err) {
                        console.warn('Failed to persist activeBookId to user', err);
                    }
                }

                setBookId(queryBookId);
                setBookIdResolved(true);
            } else {
                const currentBookId = await getCurrentBookId();
                if (!currentBookId) {
                    // No active book could be determined; redirect to library
                    navigate('/book-library');
                }
                setBookId(currentBookId || undefined);
                setBookIdResolved(true);
            }
        };

        resolveBookId();
    }, [queryBookId, isInitialLoading, user?.activeBookId, user?.id, navigate, getCurrentBookId]);

    // Load all data (book, progress, chapter) in parallel where possible
    useEffect(() => {
        const loadReaderData = async () => {
            // Wait until we've attempted to resolve the book ID
            if (!bookIdResolved) {
                return;
            }

            if (!bookId) {
                setError('No books found');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Parallel: Load book + reading progress
                const [bookResult, progressResult] = await Promise.all([
                    getBook({ bookId }),
                    user?.id ? getReadingProgress({ userId: user.id, bookId }) : Promise.resolve({ data: null })
                ]);

                if (!bookResult.data || !bookResult.data.book) {
                    setError('Book not found');
                    setLoading(false);
                    return;
                }

                const book = bookResult.data.book;

                // Determine chapter and chunk position
                let currentChapter: number;
                let currentChunk: number;

                // First check URL parameters (highest priority)
                if (queryChapter && queryChunk) {
                    currentChapter = parseInt(queryChapter, 10);
                    currentChunk = parseInt(queryChunk, 10);
                } else {
                    // Use reading progress data
                    if (progressResult.data?.success && progressResult.data.readingProgress) {
                        const savedChapter = progressResult.data.readingProgress.currentChapter;
                        const savedChunk = progressResult.data.readingProgress.currentChunk;
                        const bookStartChapter = book.chapterStartNumber ?? 1;

                        // Validate saved chapter is valid for this book
                        if (savedChapter >= bookStartChapter) {
                            currentChapter = savedChapter;
                            currentChunk = savedChunk;
                        } else {
                            console.warn(`Invalid saved chapter ${savedChapter} for book starting at chapter ${bookStartChapter}, resetting to start`);
                            currentChapter = bookStartChapter;
                            currentChunk = 0;
                        }
                    } else {
                        // No progress found, start from book's chapterStartNumber
                        currentChapter = book.chapterStartNumber ?? 1;
                        currentChunk = 0;
                    }
                }

                // Load the determined chapter
                const { chapter: resolvedChapter, fromLocal } = await loadChapterPreferOffline(bookId, currentChapter);
                if (!resolvedChapter) {
                    setError(fromLocal
                        ? 'This chapter is not available offline. Please connect to the internet or go back to a previously loaded chapter.'
                        : 'Chapter not found. This chapter may not exist in the book.');
                    setLoading(false);
                    return;
                }

                // Success! Set all data
                setData({
                    book,
                    chapter: resolvedChapter,
                    currentChapterNumber: currentChapter,
                    currentSentenceIndex: currentChunk
                });
                setLoading(false);


            } catch (error) {
                console.error('Error loading reader data:', error);

                // Extract user-friendly error message
                let errorMessage = 'Failed to load book content. Please try again.';
                if (error instanceof Error) {
                    // Use the specific error message if it's user-friendly
                    if (error.message.includes('not available offline') ||
                        error.message.includes('connect to the internet') ||
                        error.message.includes('download this content')) {
                        errorMessage = error.message;
                    } else if (error.message.includes('Chapter not found')) {
                        errorMessage = 'This chapter could not be found. It may not exist in this book.';
                    } else if (error.message.includes('Book not found')) {
                        errorMessage = 'This book could not be found. Please check the book selection.';
                    } else if (error.message.includes('No books found')) {
                        errorMessage = 'No books found in your library. Please add a book first.';
                    }
                }

                setError(errorMessage);
                setLoading(false);
            }
        };

        loadReaderData();
    }, [bookId, bookIdResolved, queryChapter, queryChunk, user?.id, loadChapterPreferOffline]);

    return { data, loading, error };
};

