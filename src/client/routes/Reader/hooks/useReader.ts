/**
 * @deprecated This hook has been split into useReaderData and useReaderState
 * for better separation of concerns and to support the data loader pattern.
 * 
 * - useReaderData: Handles initial data fetching (book, chapter, reading progress)
 * - useReaderState: Handles runtime state management (navigation, audio, settings)
 * 
 * See: ReaderDataLoader.tsx and ReaderUI.tsx for the new architecture
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from '../../../router';
import { getBook } from '../../../../apis/books/client';
import { getChapterByNumber } from '../../../../apis/chapters/client';
import { offlineDB } from '../../../offline/offlineDB';
import { getReadingProgress } from '../../../../apis/readingProgress/client';
import type { BookClient } from '../../../../apis/books/types';
import type { ChapterClient } from '../../../../apis/chapters/types';
import { useSentenceAudioController } from './useSentenceAudioController';
import { buildSentenceMap } from '../utils/sentences';
import type { TtsProvider } from '@/common/tts/ttsUtils';
import type { OfflineChapterRecord } from '../../../offline/offlineDB';
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

    // Helpers to avoid duplicated logic across initial load and chapter navigation
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

    const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

    const loadChapterPreferOffline = useCallback(async (
        bookIdParam: string,
        chapterNumber: number
    ): Promise<{ chapter: ChapterClient | null; fromLocal: boolean }> => {
        // When online, always fetch fresh data from network
        if (isOnline()) {
            const chapterResult = await getChapterByNumber({ bookId: bookIdParam, chapterNumber });
            return { chapter: chapterResult.data?.chapter || null, fromLocal: false };
        }

        // When offline, use cached chapter
        const localRec = await offlineDB.getChapterByBookAndNumber(bookIdParam, chapterNumber);
        if (localRec) {
            return { chapter: buildChapterFromLocal(localRec), fromLocal: true };
        }

        // Offline but no cached chapter available
        return { chapter: null, fromLocal: false };
    }, [buildChapterFromLocal]);


    // Get current book ID from user.activeBookId only
    const getCurrentBookId = useCallback(async (): Promise<string | null> => {
        try {
            const activeBookIdFromUser = user?.activeBookId;
            return activeBookIdFromUser || null;
        } catch (error) {
            console.error('Error getting current book ID:', error);
            return null;
        }
    }, [user?.activeBookId]);

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
    }, [queryBookId, isInitialLoading, user?.activeBookId, user?.id, navigate, getCurrentBookId]);

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
                            const savedChapter = progressResult.data.readingProgress.currentChapter;
                            const bookStartChapter = book.chapterStartNumber ?? 1;

                            // Validate saved chapter is valid for this book (>= chapterStartNumber)
                            if (savedChapter >= bookStartChapter) {
                                // Use saved progress
                                currentChapter = savedChapter;
                                currentChunk = progressResult.data.readingProgress.currentChunk;
                            } else {
                                // Invalid saved chapter (e.g., chapter 0 when book starts at 1), reset to start
                                console.warn(`Invalid saved chapter ${savedChapter} for book starting at chapter ${bookStartChapter}, resetting to start`);
                                currentChapter = bookStartChapter;
                                currentChunk = 0;
                            }
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
                    const { chapter: resolvedChapter, fromLocal } = await loadChapterPreferOffline(bookId, currentChapter);
                    if (!resolvedChapter) {
                        setState(prev => ({
                            ...prev,
                            error: fromLocal
                                ? 'Chapter not available offline. Please connect to the internet.'
                                : 'Chapter not found',
                            loading: false
                        }));
                        return;
                    }

                    setState({
                        book,
                        chapter: resolvedChapter,
                        currentChapterNumber: currentChapter,
                        currentChunkIndex: currentChunk,
                        loading: false,
                        chapterTransitionLoading: false,
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
    }, [bookId, bookIdResolved, queryChapter, queryChunk, user?.id, loadChapterPreferOffline]);

    // Function to change chapter (for navigation)
    const setCurrentChapterNumber = useCallback(async (chapterNumber: number) => {
        if (!bookId || chapterNumber === state.currentChapterNumber) return;

        try {
            setState(prev => ({ ...prev, chapterTransitionLoading: true }));

            if (bookId && chapterNumber !== undefined) {
                const { chapter: resolvedChapter } = await loadChapterPreferOffline(bookId, chapterNumber);
                if (resolvedChapter) {
                    setState(prev => ({
                        ...prev,
                        chapter: resolvedChapter,
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
    }, [bookId, state.currentChapterNumber, loadChapterPreferOffline]);

    // Initialize hooks only after we have the data
    const userSettings = useUserSettings();

    // Unified function to update chunk index (single source of truth in reader)
    const setCurrentChunkIndex = useCallback((chunkIndex: number) => {
        setState(prev => ({ ...prev, currentChunkIndex: chunkIndex }));
    }, []);

    // Build sentence map (sentence-level view) for progress tracking
    const sentenceMap = state.chapter ? buildSentenceMap(state.chapter) : { sentences: [], paragraphGroups: [], chunkToSentenceIndexMap: new Map() };

    // Initialize sentence audio controller (sentence indices = chunk indices now!)
    const sentenceAudio = useSentenceAudioController(
        state.chapter,
        userSettings.selectedVoice,
        userSettings.selectedProvider as TtsProvider,
        userSettings.playbackSpeed,
        userSettings.ttsEnabled,
        state.currentChunkIndex ?? 0,
        setCurrentChunkIndex,  // Callback for controller to update parent state
        0,
        userSettings.highlightMode,
        userSettings.wordSpeedOffset
    );

    // Sync state.currentChunkIndex with sentenceAudio.currentSentenceIndex
    // Prevent controller from overwriting initial loaded position
    const hasInitialized = useRef(false);
    const prevSentenceIndexRef = useRef(sentenceAudio.currentSentenceIndex);

    useEffect(() => {
        // On first load, initialize controller with loaded position
        if (!hasInitialized.current && state.currentChunkIndex !== null && !state.loading) {
            hasInitialized.current = true;
            if (state.currentChunkIndex !== 0 && state.currentChunkIndex !== sentenceAudio.currentSentenceIndex) {
                sentenceAudio.goToSentence(state.currentChunkIndex);
            }
            prevSentenceIndexRef.current = state.currentChunkIndex;
            return;
        }

        // After initialization, sync controller changes back to state
        if (hasInitialized.current && sentenceAudio.currentSentenceIndex !== prevSentenceIndexRef.current) {
            prevSentenceIndexRef.current = sentenceAudio.currentSentenceIndex;
            setCurrentChunkIndex(sentenceAudio.currentSentenceIndex);
        }
    }, [sentenceAudio.currentSentenceIndex, setCurrentChunkIndex, state.currentChunkIndex, state.loading, sentenceAudio]);

    // Legacy audio adapter: sentence index IS chunk index (simplified!)
    // Use state as source of truth for position
    const audioPlayback = {
        currentChunkIndex: state.currentChunkIndex ?? 0,
        currentWordIndex: sentenceAudio.currentWordIndex,
        isPlaying: sentenceAudio.isPlaying,
        isCurrentChunkLoading: sentenceAudio.isCurrentSentenceLoading,
        textChunks: sentenceAudio.sentences,
        handlePlay: sentenceAudio.play,
        handlePause: sentenceAudio.pause,
        handleWordClick: sentenceAudio.handleWordClick,
        handlePreviousChunk: sentenceAudio.prevSentence,
        handleNextChunk: sentenceAudio.nextSentence,
        setCurrentChunkIndex: (index: number) => {
            sentenceAudio.goToSentence(index);
            setCurrentChunkIndex(index);
        },
        preloadChunk: sentenceAudio.preload,
        ttsError: sentenceAudio.ttsError ? { code: 'TTS_ERROR', message: sentenceAudio.ttsError, timestamp: new Date().toISOString() } : null,
        ttsServiceAvailable: sentenceAudio.ttsServiceAvailable,
        clearTtsError: sentenceAudio.clearError,
        retryFailedChunk: sentenceAudio.retryFailed,
        isChunkFailed: () => false
    };

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
        currentChunkIndex: sentenceAudio.currentSentenceIndex,
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
            currentChunkIndex: audioPlayback.currentChunkIndex,
            currentWordIndex: audioPlayback.currentWordIndex,
            isPlaying: audioPlayback.isPlaying,
            isCurrentChunkLoading: audioPlayback.isCurrentChunkLoading,
            textChunks: audioPlayback.textChunks,
            handlePlay: audioPlayback.handlePlay,
            handlePause: audioPlayback.handlePause,
            handleWordClick: audioPlayback.handleWordClick,
            handlePreviousChunk: audioPlayback.handlePreviousChunk,
            handleNextChunk: audioPlayback.handleNextChunk,
            setCurrentChunkIndex: audioPlayback.setCurrentChunkIndex, // This one calls controller + setState
            preloadChunk: audioPlayback.preloadChunk,
            ttsError: audioPlayback.ttsError,
            ttsServiceAvailable: audioPlayback.ttsServiceAvailable,
            clearTtsError: audioPlayback.clearTtsError,
            retryFailedChunk: audioPlayback.retryFailedChunk,
            isChunkFailed: audioPlayback.isChunkFailed
        },

        // User settings
        settings: {
            ttsEnabled: userSettings.ttsEnabled,
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
            highlightMode: userSettings.highlightMode,
            wordHighlightingEnabled: userSettings.wordHighlightingEnabled,
            autoFontScaling: userSettings.autoFontScaling,
            settingsLoaded: userSettings.settingsLoaded,
            handleSpeedChange,
            handleTtsEnabledChange: userSettings.handleTtsEnabledChange,
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
            handleResetToDefaults: userSettings.handleResetToDefaults,
            handleWordHighlightingEnabledChange: userSettings.handleWordHighlightingEnabledChange,
            handleHighlightModeChange: userSettings.handleHighlightModeChange,
            handleAutoFontScalingChange: userSettings.handleAutoFontScalingChange
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
            setCurrentChapterNumber,
            mapParagraphToFirstSentenceIndex: (paragraphIndex: number) => {
                const group = sentenceMap.paragraphGroups.find(g => g.paragraphIndex === paragraphIndex);
                return group ? group.startSentenceIndex : 0;
            }
        }
        ,
        // Sentence-level audio and data (Phase 4 integration surface)
        sentenceAudio: {
            controller: sentenceAudio,
            sentences: sentenceMap.sentences,
            paragraphGroups: sentenceMap.paragraphGroups
        }
    };
};


