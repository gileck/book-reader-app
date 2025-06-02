import { useCallback, useState, useEffect } from 'react';
import { useRouter } from '../../../router';
import { useReaderData } from './useReaderData';
import { useAudioPlayback } from './useAudioPlayback';
import { useUserSettings } from './useUserSettings';
import { useBookmarks } from './useBookmarks';
import { useReadingProgress } from './useReadingProgress';

const userId = '675e8c84f891e8b9da2b8c28'; // Hard-coded for now

export const useReader = () => {
    const { queryParams } = useRouter();
    const { bookId: queryBookId } = queryParams;

    // Use bookId from query params, or fall back to active book from localStorage
    const [bookId, setBookId] = useState<string | undefined>(queryBookId);

    // Track current chunk index separately to coordinate between hooks
    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

    // Handle Active Book concept
    useEffect(() => {
        if (queryBookId) {
            setBookId(queryBookId);
        } else {
            // No bookId in query params, use active book from localStorage
            const activeBookId = localStorage.getItem('activeBookId');
            if (activeBookId) {
                setBookId(activeBookId);
            }
        }
    }, [queryBookId]);

    // Initialize domain hooks
    const readerData = useReaderData(bookId);
    const userSettings = useUserSettings(userId);

    // Initialize audio playback (will handle null chapter gracefully)
    const audioPlayback = useAudioPlayback(
        readerData.chapter,
        userSettings.selectedVoice,
        userSettings.playbackSpeed,
        userSettings.wordSpeedOffset,
        readerData.currentChapterNumber,
        setCurrentChunkIndex,
        userSettings.highlightColor,
        userSettings.sentenceHighlightColor
    );

    // Track audio playing state for session tracking (for readingProgress hook)

    // Reading progress hook - initialize after audio playback
    const readingProgress = useReadingProgress({
        userId,
        bookId,
        currentChapterNumber: readerData.currentChapterNumber,
        currentChunkIndex,
        setCurrentChapterNumber: readerData.setCurrentChapterNumber,
        setCurrentChunkIndex,
        onProgressLoaded: (chapterNumber, chunkIndex) => {
            // Preload audio for the saved chunk position when available
            if (!readingProgress.isLoadingProgress) {
                audioPlayback.preloadChunk(chunkIndex);
                audioPlayback.preloadChunk(chunkIndex + 1);
            }
        },
        isPlaying: audioPlayback.isPlaying // Pass playing state for session tracking
    });

    // Sync audio playback chunk index with our coordinated state
    if (audioPlayback.currentChunkIndex !== currentChunkIndex && !readingProgress.isLoadingProgress) {
        audioPlayback.setCurrentChunkIndex(currentChunkIndex);
    }

    const bookmarks = useBookmarks(
        bookId,
        readerData.chapter,
        currentChunkIndex
    );

    // Chapter navigation functions that coordinate between hooks
    const handlePreviousChapter = useCallback(() => {
        if (readerData.currentChapterNumber > 1) {
            readerData.setCurrentChapterNumber(readerData.currentChapterNumber - 1);
            setCurrentChunkIndex(0);
            audioPlayback.handlePause();
        }
    }, [readerData, audioPlayback]);

    const handleNextChapter = useCallback(() => {
        if (readerData.book && readerData.currentChapterNumber < readerData.book.totalChapters) {
            readerData.setCurrentChapterNumber(readerData.currentChapterNumber + 1);
            setCurrentChunkIndex(0);
            audioPlayback.handlePause();
        }
    }, [readerData, audioPlayback]);

    const handleNavigateToBookmark = useCallback((chapterNumber: number, chunkIndex: number) => {
        if (!readerData.chapter) return;

        if (chapterNumber === readerData.chapter.chapterNumber) {
            audioPlayback.handlePause();
            setCurrentChunkIndex(chunkIndex);
        } else {
            readerData.setCurrentChapterNumber(chapterNumber);
            setCurrentChunkIndex(chunkIndex);
            audioPlayback.handlePause();
        }
    }, [readerData, audioPlayback]);

    // Update playback speed in audio when speed changes
    const handleSpeedChange = useCallback(async (speed: number) => {
        await userSettings.handleSpeedChange(speed);
        // The audio playback hook will automatically use the new speed
    }, [userSettings]);

    return {
        // Data
        book: readerData.book,
        chapter: readerData.chapter,
        loading: readerData.loading || readingProgress.isLoadingProgress,
        error: readerData.error,
        currentChapterNumber: readerData.currentChapterNumber,

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
            currentChunkIndex,
            currentWordIndex: audioPlayback.currentWordIndex,
            isPlaying: audioPlayback.isPlaying,
            textChunks: audioPlayback.textChunks,
            handlePlay: audioPlayback.handlePlay,
            handlePause: audioPlayback.handlePause,
            handleWordClick: audioPlayback.handleWordClick,
            handlePreviousChunk: audioPlayback.handlePreviousChunk,
            handleNextChunk: audioPlayback.handleNextChunk,
            preloadChunk: audioPlayback.preloadChunk,
            getWordStyle: audioPlayback.getWordStyle,
            getSentenceStyle: audioPlayback.getSentenceStyle
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
            handleNavigateToBookmark
        }
    };
}; 