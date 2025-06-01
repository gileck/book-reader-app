import React from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { useReader } from './hooks/useReader';
import { AudioControls } from '../../components/AudioControls';
import { SpeedControlModal } from '../../components/SpeedControlModal';
import { ThemeModal } from '../../components/ThemeModal';
import { UserThemeProvider } from '../../components/UserThemeProvider';
import { ReaderHeader } from './components/ReaderHeader';
import { ReaderContent } from './components/ReaderContent';

export const Reader = () => {
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
                        currentChunkIndex={audio.currentChunkIndex}
                        getWordStyle={audio.getWordStyle}
                        getSentenceStyle={audio.getSentenceStyle}
                        handleWordClick={audio.handleWordClick}
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
            </Box>
        </UserThemeProvider>
    );
}; 