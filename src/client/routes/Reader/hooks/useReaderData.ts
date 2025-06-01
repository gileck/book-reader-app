import { useState, useEffect, useCallback } from 'react';
import { getBook } from '../../../../apis/books/client';
import { getChapterByNumber } from '../../../../apis/chapters/client';
import type { BookClient } from '../../../../apis/books/types';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface ReaderDataState {
    book: BookClient | null;
    chapter: ChapterClient | null;
    currentChapterNumber: number;
    loading: boolean;
    error: string | null;
    preloadedChapters: { [key: number]: ChapterClient };
}

const getDefaultReaderDataState = (): ReaderDataState => ({
    book: null,
    chapter: null,
    currentChapterNumber: 1,
    loading: true,
    error: null,
    preloadedChapters: {}
});

export const useReaderData = (bookId: string | undefined) => {
    const [state, setState] = useState(getDefaultReaderDataState());

    const updateState = useCallback((partialState: Partial<ReaderDataState>) => {
        setState(prev => ({ ...prev, ...partialState }));
    }, []);

    const preloadNextChapter = useCallback(async () => {
        if (!bookId || !state.book) return;

        const nextChapterNumber = state.currentChapterNumber + 1;
        if (nextChapterNumber > state.book.totalChapters || state.preloadedChapters[nextChapterNumber]) {
            return;
        }

        try {
            const chapterResult = await getChapterByNumber({
                bookId,
                chapterNumber: nextChapterNumber
            });

            if (chapterResult.data?.chapter) {
                updateState({
                    preloadedChapters: {
                        ...state.preloadedChapters,
                        [nextChapterNumber]: chapterResult.data.chapter
                    }
                });
            }
        } catch {
            // Silently fail preloading
        }
    }, [bookId, state.book, state.currentChapterNumber, state.preloadedChapters, updateState]);

    const loadBook = useCallback(async () => {
        if (!bookId) {
            updateState({ error: 'No book ID provided', loading: false });
            return;
        }

        try {
            updateState({ loading: true, error: null });

            const bookResult = await getBook({ bookId });
            if (!bookResult.data || !bookResult.data.book) {
                updateState({ error: 'Book not found' });
                return;
            }
            updateState({ book: bookResult.data.book });

        } catch {
            updateState({ error: 'Failed to load book content' });
        } finally {
            updateState({ loading: false });
        }
    }, [bookId, updateState]);

    const loadChapter = useCallback(async () => {
        if (!bookId) return;

        // Check if chapter is already preloaded
        if (state.preloadedChapters[state.currentChapterNumber]) {
            updateState({ chapter: state.preloadedChapters[state.currentChapterNumber] });
            // Preload next chapter after current chapter loads
            setTimeout(() => {
                preloadNextChapter();
            }, 100);
            return;
        }

        try {
            const chapterResult = await getChapterByNumber({
                bookId,
                chapterNumber: state.currentChapterNumber
            });

            if (!chapterResult.data || !chapterResult.data.chapter) {
                updateState({ error: 'Chapter not found' });
                return;
            }
            updateState({ chapter: chapterResult.data.chapter });

            // Preload next chapter after current chapter loads
            setTimeout(() => {
                preloadNextChapter();
            }, 100);

        } catch {
            updateState({ error: 'Failed to load chapter content' });
        }
    }, [bookId, state.currentChapterNumber, state.preloadedChapters, updateState, preloadNextChapter]);

    const setCurrentChapterNumber = useCallback((chapterNumber: number) => {
        updateState({ currentChapterNumber: chapterNumber });
    }, [updateState]);

    // Load book on mount
    useEffect(() => {
        loadBook();
    }, [loadBook]);

    // Load chapter when chapter number changes
    useEffect(() => {
        loadChapter();
    }, [loadChapter]);

    return {
        book: state.book,
        chapter: state.chapter,
        currentChapterNumber: state.currentChapterNumber,
        loading: state.loading,
        error: state.error,
        setCurrentChapterNumber
    };
}; 