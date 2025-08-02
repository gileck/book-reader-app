import React, { useRef, useEffect } from 'react';
import { Box, Typography, CircularProgress, Paper, Alert, Snackbar } from '@mui/material';
import { useRouter } from '../../router';
import { useReader } from './hooks/useReader';
import { useBookQA } from './hooks/useBookQA';
import { useChapterDialog } from './hooks/useChapterDialog';
import { useChunkMapping } from './hooks/useChunkMapping';
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

export const Reader = () => {
    const { navigate } = useRouter();
    const {
        book,
        chapter,
        loading,
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

    // Initialize chunk mapping hook
    const chunkMapping = useChunkMapping(chapter, audio, navigation);

    // Initialize content context hook (needs to be after bookQA is initialized)
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    // Initialize content context hook with bookQA context lines
    const contentContext = useContentContext(chapter, audio, bookQA);

    // Initialize scroll handling hook
    useScrollHandling(loading, chapter, chunkMapping.currentChunkIndex);

    if (loading) {
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
                {/* Text Area */}
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
                    />
                </Paper>

                {/* Audio Controls - Fixed at bottom */}
                <AudioControls
                    chapterTitle={`Chapter ${chapter.chapterNumber}: ${chapter.title}`}
                    currentChunk={audio.currentChunkIndex + 1}
                    totalChunks={audio.textChunks.length}
                    onPlay={audio.handlePlay}
                    onPause={audio.handlePause}
                    onPreviousChunk={audio.handlePreviousChunk}
                    onNextChunk={audio.handleNextChunk}
                    onPreviousChapter={navigation.handlePreviousChapter}
                    onNextChapter={navigation.handleNextChapter}
                    onBookmark={bookmarks.handleBookmark}
                    onSettings={settings.handleSettings}
                    onSpeedSettings={settings.handleSpeedSettings}
                    onAskAI={bookQA.togglePanel}
                    isPlaying={audio.isPlaying}
                    isCurrentChunkLoading={audio.isCurrentChunkLoading}
                    isBookmarked={bookmarks.isBookmarked}
                    progress={(audio.currentChunkIndex / Math.max(audio.textChunks.length - 1, 1)) * 100}
                    playbackSpeed={settings.playbackSpeed}
                    bookmarks={bookmarks.bookmarks}
                    currentChapterNumber={chapter.chapterNumber}
                    currentChunkIndex={chunkMapping.currentChunkIndex}
                    totalChapters={book.totalChapters}
                    onNavigateToBookmark={navigation.handleNavigateToBookmark}
                    progressData={progress}
                    onChapters={chapterDialog.openDialog}
                    minChapterNumber={book?.chapterStartNumber ?? 1}
                    ttsServiceAvailable={audio.ttsServiceAvailable}
                    ttsError={audio.ttsError}
                    onDismissError={audio.clearTtsError}
                />

                {/* Speed Control Modal */}
                <SpeedControlModal
                    open={settings.speedModalOpen}
                    onClose={settings.handleCloseSpeedModal}
                    currentSpeed={settings.playbackSpeed}
                    currentVoice={settings.selectedVoice}
                    currentProvider={settings.selectedProvider}
                    wordTimingOffset={settings.wordSpeedOffset}
                    onSpeedChange={settings.handleSpeedChange}
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

                {/* TODO: Implement enhanced scroll-to-chunk for v2 mixed content */}
            </Box>
        </UserThemeProvider>
    );
}; 