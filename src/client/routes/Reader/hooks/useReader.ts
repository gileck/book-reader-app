import { useCallback, useState, useEffect } from 'react';
import { useRouter } from '../../../router';
import { getBook, getBooks } from '../../../../apis/books/client';
import { getChapterByNumber } from '../../../../apis/chapters/client';
import { getReadingProgress } from '../../../../apis/readingProgress/client';
import type { BookClient } from '../../../../apis/books/types';
import type { ChapterClient } from '../../../../apis/chapters/types';
import { useAudioPlayback } from './useAudioPlayback';
import { useUserSettings } from './useUserSettings';
import { useBookmarks } from './useBookmarks';
import { useReadingProgress } from './useReadingProgress';
import { useReadingLogs } from './useReadingLogs';

const userId = '675e8c84f891e8b9da2b8c28'; // Hard-coded for now

interface ReaderState {
    book: BookClient | null;
    chapter: ChapterClient | null;
    currentChapterNumber: number | null;
    currentChunkIndex: number | null;
    loading: boolean;
    error: string | null;
}

export const useReader = () => {
    const { queryParams } = useRouter();
    const { bookId: queryBookId, chapter: queryChapter, chunk: queryChunk } = queryParams;

    // Use bookId from query params, or fall back to active book from localStorage
    const [bookId, setBookId] = useState<string | undefined>(queryBookId);
    const [bookIdResolved, setBookIdResolved] = useState<boolean>(false);

    // Main reader state
    const [state, setState] = useState<ReaderState>({
        book: null,
        chapter: null,
        currentChapterNumber: null,
        currentChunkIndex: null,
        loading: true,
        error: null
    });

    // Get current book ID from reading status if no book ID provided
    const getCurrentBookId = async (): Promise<string | null> => {
        try {
            // First try localStorage
            const activeBookId = localStorage.getItem('activeBookId');
            if (activeBookId) {
                return activeBookId;
            }

            // If no activeBookId, get all books and find the most recently read one
            const booksResult = await getBooks({});
            if (!booksResult.data?.books) {
                return null;
            }

            const books = booksResult.data.books;
            let mostRecentBook: { bookId: string; lastReadAt: Date } | null = null;

            // Check reading progress for each book to find the most recently read
            for (const book of books) {
                try {
                    const progressResult = await getReadingProgress({
                        userId,
                        bookId: book._id
                    });

                    if (progressResult.data?.readingProgress) {
                        const lastReadAt = new Date(progressResult.data.readingProgress.lastReadAt);
                        if (!mostRecentBook || lastReadAt > mostRecentBook.lastReadAt) {
                            mostRecentBook = {
                                bookId: book._id,
                                lastReadAt
                            };
                        }
                    }
                } catch (error) {
                    // Continue if we can't get progress for this book
                    console.warn(`Failed to get progress for book ${book._id}:`, error);
                }
            }

            if (mostRecentBook) {
                // Set this as the active book in localStorage for future use
                localStorage.setItem('activeBookId', mostRecentBook.bookId);
                return mostRecentBook.bookId;
            }

            // If no reading progress found, return the first book
            if (books.length > 0) {
                localStorage.setItem('activeBookId', books[0]._id);
                return books[0]._id;
            }

            return null;
        } catch (error) {
            console.error('Error getting current book ID:', error);
            return null;
        }
    };

    // Handle Active Book concept
    useEffect(() => {
        const resolveBookId = async () => {
            if (queryBookId) {
                setBookId(queryBookId);
                setBookIdResolved(true);
            } else {
                const currentBookId = await getCurrentBookId();
                setBookId(currentBookId || undefined);
                setBookIdResolved(true);
            }
        };

        resolveBookId();
    }, [queryBookId]);

    // Sequential loading flow
    useEffect(() => {
        const loadReaderData = async () => {
            // Wait until we've attempted to resolve the book ID
            if (!bookIdResolved) {
                return;
            }

            if (!bookId) {
                setState(prev => ({
                    ...prev,
                    error: 'No books found',
                    loading: false
                }));
                return;
            }

            try {
                // Step 1: Set loading to true
                setState(prev => ({
                    ...prev,
                    loading: true,
                    error: null
                }));

                // Step 2: Load book data first to get chapterStartNumber
                const bookResult = await getBook({ bookId });
                if (!bookResult.data || !bookResult.data.book) {
                    setState(prev => ({
                        ...prev,
                        error: 'Book not found',
                        loading: false
                    }));
                    return;
                }

                const book = bookResult.data.book;

                // Step 3: Determine chapter and chunk position
                let currentChapter: number;
                let currentChunk: number;

                // First check URL parameters (highest priority)
                if (queryChapter && queryChunk) {
                    currentChapter = parseInt(queryChapter, 10);
                    currentChunk = parseInt(queryChunk, 10);
                } else {
                    // Wait for reading progress and use that data
                    try {
                        const progressResult = await getReadingProgress({ userId, bookId });
                        if (progressResult.data?.success && progressResult.data.readingProgress) {
                            // Use saved progress
                            currentChapter = progressResult.data.readingProgress.currentChapter;
                            currentChunk = progressResult.data.readingProgress.currentChunk;
                        } else {
                            // No progress found, start from book's chapterStartNumber
                            currentChapter = book.chapterStartNumber ?? 1;
                            currentChunk = 0;
                        }
                    } catch (error) {
                        console.error('Error loading reading progress:', error);
                        // Fallback to book's chapterStartNumber
                        currentChapter = book.chapterStartNumber ?? 1;
                        currentChunk = 0;
                    }
                }

                // Step 4: Load the determined chapter
                if (bookId) {
                    const chapterResult = await getChapterByNumber({
                        bookId,
                        chapterNumber: currentChapter
                    });

                    if (!chapterResult.data || !chapterResult.data.chapter) {
                        setState(prev => ({
                            ...prev,
                            error: 'Chapter not found',
                            loading: false
                        }));
                        return;
                    }

                    // Step 5: Set all data to state
                    setState({
                        book: book,
                        chapter: chapterResult.data.chapter,
                        currentChapterNumber: currentChapter,
                        currentChunkIndex: currentChunk,
                        loading: false,
                        error: null
                    });
                } else {
                    setState(prev => ({
                        ...prev,
                        error: 'Book ID is required',
                        loading: false
                    }));
                    return;
                }

            } catch (error) {
                console.error('Error loading reader data:', error);
                setState(prev => ({
                    ...prev,
                    error: 'Failed to load book content',
                    loading: false
                }));
            }
        };

        loadReaderData();
    }, [bookId, bookIdResolved, userId, queryChapter, queryChunk]);

    // Function to change chapter (for navigation)
    const setCurrentChapterNumber = useCallback(async (chapterNumber: number) => {
        if (!bookId || chapterNumber === state.currentChapterNumber) return;

        try {
            setState(prev => ({ ...prev, loading: true }));

            if (bookId && chapterNumber !== undefined) {
                const chapterResult = await getChapterByNumber({
                    bookId,
                    chapterNumber
                });

                if (chapterResult.data?.chapter) {
                    setState(prev => ({
                        ...prev,
                        chapter: chapterResult.data!.chapter,
                        currentChapterNumber: chapterNumber,
                        currentChunkIndex: 0, // Reset to beginning of new chapter
                        loading: false
                    }));
                } else {
                    setState(prev => ({
                        ...prev,
                        error: 'Chapter not found',
                        loading: false
                    }));
                }
            } else {
                setState(prev => ({
                    ...prev,
                    error: 'Book ID and chapter number are required',
                    loading: false
                }));
            }
        } catch (error) {
            console.error('Error loading chapter:', error);
            setState(prev => ({
                ...prev,
                error: 'Failed to load chapter',
                loading: false
            }));
        }
    }, [bookId, state.currentChapterNumber]);

    // Initialize hooks only after we have the data
    const userSettings = useUserSettings(userId);

    // Unified function to update chunk index (single source of truth in reader)
    const setCurrentChunkIndex = useCallback((chunkIndex: number) => {
        setState(prev => ({ ...prev, currentChunkIndex: chunkIndex }));
    }, []);

    // Initialize audio playback with reader state as single source of truth
    const audioPlayback = useAudioPlayback(
        state.chapter,
        state.currentChunkIndex,
        userSettings.selectedVoice,
        userSettings.selectedProvider,
        userSettings.playbackSpeed,
        userSettings.wordSpeedOffset,
        state.currentChapterNumber || 1,
        setCurrentChunkIndex // Callback for audio to update reader state
    );

    // Reading progress hook - now just for tracking changes and saving
    const readingProgress = useReadingProgress({
        userId,
        bookId,
        currentChapterNumber: state.currentChapterNumber,
        currentChunkIndex: state.currentChunkIndex,
        isPlaying: audioPlayback.isPlaying,
        isInitialLoadComplete: !state.loading && state.chapter !== null && state.currentChapterNumber !== null && state.currentChunkIndex !== null
    });

    // Reading logs hook - logs every chunk that is played
    useReadingLogs({
        userId,
        bookId,
        chapter: state.chapter,
        currentChunkIndex: state.currentChunkIndex,
        isPlaying: audioPlayback.isPlaying
    });

    const bookmarks = useBookmarks(
        bookId,
        state.chapter,
        state.currentChunkIndex
    );

    // Chapter navigation functions
    const handlePreviousChapter = useCallback(async () => {
        // Try to navigate to the previous chapter
        if (state.currentChapterNumber === null) return;
        const previousChapterNumber = state.currentChapterNumber - 1;
        const minChapterNumber = state.book?.chapterStartNumber ?? 1;
        if (previousChapterNumber >= minChapterNumber) {
            setCurrentChapterNumber(previousChapterNumber);
            audioPlayback.handlePause();
        }
    }, [state.currentChapterNumber, state.book?.chapterStartNumber, setCurrentChapterNumber, audioPlayback]);

    const handleNextChapter = useCallback(() => {
        if (state.book && state.currentChapterNumber !== null && state.currentChapterNumber < state.book.totalChapters) {
            setCurrentChapterNumber(state.currentChapterNumber + 1);
            audioPlayback.handlePause();
        }
    }, [state.book, state.currentChapterNumber, setCurrentChapterNumber, audioPlayback]);

    const handleNavigateToBookmark = useCallback((chapterNumber: number, chunkIndex: number) => {
        if (!state.chapter) return;

        if (chapterNumber === state.chapter.chapterNumber) {
            audioPlayback.handlePause();
            setCurrentChunkIndex(chunkIndex);
        } else {
            setCurrentChapterNumber(chapterNumber);
            setCurrentChunkIndex(chunkIndex);
            audioPlayback.handlePause();
        }
    }, [state.chapter, setCurrentChapterNumber, setCurrentChunkIndex, audioPlayback]);

    // Update playback speed in audio when speed changes
    const handleSpeedChange = useCallback(async (speed: number) => {
        await userSettings.handleSpeedChange(speed);
        // The audio playback hook will automatically use the new speed
    }, [userSettings]);

    return {
        // Data
        book: state.book,
        chapter: state.chapter,
        loading: state.loading,
        error: state.error,
        currentChapterNumber: state.currentChapterNumber || 1,

        // Progress tracking
        progress: {
            chapterProgress: readingProgress.progressData.chapterProgress,
            bookProgress: readingProgress.progressData.bookProgress,
            totalReadingTime: readingProgress.progressData.totalReadingTime,
            currentSessionTime: readingProgress.getCurrentSessionTime(),
            sessionsCount: readingProgress.progressData.sessionsCount,
            alert: readingProgress.alert,
            closeAlert: readingProgress.closeAlert
        },

        // Audio playback
        audio: {
            currentChunkIndex: state.currentChunkIndex || 0,
            currentWordIndex: audioPlayback.currentWordIndex,
            isPlaying: audioPlayback.isPlaying,
            isCurrentChunkLoading: audioPlayback.isCurrentChunkLoading,
            textChunks: audioPlayback.textChunks,
            handlePlay: audioPlayback.handlePlay,
            handlePause: audioPlayback.handlePause,
            handleWordClick: audioPlayback.handleWordClick,
            handlePreviousChunk: audioPlayback.handlePreviousChunk,
            handleNextChunk: audioPlayback.handleNextChunk,
            setCurrentChunkIndex: setCurrentChunkIndex,
            preloadChunk: audioPlayback.preloadChunk,
            ttsError: audioPlayback.ttsError,
            ttsServiceAvailable: audioPlayback.ttsServiceAvailable,
            clearTtsError: audioPlayback.clearTtsError,
            retryFailedChunk: audioPlayback.retryFailedChunk,
            isChunkFailed: audioPlayback.isChunkFailed
        },

        // User settings
        settings: {
            playbackSpeed: userSettings.playbackSpeed,
            selectedVoice: userSettings.selectedVoice,
            selectedProvider: userSettings.selectedProvider,
            wordSpeedOffset: userSettings.wordSpeedOffset,
            speedModalOpen: userSettings.speedModalOpen,
            themeModalOpen: userSettings.themeModalOpen,
            theme: userSettings.theme,
            highlightColor: userSettings.highlightColor,
            sentenceHighlightColor: userSettings.sentenceHighlightColor,
            fontSize: userSettings.fontSize,
            lineHeight: userSettings.lineHeight,
            fontFamily: userSettings.fontFamily,
            textColor: userSettings.textColor,
            settingsLoaded: userSettings.settingsLoaded,
            handleSpeedChange,
            handleVoiceChange: userSettings.handleVoiceChange,
            handleProviderChange: userSettings.handleProviderChange,
            handleWordTimingOffsetChange: userSettings.handleWordTimingOffsetChange,
            handlePreviewVoice: userSettings.handlePreviewVoice,
            handleSpeedSettings: userSettings.handleSpeedSettings,
            handleCloseSpeedModal: userSettings.handleCloseSpeedModal,
            handleSettings: userSettings.handleSettings,
            handleCloseThemeModal: userSettings.handleCloseThemeModal,
            handleThemeChange: userSettings.handleThemeChange,
            handleHighlightColorChange: userSettings.handleHighlightColorChange,
            handleSentenceHighlightColorChange: userSettings.handleSentenceHighlightColorChange,
            handleFontSizeChange: userSettings.handleFontSizeChange,
            handleLineHeightChange: userSettings.handleLineHeightChange,
            handleFontFamilyChange: userSettings.handleFontFamilyChange,
            handleTextColorChange: userSettings.handleTextColorChange,
            handleResetToDefaults: userSettings.handleResetToDefaults
        },

        // Bookmarks
        bookmarks: {
            bookmarks: bookmarks.bookmarks,
            isBookmarked: bookmarks.isBookmarked,
            handleBookmark: bookmarks.handleBookmark,
            isChunkBookmarked: bookmarks.isChunkBookmarked
        },

        // Navigation
        navigation: {
            handlePreviousChapter,
            handleNextChapter,
            handleNavigateToBookmark,
            setCurrentChunkIndex,
            setCurrentChapterNumber
        }
    };
}; 