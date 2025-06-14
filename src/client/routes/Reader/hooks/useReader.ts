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
    currentChapterNumber: number;
    currentChunkIndex: number;
    loading: boolean;
    error: string | null;
}

export const useReader = () => {
    const { queryParams } = useRouter();
    const { bookId: queryBookId } = queryParams;

    // Use bookId from query params, or fall back to active book from localStorage
    const [bookId, setBookId] = useState<string | undefined>(queryBookId);
    const [bookIdResolved, setBookIdResolved] = useState<boolean>(false);

    // Main reader state
    const [state, setState] = useState<ReaderState>({
        book: null,
        chapter: null,
        currentChapterNumber: 1,
        currentChunkIndex: 0,
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

                // Step 2: Load reading progress to get current position
                let currentChapter = 0;
                let currentChunk = 0;

                try {
                    const progressResult = await getReadingProgress({ userId, bookId });
                    if (progressResult.data?.success && progressResult.data.readingProgress) {
                        currentChapter = progressResult.data.readingProgress.currentChapter;
                        currentChunk = progressResult.data.readingProgress.currentChunk;
                    }
                } catch (error) {
                    console.error('Error loading reading progress, using defaults:', error);
                    // Continue with defaults (chapter 1, chunk 0)
                }

                // Step 3: Load book data
                const bookResult = await getBook({ bookId });
                if (!bookResult.data || !bookResult.data.book) {
                    setState(prev => ({
                        ...prev,
                        error: 'Book not found',
                        loading: false
                    }));
                    return;
                }

                // Step 4: Check if chapter 0 (introduction) exists
                let startingChapter = currentChapter;

                // If we're starting from the beginning (no saved progress), check for chapter 0
                if (currentChapter === 1 && currentChunk === 0 && bookId) {
                    try {
                        const chapterZeroResult = await getChapterByNumber({
                            bookId,
                            chapterNumber: 0
                        });

                        if (chapterZeroResult.data?.chapter) {
                            // Chapter 0 exists, start from there
                            startingChapter = 0;
                        }
                    } catch {
                        console.log('No chapter 0 (introduction) found, starting from chapter 1');
                        // Continue with chapter 1
                    }
                }

                // Step 5: Load the correct chapter based on reading progress or chapter 0 check
                if (bookId) {
                    const chapterResult = await getChapterByNumber({
                        bookId,
                        chapterNumber: startingChapter
                    });

                    if (!chapterResult.data || !chapterResult.data.chapter) {
                        setState(prev => ({
                            ...prev,
                            error: 'Chapter not found',
                            loading: false
                        }));
                        return;
                    }

                    // Step 6: Set all data to state
                    setState({
                        book: bookResult.data.book,
                        chapter: chapterResult.data.chapter,
                        currentChapterNumber: startingChapter,
                        currentChunkIndex: startingChapter === currentChapter ? currentChunk : 0,
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
    }, [bookId, bookIdResolved, userId]);

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

    // Function to update chunk index
    const setCurrentChunkIndex = useCallback((chunkIndex: number) => {
        setState(prev => ({ ...prev, currentChunkIndex: chunkIndex }));
    }, []);

    // Initialize hooks only after we have the data
    const userSettings = useUserSettings(userId);

    // Initialize audio playback (will handle null chapter gracefully)
    const audioPlayback = useAudioPlayback(
        state.chapter,
        userSettings.selectedVoice,
        userSettings.playbackSpeed,
        userSettings.wordSpeedOffset,
        state.currentChapterNumber,
        setCurrentChunkIndex,
        userSettings.highlightColor,
        userSettings.sentenceHighlightColor
    );

    // Reading progress hook - now just for tracking changes and saving
    const readingProgress = useReadingProgress({
        userId,
        bookId,
        currentChapterNumber: state.currentChapterNumber,
        currentChunkIndex: state.currentChunkIndex,
        isPlaying: audioPlayback.isPlaying
    });

    // Reading logs hook - logs every chunk that is played
    useReadingLogs({
        userId,
        bookId,
        chapter: state.chapter,
        currentChunkIndex: audioPlayback.currentChunkIndex,
        isPlaying: audioPlayback.isPlaying
    });

    // Sync audio playback chunk index with our state
    if (audioPlayback.currentChunkIndex !== state.currentChunkIndex && !state.loading) {
        audioPlayback.setCurrentChunkIndex(state.currentChunkIndex);
    }

    const bookmarks = useBookmarks(
        bookId,
        state.chapter,
        state.currentChunkIndex
    );

    // Chapter navigation functions
    const handlePreviousChapter = useCallback(async () => {
        // Try to navigate to the previous chapter
        const previousChapterNumber = state.currentChapterNumber - 1;
        const minChapterNumber = state.book?.chapterStartNumber ?? 1;
        if (previousChapterNumber >= minChapterNumber) {
            setCurrentChapterNumber(previousChapterNumber);
            audioPlayback.handlePause();
        }
    }, [state.currentChapterNumber, state.book?.chapterStartNumber, setCurrentChapterNumber, audioPlayback]);

    const handleNextChapter = useCallback(() => {
        if (state.book && state.currentChapterNumber < state.book.totalChapters) {
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
        currentChapterNumber: state.currentChapterNumber,

        // Progress tracking
        progress: {
            chapterProgress: readingProgress.progressData.chapterProgress,
            bookProgress: readingProgress.progressData.bookProgress,
            totalReadingTime: readingProgress.progressData.totalReadingTime,
            currentSessionTime: readingProgress.getCurrentSessionTime(),
            sessionsCount: readingProgress.progressData.sessionsCount
        },

        // Audio playback
        audio: {
            currentChunkIndex: state.currentChunkIndex,
            currentWordIndex: audioPlayback.currentWordIndex,
            isPlaying: audioPlayback.isPlaying,
            isCurrentChunkLoading: audioPlayback.isCurrentChunkLoading,
            textChunks: audioPlayback.textChunks,
            handlePlay: audioPlayback.handlePlay,
            handlePause: audioPlayback.handlePause,
            handleWordClick: audioPlayback.handleWordClick,
            handlePreviousChunk: audioPlayback.handlePreviousChunk,
            handleNextChunk: audioPlayback.handleNextChunk,
            setCurrentChunkIndex: audioPlayback.setCurrentChunkIndex,
            preloadChunk: audioPlayback.preloadChunk,
            getWordStyle: audioPlayback.getWordStyle,
            getSentenceStyle: audioPlayback.getSentenceStyle,
            getWordClassName: audioPlayback.getWordClassName,
            getSentenceClassName: audioPlayback.getSentenceClassName
        },

        // User settings
        settings: {
            playbackSpeed: userSettings.playbackSpeed,
            selectedVoice: userSettings.selectedVoice,
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
            handleSpeedChange,
            handleVoiceChange: userSettings.handleVoiceChange,
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
            handleTextColorChange: userSettings.handleTextColorChange
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