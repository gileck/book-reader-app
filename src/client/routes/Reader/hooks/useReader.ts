//TODO: fix code duplication in setCurrentChapterNumber and loadReaderData

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from '../../../router';
import { getBook } from '../../../../apis/books/client';
import { getChapterByNumber } from '../../../../apis/chapters/client';
import { offlineDB } from '../../../offline/offlineDB';
import { getReadingProgress } from '../../../../apis/readingProgress/client';
import type { BookClient } from '../../../../apis/books/types';
import type { ChapterClient } from '../../../../apis/chapters/types';
import { useAudioPlayback } from './useAudioPlayback';
import { useUserSettings } from './useUserSettings';
import { useBookmarks } from './useBookmarks';
import { useReadingProgress } from './useReadingProgress';
import { useReadingLogs } from './useReadingLogs';
import { useAuth } from '@/client/context/AuthContext';
import { apiUpdateProfile } from '@/apis/auth/client';

// Read user from auth context

interface ReaderState {
    book: BookClient | null;
    chapter: ChapterClient | null;
    currentChapterNumber: number | null;
    currentChunkIndex: number | null;
    loading: boolean;
    chapterTransitionLoading: boolean;
    error: string | null;
}

export const useReader = () => {
    const { queryParams, navigate } = useRouter();
    const { user, isInitialLoading } = useAuth();
    const { bookId: queryBookId, chapter: queryChapter, chunk: queryChunk } = queryParams;

    // Use bookId from query params, or fall back to active book from user document
    const [bookId, setBookId] = useState<string | undefined>(queryBookId);
    const [bookIdResolved, setBookIdResolved] = useState<boolean>(false);

    // Main reader state
    const [state, setState] = useState<ReaderState>({
        book: null,
        chapter: null,
        currentChapterNumber: null,
        currentChunkIndex: null,
        loading: true,
        chapterTransitionLoading: false,
        error: null
    });

    // Get current book ID from user.activeBookId only
    const getCurrentBookId = async (): Promise<string | null> => {
        try {
            const activeBookIdFromUser = user?.activeBookId;
            return activeBookIdFromUser || null;
        } catch (error) {
            console.error('Error getting current book ID:', error);
            return null;
        }
    };

    // Handle Active Book concept
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
    }, [queryBookId, isInitialLoading, user?.activeBookId, navigate]);

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
                        const progressResult = await getReadingProgress({ userId: user?.id || '', bookId });
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

                // Step 4: Load the determined chapter (prefer offline when available; fall back to network)
                if (bookId) {
                    // Try local first
                    const localRec = await offlineDB.getChapterByBookAndNumber(bookId, currentChapter);
                    if (localRec) {
                        const localChapter: ChapterClient = {
                            _id: localRec.chapterId,
                            bookId: localRec.bookId,
                            chapterNumber: localRec.chapterNumber,
                            title: localRec.title,
                            content: localRec.content as any,
                            wordCount: (localRec.content as any)?.chunks?.length || 0,
                            createdAt: localRec.downloadedAt,
                            updatedAt: localRec.contentVersion || localRec.downloadedAt
                        };
                        setState({
                            book,
                            chapter: localChapter,
                            currentChapterNumber: currentChapter,
                            currentChunkIndex: currentChunk,
                            loading: false,
                            chapterTransitionLoading: false,
                            error: null
                        });
                        // If online, refresh from network in background
                        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
                            try {
                                const chapterResult = await getChapterByNumber({ bookId, chapterNumber: currentChapter });
                                if (chapterResult.data?.chapter) {
                                    setState(prev => ({
                                        ...prev,
                                        chapter: chapterResult.data!.chapter
                                    }));
                                }
                            } catch { }
                        }
                    } else {
                        // No local copy → fetch network
                        const chapterResult = await getChapterByNumber({ bookId, chapterNumber: currentChapter });
                        const chapterData = chapterResult.data?.chapter || null;
                        if (!chapterData) {
                            setState(prev => ({
                                ...prev,
                                error: 'Chapter not found',
                                loading: false
                            }));
                            return;
                        }
                        setState({
                            book,
                            chapter: chapterData,
                            currentChapterNumber: currentChapter,
                            currentChunkIndex: currentChunk,
                            loading: false,
                            chapterTransitionLoading: false,
                            error: null
                        });
                    }
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
    }, [bookId, bookIdResolved, queryChapter, queryChunk]);

    // Function to change chapter (for navigation)
    const setCurrentChapterNumber = useCallback(async (chapterNumber: number) => {
        if (!bookId || chapterNumber === state.currentChapterNumber) return;

        try {
            setState(prev => ({ ...prev, chapterTransitionLoading: true }));

            if (bookId && chapterNumber !== undefined) {
                const localRec = await offlineDB.getChapterByBookAndNumber(bookId, chapterNumber);
                if (localRec) {
                    const localChapter: ChapterClient = {
                        _id: localRec.chapterId,
                        bookId: localRec.bookId,
                        chapterNumber: localRec.chapterNumber,
                        title: localRec.title,
                        content: localRec.content as any,
                        wordCount: (localRec.content as any)?.chunks?.length || 0,
                        createdAt: localRec.downloadedAt,
                        updatedAt: localRec.contentVersion || localRec.downloadedAt
                    };
                    setState(prev => ({
                        ...prev,
                        chapter: localChapter,
                        currentChapterNumber: chapterNumber,
                        currentChunkIndex: 0,
                        chapterTransitionLoading: false
                    }));
                    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
                        try {
                            const chapterResult = await getChapterByNumber({ bookId, chapterNumber });
                            if (chapterResult.data?.chapter) {
                                setState(prev => ({ ...prev, chapter: chapterResult.data!.chapter }));
                            }
                        } catch { }
                    }
                } else {
                    const chapterResult = await getChapterByNumber({ bookId, chapterNumber });
                    const chapterData = chapterResult.data?.chapter || null;
                    if (chapterData) {
                        setState(prev => ({
                            ...prev,
                            chapter: chapterData,
                            currentChapterNumber: chapterNumber,
                            currentChunkIndex: 0,
                            chapterTransitionLoading: false
                        }));
                    } else {
                        setState(prev => ({
                            ...prev,
                            error: 'Chapter not found',
                            chapterTransitionLoading: false
                        }));
                    }
                }
            } else {
                setState(prev => ({
                    ...prev,
                    error: 'Book ID and chapter number are required',
                    chapterTransitionLoading: false
                }));
            }
        } catch (error) {
            console.error('Error loading chapter:', error);
            setState(prev => ({
                ...prev,
                error: 'Failed to load chapter',
                chapterTransitionLoading: false
            }));
        }
    }, [bookId, state.currentChapterNumber]);

    // Initialize hooks only after we have the data
    const userSettings = useUserSettings(user?.id || '');

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
        userId: user?.id || '',
        bookId,
        currentChapterNumber: state.currentChapterNumber,
        currentChunkIndex: state.currentChunkIndex,
        isPlaying: audioPlayback.isPlaying,
        isInitialLoadComplete: !state.loading && state.chapter !== null && state.currentChapterNumber !== null && state.currentChunkIndex !== null
    });

    // Reading logs hook - logs every chunk that is played
    useReadingLogs({
        userId: user?.id || '',
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
        chapterTransitionLoading: state.chapterTransitionLoading,
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


