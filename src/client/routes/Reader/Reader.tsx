import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, Paper, Alert, Snackbar, Fab, ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { useRouter } from '../../router';
import { useReader } from './hooks/useReader';
import { useBookQA } from './hooks/useBookQA';
import { useChapterDialog } from './hooks/useChapterDialog';

import { useContentContext } from './hooks/useContentContext';
import { useScrollHandling } from './hooks/useScrollHandling';
import { AudioControls } from '../../components/AudioControls';
import { SpeedControlModal } from '../../components/SpeedControlModal';
import { ThemeModal } from '../../components/ThemeModal';
import { UserThemeProvider } from '../../components/UserThemeProvider';
import { ReaderHeader } from './components/ReaderHeader';
import { ReaderContent } from './components/ReaderContent';
import { BookQAPanel } from './components/BookQAPanel';
import { BookQAChatSettings } from './components/BookQAPanel/BookQAChatSettings';
import { CostApprovalDialog } from './components/CostApprovalDialog';
import { ChapterSelector } from './components/ChapterSelector';
import { FocusReader } from './FocusReader';
import { useFocusAudioPlayback } from './hooks/useFocusAudioPlayback';
import { useSettings } from '../../settings/SettingsContext';

export const Reader = () => {
    const { navigate, queryParams } = useRouter();
    const { settings: appSettings, updateSettings } = useSettings();
    const {
        book,
        chapter,
        loading,
        chapterTransitionLoading,
        error,
        audio,
        settings,
        bookmarks,
        navigation,
        progress
    } = useReader();

    // Initialize all hooks
    const chapterDialog = useChapterDialog();

    // Navigate to book library if no books found
    useEffect(() => {
        if (!loading && error === 'No books found') {
            navigate('/book-library');
        }
    }, [loading, error, navigate]);



    // Initialize content context hook (needs to be after bookQA is initialized)
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollToCurrent, setShowScrollToCurrent] = useState(false);

    // Initialize bookQA hook first with temporary context functions
    const bookQA = useBookQA({
        bookId: book?._id || '',
        bookTitle: book?.title || '',
        chapterNumber: chapter?.chapterNumber || 1,
        chapterTitle: chapter?.title || '',
        currentSentence: chapter && audio.textChunks[audio.currentChunkIndex] ? audio.textChunks[audio.currentChunkIndex].text : '',
        getLastSentences: () => {
            if (!chapter || audio.textChunks.length === 0) return '';
            const contextCount = 3; // Default value, will be updated by bookQA
            const startIndex = Math.max(0, audio.currentChunkIndex - contextCount);
            const endIndex = Math.max(0, audio.currentChunkIndex);
            if (startIndex >= endIndex) return '';
            return audio.textChunks.slice(startIndex, endIndex).map(chunk => chunk.text).join(' ');
        }
    });

    // Sync reading mode from URL param on load/change
    useEffect(() => {
        const urlMode = (queryParams.mode as 'full' | 'focus' | undefined) || undefined;
        if (urlMode && urlMode !== appSettings.readingMode) {
            updateSettings({ readingMode: urlMode });
        }
    }, [queryParams.mode, appSettings.readingMode, updateSettings]);

    // Initialize content context hook with bookQA context lines
    const contentContext = useContentContext(chapter, audio, bookQA);

    // Determine mode and prepare focus audio BEFORE any early returns
    const isFocusMode = (appSettings.readingMode || 'full') === 'focus';
    const focusAudio = useFocusAudioPlayback(
        chapter,
        settings.selectedVoice,
        settings.selectedProvider,
        settings.playbackSpeed,
        settings.ttsEnabled,
        audio.currentChunkIndex,
        audio.currentWordIndex
    );

    // Initialize scroll handling hook
    const { handleScrollToCurrentChunk } = useScrollHandling(loading, chapter, audio.currentChunkIndex);

    // When switching chapters without a specific current index, scroll container to top
    useEffect(() => {
        if (loading || !chapter) return;
        // If there's no specific position (index 0), ensure we reset to top
        if (audio.currentChunkIndex === 0) {
            const container = scrollContainerRef.current;
            if (container) {
                // Use requestAnimationFrame to wait until content is laid out
                requestAnimationFrame(() => {
                    container.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                });
            }
        }
    }, [loading, chapter?.chapterNumber, audio.currentChunkIndex]);

    // Show a floating button when current chunk is outside of the scroll container's viewport (full mode only)
    useEffect(() => {
        if (appSettings.readingMode === 'focus') {
            setShowScrollToCurrent(false);
            return;
        }
        const container = scrollContainerRef.current;
        if (!container || loading || !chapter || audio.currentChunkIndex === null) {
            setShowScrollToCurrent(false);
            return;
        }

        let observer: IntersectionObserver | null = null;
        let retryTimeout: number | undefined;

        const attachObserver = () => {
            // Prefer paragraph-aware targeting first
            const selectorPrimary = `[data-paragraph-index][data-chunk-index="${audio.currentChunkIndex}"]`;
            const selectorFallback = `[data-chunk-index="${audio.currentChunkIndex}"]`;
            const targetElement = (document.querySelector(selectorPrimary) || document.querySelector(selectorFallback)) as Element | null;

            if (!targetElement) {
                // DOM may not be ready yet; retry shortly
                retryTimeout = window.setTimeout(attachObserver, 250);
                return;
            }

            // Account for bottom audio bar so items hidden under it are treated as not visible
            const bottomObstruction = 120; // px
            observer = new IntersectionObserver(
                (entries) => {
                    const entry = entries[0];
                    setShowScrollToCurrent(!entry.isIntersecting);
                },
                { root: container, threshold: 0, rootMargin: `0px 0px -${bottomObstruction}px 0px` }
            );

            observer.observe(targetElement);

            // Also run an initial visibility check
            const containerRect = container.getBoundingClientRect();
            const targetRect = (targetElement as HTMLElement).getBoundingClientRect();
            const adjustedBottom = containerRect.bottom - bottomObstruction;
            const isInView = targetRect.top < adjustedBottom && targetRect.bottom > containerRect.top;
            setShowScrollToCurrent(!isInView);
        };

        // Defer to next frame to ensure DOM is painted
        const raf = requestAnimationFrame(attachObserver);

        return () => {
            if (observer) observer.disconnect();
            if (retryTimeout) clearTimeout(retryTimeout);
            cancelAnimationFrame(raf);
        };
    }, [loading, chapter, audio.currentChunkIndex, audio.textChunks.length, appSettings.readingMode]);

    const handleModeChange = useCallback((_: unknown, nextMode: 'full' | 'focus' | null) => {
        const mode = nextMode || 'full';
        if (mode !== appSettings.readingMode) {
            updateSettings({ readingMode: mode });
        }
        // Sync URL param
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (mode === 'full') params.delete('mode'); else params.set('mode', mode);
            const path = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
            navigate(path);
        }
    }, [appSettings.readingMode, updateSettings, navigate]);

    if ((loading && !chapterTransitionLoading) || !settings.settingsLoaded) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box textAlign="center" mt={4}>
                <Typography color="error" variant="h6">
                    {error}
                </Typography>
            </Box>
        );
    }

    if (!book || !chapter) {
        return (
            <Box textAlign="center" mt={4}>
                <Typography variant="h6">
                    Book or chapter not found
                </Typography>
            </Box>
        );
    }

    // isFocusMode and focusAudio initialized above

    return (
        <UserThemeProvider
            theme={settings.theme}
            highlightColor={settings.highlightColor}
            sentenceHighlightColor={settings.sentenceHighlightColor}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            fontFamily={settings.fontFamily}
            textColor={settings.textColor}
        >
            <Box>
                {/* Mode Toggle */}
                <Box sx={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'flex-end', maxWidth: 800, mx: 'auto', px: 1, pt: 1 }}>
                    <Tooltip title="Reading Mode">
                        <ToggleButtonGroup
                            value={isFocusMode ? 'focus' : 'full'}
                            exclusive
                            size="small"
                            onChange={handleModeChange}
                        >
                            <ToggleButton value="full">Full</ToggleButton>
                            <ToggleButton value="focus">Focus</ToggleButton>
                        </ToggleButtonGroup>
                    </Tooltip>
                </Box>

                {isFocusMode ? (
                    <FocusReader focusAudio={focusAudio!} highlightMode={settings.highlightMode} />
                ) : (
                    <Paper
                        ref={scrollContainerRef}
                        elevation={0}
                        sx={{
                            maxWidth: 800,
                            mx: 'auto',
                            p: 1,
                            pb: { xs: 20, sm: 16 },
                            borderRadius: 0,
                            height: 'calc(100vh - 200px)', // Adjust to account for AudioControls height
                            overflow: 'auto'
                        }}
                    >
                        <ReaderHeader book={book} chapter={chapter} />

                        <ReaderContent
                            chapter={chapter}
                            book={book}
                            scrollContainerRef={scrollContainerRef}
                            onNavigateToChapter={navigation.setCurrentChapterNumber}
                            onNavigateToChunk={navigation.setCurrentChunkIndex}
                            onNavigateToBookmark={navigation.handleNavigateToBookmark}
                            currentChunkIndex={audio.currentChunkIndex}
                            fontSize={settings.fontSize}
                            lineHeight={settings.lineHeight}
                            fontFamily={settings.fontFamily}
                            textColor={settings.textColor}
                            highlightColor={settings.highlightColor}
                            sentenceHighlightColor={settings.sentenceHighlightColor}
                        />
                    </Paper>
                )}

                {!isFocusMode && showScrollToCurrent && (
                    <Fab
                        color="primary"
                        size="medium"
                        aria-label="Scroll to current chunk"
                        onClick={handleScrollToCurrentChunk}
                        sx={{ position: 'fixed', right: 16, bottom: { xs: 96, sm: 104 }, zIndex: 1200 }}
                    >
                        <MyLocationIcon />
                    </Fab>
                )}

                {/* Audio Controls - Fixed at bottom */}
                <AudioControls
                    chapterTitle={`Chapter ${chapter.chapterNumber}: ${chapter.title}`}
                    currentChunk={isFocusMode ? focusAudio!.currentSentenceIndex + 1 : audio.currentChunkIndex + 1}
                    totalChunks={isFocusMode ? focusAudio!.sentences.length : audio.textChunks.length}
                    onPlay={isFocusMode ? focusAudio!.handlePlay : audio.handlePlay}
                    onPause={isFocusMode ? focusAudio!.handlePause : audio.handlePause}
                    onPreviousChunk={isFocusMode ? focusAudio!.handlePreviousSentence : audio.handlePreviousChunk}
                    onNextChunk={isFocusMode ? focusAudio!.handleNextSentence : audio.handleNextChunk}
                    onPreviousChapter={navigation.handlePreviousChapter}
                    onNextChapter={navigation.handleNextChapter}
                    onBookmark={bookmarks.handleBookmark}
                    onSettings={settings.handleSettings}
                    onSpeedSettings={settings.handleSpeedSettings}
                    onAskAI={bookQA.togglePanel}
                    isPlaying={isFocusMode ? focusAudio!.isPlaying : audio.isPlaying}
                    ttsEnabled={settings.ttsEnabled}
                    isCurrentChunkLoading={audio.isCurrentChunkLoading}
                    isBookmarked={bookmarks.isBookmarked}
                    progress={isFocusMode
                        ? (focusAudio!.currentSentenceIndex / Math.max((focusAudio!.sentences.length - 1), 1)) * 100
                        : (audio.currentChunkIndex !== null ? (audio.currentChunkIndex / Math.max(audio.textChunks.length - 1, 1)) * 100 : 0)}
                    playbackSpeed={settings.playbackSpeed}
                    bookmarks={bookmarks.bookmarks}
                    currentChapterNumber={chapter.chapterNumber}
                    currentChunkIndex={audio.currentChunkIndex}
                    totalChapters={book.totalChapters}
                    onNavigateToBookmark={navigation.handleNavigateToBookmark}
                    progressData={progress}
                    onChapters={chapterDialog.openDialog}
                    minChapterNumber={book?.chapterStartNumber ?? 1}
                    ttsServiceAvailable={isFocusMode ? true : audio.ttsServiceAvailable}
                    ttsError={isFocusMode ? null : audio.ttsError}
                    onDismissError={audio.clearTtsError}
                    chapterTransitionLoading={chapterTransitionLoading}
                    unitLabelOverride={isFocusMode ? 'sentences' : undefined}
                />

                {/* Speed Control Modal */}
                <SpeedControlModal
                    open={settings.speedModalOpen}
                    onClose={settings.handleCloseSpeedModal}
                    ttsEnabled={settings.ttsEnabled}
                    currentSpeed={settings.playbackSpeed}
                    currentVoice={settings.selectedVoice}
                    currentProvider={settings.selectedProvider}
                    wordTimingOffset={settings.wordSpeedOffset}
                    onSpeedChange={settings.handleSpeedChange}
                    onTtsEnabledChange={settings.handleTtsEnabledChange}
                    onVoiceChange={settings.handleVoiceChange}
                    onProviderChange={settings.handleProviderChange}
                    onWordTimingOffsetChange={settings.handleWordTimingOffsetChange}
                    onPreviewVoice={settings.handlePreviewVoice}
                />

                {/* Theme Modal */}
                <ThemeModal
                    open={settings.themeModalOpen}
                    onClose={settings.handleCloseThemeModal}
                    currentTheme={settings.theme}
                    currentHighlightColor={settings.highlightColor}
                    currentSentenceHighlightColor={settings.sentenceHighlightColor}
                    currentFontSize={settings.fontSize}
                    currentLineHeight={settings.lineHeight}
                    currentFontFamily={settings.fontFamily}
                    currentTextColor={settings.textColor}
                    onThemeChange={settings.handleThemeChange}
                    onHighlightColorChange={settings.handleHighlightColorChange}
                    onSentenceHighlightColorChange={settings.handleSentenceHighlightColorChange}
                    onFontSizeChange={settings.handleFontSizeChange}
                    onLineHeightChange={settings.handleLineHeightChange}
                    onFontFamilyChange={settings.handleFontFamilyChange}
                    onTextColorChange={settings.handleTextColorChange}
                    highlightMode={settings.highlightMode}
                    onHighlightModeChange={settings.handleHighlightModeChange}
                    onResetToDefaults={settings.handleResetToDefaults}
                />

                {/* Book Q&A Panel */}
                <BookQAPanel
                    open={bookQA.isOpen}
                    fullScreen={bookQA.isFullScreen}
                    loading={bookQA.isLoading}
                    messages={bookQA.messages}
                    onClose={bookQA.closePanel}
                    onToggleFullScreen={bookQA.toggleFullScreen}
                    onSubmitQuestion={bookQA.submitQuestion}
                    onClearHistory={bookQA.clearHistory}
                    onOpenSettings={bookQA.openSettings}
                    currentBookTitle={book?.title || ''}
                    currentChapterTitle={chapter?.title || ''}
                    currentChapterNumber={chapter?.chapterNumber || 1}
                    currentSentence={contentContext.getCurrentSentence()}
                    contextLines={bookQA.contextLines}
                    onContextLinesChange={bookQA.handleContextLinesChange}
                    selectedModelId={bookQA.selectedModelId}
                    onModelChange={bookQA.handleModelChange}
                    onSetReplyContext={bookQA.setReplyContext}
                    getLastSentences={() => contentContext.getLastSentences}
                    answerLength={bookQA.answerLength}
                    answerLevel={bookQA.answerLevel}
                    answerStyle={bookQA.answerStyle}
                />

                {/* Book Q&A Chat Settings */}
                <BookQAChatSettings
                    open={bookQA.isSettingsOpen}
                    onClose={bookQA.closeSettings}
                    selectedModelId={bookQA.selectedModelId}
                    onModelChange={bookQA.handleModelChange}
                    estimateBeforeSend={bookQA.estimateBeforeSend}
                    onEstimateBeforeSendChange={bookQA.handleEstimateBeforeSendChange}
                    costApprovalThreshold={bookQA.costApprovalThreshold}
                    onCostApprovalThresholdChange={bookQA.handleCostApprovalThresholdChange}
                    answerLength={bookQA.answerLength}
                    answerLevel={bookQA.answerLevel}
                    answerStyle={bookQA.answerStyle}
                    onAnswerLengthChange={bookQA.handleAnswerLengthChange}
                    onAnswerLevelChange={bookQA.handleAnswerLevelChange}
                    onAnswerStyleChange={bookQA.handleAnswerStyleChange}
                />

                {/* Cost Approval Dialog */}
                <CostApprovalDialog
                    open={bookQA.showCostApprovalDialog}
                    estimatedCost={bookQA.estimatedCost || 0}
                    onApprove={() => bookQA.handleCostApproval(true)}
                    onCancel={() => bookQA.handleCostApproval(false)}
                />

                {/* Chapter Selector Dialog */}
                <ChapterSelector
                    bookId={book?._id || ''}
                    currentChapterNumber={chapter?.chapterNumber || 1}
                    open={chapterDialog.isOpen}
                    onClose={chapterDialog.closeDialog}
                    onChapterSelect={navigation.setCurrentChapterNumber}
                />

                {/* Reading Progress Error Alert */}
                <Snackbar
                    open={progress.alert.open}
                    autoHideDuration={6000}
                    onClose={progress.closeAlert}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={progress.closeAlert}
                        severity={progress.alert.severity}
                        sx={{ width: '100%' }}
                    >
                        {progress.alert.message}
                    </Alert>
                </Snackbar>


            </Box>
        </UserThemeProvider>
    );
}; 