import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
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
import { useSettings } from '../../settings/SettingsContext';

export const Reader = () => {
    const { settings: appSettings } = useSettings();
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

    // Get current reading context for Q&A
    const getCurrentSentence = () => {
        if (!chapter || !audio.textChunks[audio.currentChunkIndex]) return '';
        return audio.textChunks[audio.currentChunkIndex].text;
    };

    const getLastSentences = () => {
        if (!chapter || audio.textChunks.length === 0) return '';
        const contextCount = appSettings.contextSentencesCount;
        const startIndex = Math.max(0, audio.currentChunkIndex - contextCount);
        const endIndex = Math.max(0, audio.currentChunkIndex);

        if (startIndex >= endIndex) return '';

        const lastSentences = audio.textChunks
            .slice(startIndex, endIndex)
            .map(chunk => chunk.text)
            .join(' ');
        return lastSentences;
    };

    const bookQA = useBookQA({
        bookId: book?._id || '',
        bookTitle: book?.title || '',
        chapterNumber: chapter?.chapterNumber || 1,
        chapterTitle: chapter?.title || '',
        currentSentence: getCurrentSentence(),
        lastSentences: getLastSentences()
    });

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
                <Paper elevation={0} sx={{ maxWidth: 800, mx: 'auto', p: 4, mb: 4, pb: { xs: 20, sm: 16 }, borderRadius: 0 }}>
                    <ReaderHeader book={book} chapter={chapter} />
                    <ReaderContent
                        chapter={chapter}
                        currentChunkIndex={(() => {
                            // Convert audio text chunk index to absolute chapter chunk index
                            const textChunks = chapter.content.chunks.filter(c => c.type === 'text');
                            const currentTextChunk = textChunks[audio.currentChunkIndex];
                            if (!currentTextChunk) return 0;

                            // Find this text chunk in the full chapters array
                            return chapter.content.chunks.findIndex(chunk =>
                                chunk.type === 'text' && chunk.text === currentTextChunk.text
                            );
                        })()}
                        getWordStyle={(chunkIndex, wordIndex) => {
                            // Convert absolute chunk index back to text chunk index for audio system
                            const chunk = chapter.content.chunks[chunkIndex];
                            if (chunk?.type !== 'text') return {};

                            const textChunks = chapter.content.chunks.filter(c => c.type === 'text');
                            const textChunkIndex = textChunks.findIndex(tc => tc.text === chunk.text);

                            return audio.getWordStyle(textChunkIndex, wordIndex);
                        }}
                        getSentenceStyle={(chunkIndex) => {
                            // Convert absolute chunk index back to text chunk index for audio system
                            const chunk = chapter.content.chunks[chunkIndex];
                            if (chunk?.type !== 'text') return {};

                            const textChunks = chapter.content.chunks.filter(c => c.type === 'text');
                            const textChunkIndex = textChunks.findIndex(tc => tc.text === chunk.text);

                            return audio.getSentenceStyle(textChunkIndex);
                        }}
                        handleWordClick={(chunkIndex, wordIndex) => {
                            // Convert absolute chunk index back to text chunk index for audio system
                            const chunk = chapter.content.chunks[chunkIndex];
                            if (chunk?.type !== 'text') return;

                            const textChunks = chapter.content.chunks.filter(c => c.type === 'text');
                            const textChunkIndex = textChunks.findIndex(tc => tc.text === chunk.text);

                            audio.handleWordClick(textChunkIndex, wordIndex);
                        }}
                        isChunkBookmarked={bookmarks.isChunkBookmarked}
                    />
                </Paper>

                {/* Audio Controls - Fixed at bottom */}
                <Box sx={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backgroundColor: 'background.paper',
                    borderTop: '1px solid',
                    borderColor: 'divider'
                }}>
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
                        isBookmarked={bookmarks.isBookmarked}
                        progress={(audio.currentChunkIndex / Math.max(audio.textChunks.length - 1, 1)) * 100}
                        playbackSpeed={settings.playbackSpeed}
                        bookmarks={bookmarks.bookmarks}
                        currentChapterNumber={chapter.chapterNumber}
                        currentChunkIndex={audio.currentChunkIndex}
                        totalChapters={book.totalChapters}
                        onNavigateToBookmark={navigation.handleNavigateToBookmark}
                        progressData={progress}
                    />
                </Box>

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
                />

                {/* Book Q&A Chat Settings */}
                <BookQAChatSettings
                    open={bookQA.isSettingsOpen}
                    onClose={bookQA.closeSettings}
                    selectedModelId={bookQA.selectedModelId}
                    onModelChange={bookQA.handleModelChange}
                />
            </Box>
        </UserThemeProvider>
    );
}; 