import { useCallback, useState } from 'react';
import { getChapterByNumber } from '../../../../apis/chapters/client';
import { offlineDB } from '../../../offline/offlineDB';
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

interface RuntimeState {
    book: BookClient;
    chapter: ChapterClient;
    currentChapterNumber: number;
    currentChunkIndex: number;
    chapterTransitionLoading: boolean;
    error: string | null;
}

interface UseReaderStateProps {
    initialBook: BookClient;
    initialChapter: ChapterClient;
    initialChapterNumber: number;
    initialChunkIndex: number;
}

export const useReaderState = ({
    initialBook,
    initialChapter,
    initialChapterNumber,
    initialChunkIndex
}: UseReaderStateProps) => {
    const { user } = useAuth();
    const bookId = initialBook._id;

    // Runtime state (no loading state for initial data)
    const [state, setState] = useState<RuntimeState>({
        book: initialBook,
        chapter: initialChapter,
        currentChapterNumber: initialChapterNumber,
        currentChunkIndex: initialChunkIndex,
        chapterTransitionLoading: false,
        error: null
    });

    console.log('🔵 [useReaderState] Initial state:', {
        initialChunkIndex,
        stateCurrentChunkIndex: state.currentChunkIndex
    });

    // Helpers for offline loading
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

    // Function to change chapter (for navigation)
    const setCurrentChapterNumber = useCallback(async (chapterNumber: number) => {
        if (!bookId || chapterNumber === state.currentChapterNumber) return;

        try {
            setState(prev => ({ ...prev, chapterTransitionLoading: true }));

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
        } catch (error) {
            console.error('Error loading chapter:', error);
            setState(prev => ({
                ...prev,
                error: 'Failed to load chapter',
                chapterTransitionLoading: false
            }));
        }
    }, [bookId, state.currentChapterNumber, loadChapterPreferOffline]);

    // Initialize hooks
    const userSettings = useUserSettings(user?.id || '');

    // Unified function to update chunk index
    const setCurrentChunkIndex = useCallback((chunkIndex: number) => {
        setState(prev => ({ ...prev, currentChunkIndex: chunkIndex }));
    }, []);

    // Build sentence map
    const sentenceMap = state.chapter ? buildSentenceMap(state.chapter) : { sentences: [], paragraphGroups: [], chunkToSentenceIndexMap: new Map() };

    // Initialize sentence audio controller with CURRENT state position (not initial)
    // This makes the controller a "controlled component" that always reflects state
    const sentenceAudio = useSentenceAudioController(
        state.chapter,
        userSettings.selectedVoice,
        userSettings.selectedProvider as TtsProvider,
        userSettings.playbackSpeed,
        userSettings.ttsEnabled,
        state.currentChunkIndex ?? 0,  // ← Use current state, not initial prop!
        0,
        userSettings.highlightMode,
        userSettings.wordSpeedOffset
    );

    console.log('🟢 [useReaderState] After audio controller init:', {
        stateCurrentChunkIndex: state.currentChunkIndex,
        controllerCurrentSentenceIndex: sentenceAudio.currentSentenceIndex,
        passedSentenceIndex: state.currentChunkIndex ?? 0
    });

    // NO SYNC EFFECT NEEDED!
    // The controller is now "controlled" by state, similar to controlled form inputs
    // When state changes → controller updates automatically
    // When user navigates → we update state directly via callbacks

    // Legacy audio adapter
    // Wrap controller methods to update state when user navigates
    const audioPlayback = {
        currentChunkIndex: state.currentChunkIndex ?? 0,
        currentWordIndex: sentenceAudio.currentWordIndex,
        isPlaying: sentenceAudio.isPlaying,
        isCurrentChunkLoading: sentenceAudio.isCurrentSentenceLoading,
        textChunks: sentenceAudio.sentences,
        handlePlay: sentenceAudio.play,
        handlePause: sentenceAudio.pause,
        handleWordClick: sentenceAudio.handleWordClick,
        handlePreviousChunk: () => {
            // Update state first, then let controller follow
            const newIndex = Math.max(0, (state.currentChunkIndex ?? 0) - 1);
            setCurrentChunkIndex(newIndex);
        },
        handleNextChunk: () => {
            // Update state first, then let controller follow
            const newIndex = Math.min(sentenceAudio.sentences.length - 1, (state.currentChunkIndex ?? 0) + 1);
            setCurrentChunkIndex(newIndex);
        },
        setCurrentChunkIndex: (index: number) => {
            // Update state, controller will follow
            setCurrentChunkIndex(index);
        },
        preloadChunk: sentenceAudio.preload,
        ttsError: sentenceAudio.ttsError ? { code: 'TTS_ERROR', message: sentenceAudio.ttsError, timestamp: new Date().toISOString() } : null,
        ttsServiceAvailable: sentenceAudio.ttsServiceAvailable,
        clearTtsError: sentenceAudio.clearError,
        retryFailedChunk: sentenceAudio.retryFailed,
        isChunkFailed: () => false
    };

    // Reading progress hook
    const readingProgress = useReadingProgress({
        userId: user?.id || '',
        bookId,
        currentChapterNumber: state.currentChapterNumber,
        currentChunkIndex: state.currentChunkIndex,
        isPlaying: audioPlayback.isPlaying,
        isInitialLoadComplete: true // Always true since data is pre-loaded
    });

    // Reading logs hook
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

    // Update playback speed
    const handleSpeedChange = useCallback(async (speed: number) => {
        await userSettings.handleSpeedChange(speed);
    }, [userSettings]);

    return {
        // Data
        book: state.book,
        chapter: state.chapter,
        loading: false, // Never loading for initial data
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
            setCurrentChunkIndex: audioPlayback.setCurrentChunkIndex,
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
            handleHighlightModeChange: userSettings.handleHighlightModeChange
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
        },

        // Sentence-level audio and data
        sentenceAudio: {
            controller: sentenceAudio,
            sentences: sentenceMap.sentences,
            paragraphGroups: sentenceMap.paragraphGroups
        }
    };
};

