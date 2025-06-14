import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { useRouter } from '../../router';
import { useReader } from './hooks/useReader';
import { useBookQA } from './hooks/useBookQA';
import { AudioControls } from '../../components/AudioControls';
import { SpeedControlModal } from '../../components/SpeedControlModal';
import { ThemeModal } from '../../components/ThemeModal';
import { UserThemeProvider } from '../../components/UserThemeProvider';
import { ReaderHeader } from './components/ReaderHeader';
import { ReaderContent } from './components/ReaderContent';
import { BookQAPanel } from './components/BookQAPanel';
import { BookQAChatSettings } from './components/BookQAChatSettings';
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

    const [chapterDialogOpen, setChapterDialogOpen] = useState(false);

    // Navigate to book library if no books found
    useEffect(() => {
        if (!loading && error === 'No books found') {
            navigate('/book-library');
        }
    }, [loading, error, navigate]);



    // console.log('chapter', {chapter: chapter?.chapterNumber, loading});

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Pre-compute and cache the mapping from absolute chunk indices to text chunk indices
    const chunkIndexMapping = useMemo(() => {
        if (!chapter) return { absoluteToText: new Map(), textToAbsolute: new Map(), textChunks: [] };

        const textChunks = chapter.content.chunks.filter(c => c.type === 'text');
        const absoluteToText = new Map<number, number>();
        const textToAbsolute = new Map<number, number>();

        let textChunkIndex = 0;
        chapter.content.chunks.forEach((chunk, absoluteIndex) => {
            if (chunk.type === 'text') {
                absoluteToText.set(absoluteIndex, textChunkIndex);
                textToAbsolute.set(textChunkIndex, absoluteIndex);
                textChunkIndex++;
            }
        });

        return { absoluteToText, textToAbsolute, textChunks };
    }, [chapter]);

    // Optimized functions using cached mapping
    const getOptimizedWordStyle = useMemo(() => {
        return (chunkIndex: number, wordIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return {};
            return audio.getWordStyle(textChunkIndex, wordIndex);
        };
    }, [audio.getWordStyle, chunkIndexMapping]);

    const getOptimizedWordClassName = useMemo(() => {
        return (chunkIndex: number, wordIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return '';
            return audio.getWordClassName(textChunkIndex, wordIndex);
        };
    }, [audio.getWordClassName, chunkIndexMapping]);

    const getOptimizedSentenceStyle = useMemo(() => {
        return (chunkIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return {};
            return audio.getSentenceStyle(textChunkIndex);
        };
    }, [audio.getSentenceStyle, chunkIndexMapping]);

    const getOptimizedSentenceClassName = useMemo(() => {
        return (chunkIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return '';
            return audio.getSentenceClassName(textChunkIndex);
        };
    }, [audio.getSentenceClassName, chunkIndexMapping]);

    const handleOptimizedWordClick = useMemo(() => {
        return (chunkIndex: number, wordIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return;
            audio.handleWordClick(textChunkIndex, wordIndex);
        };
    }, [audio.handleWordClick, chunkIndexMapping]);

    const handleOptimizedSentenceClick = useMemo(() => {
        return (chunkIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return;

            // Set the current chunk index in reader state (will sync to audio)
            navigation.setCurrentChunkIndex(textChunkIndex);

            // Also jump to the first word of that chunk
            audio.handleWordClick(textChunkIndex, 0);
        };
    }, [chunkIndexMapping, navigation.setCurrentChunkIndex, audio.handleWordClick]);

    // Optimized current chunk index calculation
    const currentChunkIndex = useMemo(() => {
        const currentTextChunk = chunkIndexMapping.textChunks[audio.currentChunkIndex];
        if (!currentTextChunk) return 0;

        return chunkIndexMapping.textToAbsolute.get(audio.currentChunkIndex) || 0;
    }, [audio.currentChunkIndex, chunkIndexMapping]);

    // Get current reading context for Q&A
    const getCurrentSentence = () => {
        if (!chapter || !audio.textChunks[audio.currentChunkIndex]) return '';
        return audio.textChunks[audio.currentChunkIndex].text;
    };

    // Initialize bookQA hook first
    const bookQA = useBookQA({
        bookId: book?._id || '',
        bookTitle: book?.title || '',
        chapterNumber: chapter?.chapterNumber || 1,
        chapterTitle: chapter?.title || '',
        currentSentence: getCurrentSentence(),
        getLastSentences: () => getLastSentences
    });

    // Define getLastSentences after bookQA is initialized using useMemo
    const getLastSentences = useMemo(() => {
        if (!chapter || audio.textChunks.length === 0) return '';
        const contextCount = bookQA.contextLines;
        const startIndex = Math.max(0, audio.currentChunkIndex - contextCount);
        const endIndex = Math.max(0, audio.currentChunkIndex);

        if (startIndex >= endIndex) return '';

        const lastSentences = audio.textChunks
            .slice(startIndex, endIndex)
            .map(chunk => chunk.text)
            .join(' ');
        return lastSentences;
    }, [chapter, audio.textChunks, audio.currentChunkIndex, bookQA.contextLines]);

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
                        currentChunkIndex={currentChunkIndex}
                        getWordStyle={getOptimizedWordStyle}
                        getWordClassName={getOptimizedWordClassName}
                        getSentenceStyle={getOptimizedSentenceStyle}
                        getSentenceClassName={getOptimizedSentenceClassName}
                        handleWordClick={handleOptimizedWordClick}
                        handleSentenceClick={handleOptimizedSentenceClick}
                        isChunkBookmarked={bookmarks.isChunkBookmarked}
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
                    currentChunkIndex={audio.currentChunkIndex}
                    totalChapters={book.totalChapters}
                    onNavigateToBookmark={navigation.handleNavigateToBookmark}
                    progressData={progress}
                    onChapters={() => setChapterDialogOpen(true)}
                    minChapterNumber={book?.chapterStartNumber ?? 1}
                />

                {/* Speed Control Modal */}
                <SpeedControlModal
                    open={settings.speedModalOpen}
                    onClose={settings.handleCloseSpeedModal}
                    currentSpeed={settings.playbackSpeed}
                    currentVoice={settings.selectedVoice}
                    wordTimingOffset={settings.wordSpeedOffset}
                    onSpeedChange={settings.handleSpeedChange}
                    onVoiceChange={settings.handleVoiceChange}
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
                    currentSentence={getCurrentSentence()}
                    contextLines={bookQA.contextLines}
                    onContextLinesChange={bookQA.handleContextLinesChange}
                    selectedModelId={bookQA.selectedModelId}
                    onModelChange={bookQA.handleModelChange}
                    onSetReplyContext={bookQA.setReplyContext}
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
                    open={chapterDialogOpen}
                    onClose={() => setChapterDialogOpen(false)}
                    onChapterSelect={navigation.setCurrentChapterNumber}
                />
            </Box>
        </UserThemeProvider>
    );
}; 