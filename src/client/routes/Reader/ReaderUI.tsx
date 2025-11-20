import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Paper, Alert, Snackbar, Tabs, Tab } from '@mui/material';
import { useRouter } from '../../router';
import type { BookClient } from '../../../apis/books/types';
import type { ChapterClient } from '../../../apis/chapters/types';
import { useReaderState } from './hooks/useReaderState';
import { useBookQA } from './hooks/useBookQA';
import { useChapterDialog } from './hooks/useChapterDialog';
import { useContentContext } from './hooks/useContentContext';
import { useScrollHandling } from './hooks/useScrollHandling';
import { useChapterOverview } from './hooks/useChapterOverview';
import { AudioControls } from '../../components/AudioControls';
import { SpeedControlModal } from '../../components/SpeedControlModal';
import { ThemeModal } from '../../components/ThemeModal';
import { UserThemeProvider } from '../../components/UserThemeProvider';
import { ReaderHeader } from './components/ReaderHeader';
import { ReaderContent } from './components/ReaderContent';
import { BookQAChatSettings } from './components/BookQAPanel/BookQAChatSettings';
import { ChatContent } from './components/BookQAPanel/ChatContent';
import { ChatInput } from './components/BookQAPanel/ChatInput';
import { PanelHeader } from './components/BookQAPanel/PanelHeader';
import { CostApprovalDialog } from './components/CostApprovalDialog';
import { ChapterSelector } from './components/ChapterSelector';
import { FocusReader } from './FocusReader';
import { useSettings } from '../../settings/SettingsContext';
import { getFormattedTimeRemaining } from './utils/timeEstimation';
import { QuickPromptsDialog } from '../../components/QuickPromptsDialog';
import { BookOverviewPanel } from './components/BookOverviewPanel';
import { extractChapterTextContent } from './utils/chapterUtils';
import { FullscreenTextControls } from './components/FullscreenTextControls';

interface ReaderUIProps {
    initialBook: BookClient;
    initialChapter: ChapterClient;
    initialChapterNumber: number;
    initialChunkIndex: number;
}

export const ReaderUI = ({
    initialBook,
    initialChapter,
    initialChapterNumber,
    initialChunkIndex
}: ReaderUIProps) => {
    const { navigate, queryParams } = useRouter();
    const { settings: appSettings, updateSettings, userSettings, updateUserSettings } = useSettings();

    // Use ReaderState hook with initial data
    const {
        book,
        chapter,
        loading,
        chapterTransitionLoading,
        navigationError,
        clearNavigationError,
        audio,
        settings,
        bookmarks,
        navigation,
        progress,
        sentenceAudio
    } = useReaderState({
        initialBook,
        initialChapter,
        initialChapterNumber,
        initialChunkIndex
    });

    // Initialize all hooks (must be before any conditional returns)
    const chapterDialog = useChapterDialog();

    // Initialize content context hook (needs to be after bookQA is initialized)
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Initialize activeTab with user's reading mode from database (already loaded)
    // Priority: URL param > user settings (database) > app settings (localStorage) > default ('focus')
    const initialMode = (queryParams.mode as 'focus' | 'full' | 'qa' | 'overview' | undefined)
        || userSettings?.readingMode
        || appSettings.readingMode
        || 'focus';
    const [activeTab, setActiveTab] = useState<'focus' | 'full' | 'qa' | 'overview'>(initialMode);

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isAutoScrollActive, setIsAutoScrollActive] = useState(false);
    const sentences = sentenceAudio.sentences;
    const currentSentenceIndex = audio.currentChunkIndex ?? sentenceAudio.controller.currentSentenceIndex ?? 0;
    const previousSentenceIndex = useMemo(() => {
        for (let i = currentSentenceIndex - 1; i >= 0; i--) {
            const chunk = sentences[i];
            if (chunk && (chunk.type === 'text' || chunk.type === 'header') && chunk.text?.trim()) {
                return i;
            }
        }
        return null;
    }, [currentSentenceIndex, sentences]);

    const nextSentenceIndex = useMemo(() => {
        for (let i = currentSentenceIndex + 1; i < sentences.length; i++) {
            const chunk = sentences[i];
            if (chunk && (chunk.type === 'text' || chunk.type === 'header') && chunk.text?.trim()) {
                return i;
            }
        }
        return null;
    }, [currentSentenceIndex, sentences]);

    const canGoPrevSentence = previousSentenceIndex !== null;
    const canGoNextSentence = nextSentenceIndex !== null;

    // QA Chat state
    const [qaQuestion, setQaQuestion] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Quick Prompts dialog state
    const [quickPromptsOpen, setQuickPromptsOpen] = useState(false);

    // Chat input collapse state
    const [chatInputCollapsed, setChatInputCollapsed] = useState(false);

    // Create a ref to store the contextLines accessor
    const getContextLines = useRef<() => number>(() => 3);

    // Initialize bookQA hook with dynamic context function
    const bookQA = useBookQA({
        bookId: book?._id || '',
        bookTitle: book?.title || '',
        chapterNumber: chapter?.chapterNumber || 1,
        chapterTitle: chapter?.title || '',
        currentSentence: chapter && audio.textChunks[sentenceAudio.controller.currentSentenceIndex] ? audio.textChunks[sentenceAudio.controller.currentSentenceIndex].text : '',
        getLastSentences: () => {
            if (!chapter || audio.textChunks.length === 0) return '';
            const contextCount = getContextLines.current();
            const startIndex = Math.max(0, sentenceAudio.controller.currentSentenceIndex - contextCount);
            const endIndex = Math.max(0, sentenceAudio.controller.currentSentenceIndex);
            if (startIndex >= endIndex) return '';
            return audio.textChunks.slice(startIndex, endIndex).map(chunk => chunk.text).join(' ');
        }
    });

    // Update the ref to return bookQA's contextLines
    useEffect(() => {
        getContextLines.current = () => bookQA.contextLines;
    }, [bookQA.contextLines]);

    // Memoize chapter content extraction to prevent recalculation and circular reference issues
    const chapterContent = useMemo(() => {
        return chapter ? extractChapterTextContent(chapter) : '';
    }, [chapter]);

    // Initialize chapter overview hook
    const chapterOverview = useChapterOverview({
        bookId: book?._id || '',
        bookTitle: book?.title || '',
        chapterNumber: chapter?.chapterNumber || 1,
        chapterTitle: chapter?.title || '',
        chapterContent
    });

    // Sync reading mode from URL param on load/change
    useEffect(() => {
        const urlMode = (queryParams.mode as 'full' | 'focus' | 'qa' | 'overview' | undefined) || undefined;
        if (urlMode) {
            setActiveTab(urlMode);
            if (urlMode !== 'qa' && urlMode !== 'overview' && urlMode !== appSettings.readingMode) {
                updateSettings({ readingMode: urlMode });
            }
        } else {
            // Default to current reading mode setting
            setActiveTab(appSettings.readingMode || 'full');
        }
    }, [queryParams.mode, appSettings.readingMode, updateSettings]);

    // Initialize content context hook with bookQA context lines
    const contentContext = useContentContext(chapter, audio, bookQA);

    // Initialize scroll handling hook
    const { scrollToChunk, scrollToSentenceChunk } = useScrollHandling(loading, chapter, audio.currentChunkIndex);

    // Handler to scroll to current playing chunk
    const handleScrollToCurrentChunk = useCallback(() => {
        if (activeTab === 'full') {
            // Get the current index fresh when button is clicked
            const currentIndex = sentenceAudio.controller.currentSentenceIndex;
            scrollToChunk(currentIndex);
        }
    }, [sentenceAudio.controller, scrollToChunk, activeTab]);

    // Handler to go to top (navigate to first sentence and scroll to top)
    const handleGoToTop = useCallback(() => {
        // Navigate audio to first sentence
        sentenceAudio.controller.goToSentence(0);

        // Scroll to top in full mode
        if (activeTab === 'full') {
            const container = scrollContainerRef.current;
            if (container) {
                setTimeout(() => {
                    container.scrollTo({ top: 0, behavior: 'smooth' });
                }, 50);
            }
        }
    }, [sentenceAudio.controller.goToSentence, activeTab]);

    // Track if initial position has been scrolled to (full mode only)
    const hasScrolledToInitialPosition = useRef(false);
    const initialChapterNumberRef = useRef<number | null>(null);
    const centerSentenceAfterNavRef = useRef(false);

    // Auto-scroll to saved reading position on initial load (full mode only)
    useEffect(() => {
        if (loading || !chapter || activeTab !== 'full') return;

        // Track chapter changes to reset scroll flag
        if (initialChapterNumberRef.current !== chapter.chapterNumber) {
            initialChapterNumberRef.current = chapter.chapterNumber;
            hasScrolledToInitialPosition.current = false;
        }

        // Only auto-scroll once per chapter load
        if (hasScrolledToInitialPosition.current) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        // Wait for content to be fully rendered
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (audio.currentChunkIndex === 0) {
                    // Scroll to top for chapter start
                    container.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                } else {
                    // Scroll to saved reading position
                    handleScrollToCurrentChunk();
                }
                hasScrolledToInitialPosition.current = true;
            }, 300); // Give time for DOM elements to render
        });
    }, [loading, chapter, audio.currentChunkIndex, activeTab, handleScrollToCurrentChunk]);

    const handleTabChange = useCallback((_: React.SyntheticEvent, newTab: 'focus' | 'full' | 'qa' | 'overview') => {
        setActiveTab(newTab);
        // Exit fullscreen when switching tabs
        setIsFullscreen(false);

        // Update reading mode setting for focus/full tabs
        if (newTab !== 'qa' && newTab !== 'overview') {
            // Save to user settings (database) for persistence across devices
            if (newTab !== userSettings?.readingMode) {
                void updateUserSettings({ readingMode: newTab });
            }
            // Also update local app settings for immediate use
            if (newTab !== appSettings.readingMode) {
                updateSettings({ readingMode: newTab });
            }
        }

        // Sync URL param
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (newTab === 'full') params.delete('mode'); else params.set('mode', newTab);
            const path = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
            navigate(path);
        }
    }, [appSettings.readingMode, userSettings?.readingMode, updateSettings, updateUserSettings, navigate]);

    const handleOpenQAChat = useCallback(() => {
        setActiveTab('qa');
        // Sync URL param
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            params.set('mode', 'qa');
            const path = `${window.location.pathname}?${params.toString()}`;
            navigate(path);
        }
    }, [navigate]);

    const handleOpenQuickPrompts = useCallback(() => {
        setQuickPromptsOpen(true);
    }, []);

    const handleCloseQuickPrompts = useCallback(() => {
        setQuickPromptsOpen(false);
    }, []);

    const handleSelectPrompt = useCallback((promptContent: string) => {
        // Set the question
        setQaQuestion(promptContent);
        // Switch to QA tab
        handleOpenQAChat();
    }, [handleOpenQAChat]);

    const handleCollapseInput = useCallback(() => {
        setChatInputCollapsed(true);
    }, []);

    const handleExpandInput = useCallback(() => {
        setChatInputCollapsed(false);
    }, []);

    const handleToggleFullscreen = useCallback(() => {
        if (activeTab === 'full') {
            centerSentenceAfterNavRef.current = true;
        }
        setIsFullscreen(prev => !prev);
    }, [activeTab]);

    const handleToggleAutoScroll = useCallback(() => {
        setIsAutoScrollActive(prev => !prev);
    }, []);

    // QA Chat handlers
    const handleQaSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (qaQuestion.trim() && !bookQA.isLoading) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 0);
            bookQA.submitQuestion(qaQuestion.trim());
            setQaQuestion('');
        }
    }, [qaQuestion, bookQA]);

    const handleQaKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleQaSubmit(e);
        }
    }, [handleQaSubmit]);

    const handleQaReply = useCallback((messageIndex: number, messageContent: string) => {
        bookQA.setReplyContext(messageIndex, messageContent);
        setQaQuestion(`Reply to: "${messageContent.slice(0, 50)}${messageContent.length > 50 ? '...' : ''}" - `);
    }, [bookQA]);

    const handleTextSelection = useCallback((selectedText: string) => {
        if (selectedText.trim()) {
            setQaQuestion(selectedText.trim());
        }
    }, []);

    // Scroll QA messages to bottom when they change
    useEffect(() => {
        if (activeTab === 'qa' && bookQA.messages.length > 0) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 100);
        }
    }, [activeTab, bookQA.messages, bookQA.isLoading]);

    // Stop auto-scroll when leaving fullscreen full mode
    useEffect(() => {
        if (!isFullscreen || activeTab !== 'full') {
            setIsAutoScrollActive(false);
        }
    }, [isFullscreen, activeTab]);

    const autoScrollSpeed = settings.autoScrollSpeed ?? 60;

    useEffect(() => {
        if (!centerSentenceAfterNavRef.current) return;
        if (activeTab !== 'full') return;
        centerSentenceAfterNavRef.current = false;

        const timeoutId = window.setTimeout(() => {
            scrollToSentenceChunk(currentSentenceIndex);
        }, 80);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [currentSentenceIndex, activeTab, isFullscreen, scrollToSentenceChunk]);

    // Handle continuous auto-scroll in fullscreen mode
    useEffect(() => {
        if (!(isAutoScrollActive && isFullscreen && activeTab === 'full')) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        let frameId: number | null = null;
        let lastTimestamp: number | null = null;

        const stopAutoScroll = () => {
            setIsAutoScrollActive(false);
        };

        const step = (timestamp: number) => {
            if (!lastTimestamp) {
                lastTimestamp = timestamp;
            }
            const deltaSeconds = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            container.scrollTop += autoScrollSpeed * deltaSeconds;

            const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 4;
            if (nearBottom) {
                stopAutoScroll();
                return;
            }

            frameId = requestAnimationFrame(step);
        };

        frameId = requestAnimationFrame(step);

        container.addEventListener('wheel', stopAutoScroll, { passive: true });
        container.addEventListener('touchstart', stopAutoScroll, { passive: true });
        container.addEventListener('mousedown', stopAutoScroll);

        return () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
            }
            container.removeEventListener('wheel', stopAutoScroll);
            container.removeEventListener('touchstart', stopAutoScroll);
            container.removeEventListener('mousedown', stopAutoScroll);
        };
    }, [isAutoScrollActive, isFullscreen, activeTab, autoScrollSpeed]);

    // Wrap play function to mark it as user-initiated
    const handleUserPlay = useCallback(() => {
        void sentenceAudio.controller.play(true); // User clicked play button
    }, [sentenceAudio.controller]);

    const handleFullscreenPrevSentence = useCallback(() => {
        if (previousSentenceIndex === null) return;
        if (isAutoScrollActive) {
            setIsAutoScrollActive(false);
        }
        centerSentenceAfterNavRef.current = true;
        sentenceAudio.controller.goToSentence(previousSentenceIndex);
        navigation.setCurrentChunkIndex(previousSentenceIndex);
    }, [previousSentenceIndex, isAutoScrollActive, sentenceAudio.controller, navigation.setCurrentChunkIndex]);

    const handleFullscreenNextSentence = useCallback(() => {
        if (nextSentenceIndex === null) return;
        if (isAutoScrollActive) {
            setIsAutoScrollActive(false);
        }
        centerSentenceAfterNavRef.current = true;
        sentenceAudio.controller.goToSentence(nextSentenceIndex);
        navigation.setCurrentChunkIndex(nextSentenceIndex);
    }, [nextSentenceIndex, isAutoScrollActive, sentenceAudio.controller, navigation.setCurrentChunkIndex]);

    const handlePreviousChunk = useCallback(() => {
        sentenceAudio.controller.prevSentence();
        if (activeTab === 'full') {
            centerSentenceAfterNavRef.current = true;
            if (isFullscreen && isAutoScrollActive) {
                setIsAutoScrollActive(false);
            }
        }
    }, [sentenceAudio.controller, activeTab, isFullscreen, isAutoScrollActive]);

    const handleNextChunk = useCallback(() => {
        sentenceAudio.controller.nextSentence();
        if (activeTab === 'full') {
            centerSentenceAfterNavRef.current = true;
            if (isFullscreen && isAutoScrollActive) {
                setIsAutoScrollActive(false);
            }
        }
    }, [sentenceAudio.controller, activeTab, isFullscreen, isAutoScrollActive]);

    // Calculate estimated time remaining to read the chapter
    const estimatedTimeRemaining = useMemo(() => {
        return getFormattedTimeRemaining(
            sentenceAudio.sentences,
            sentenceAudio.controller.currentSentenceIndex,
            settings.playbackSpeed
        );
    }, [sentenceAudio.sentences, sentenceAudio.controller.currentSentenceIndex, settings.playbackSpeed]);

    // Settings are guaranteed to be loaded by ReaderDataLoader, so no need to check again
    // Note: Initial load errors are handled by ReaderDataLoader, not here
    // Chapter navigation errors are shown as Snackbars (see navigationError below)

    /**
     * Handle single click on a text chunk to navigate forward/backward
     * 
     * This provides intuitive click-to-navigate functionality in all reading modes.
     * Single click navigates to the clicked sentence (or next/prev if clicking current).
     * Double click opens translation menu (handled separately in TextChunk).
     */
    const handleChunkClick = useCallback((clickedIndex: number) => {
        if (clickedIndex > currentSentenceIndex && canGoNextSentence) {
            handleFullscreenNextSentence();
        } else if (clickedIndex < currentSentenceIndex && canGoPrevSentence) {
            handleFullscreenPrevSentence();
        }
    }, [currentSentenceIndex, canGoNextSentence, canGoPrevSentence, handleFullscreenNextSentence, handleFullscreenPrevSentence]);

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
                {/* Tab Menu - Hidden in fullscreen mode */}
                {!(isFullscreen && activeTab === 'full') && (
                    <Box sx={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        borderBottom: 1,
                        borderColor: 'divider',
                        backdropFilter: 'blur(10px)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: 'rgba(18, 18, 18, 0.95)',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
                        }
                    }}>
                        <Tabs
                            value={activeTab}
                            onChange={handleTabChange}
                            centered
                            sx={{
                                maxWidth: 800,
                                mx: 'auto',
                                '& .MuiTabs-indicator': {
                                    height: 3,
                                    borderRadius: '3px 3px 0 0'
                                },
                                '& .MuiTab-root': {
                                    color: 'text.primary',
                                    fontWeight: 500,
                                    fontSize: '0.95rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    minHeight: 56,
                                    '@media (prefers-color-scheme: dark)': {
                                        color: 'rgba(255, 255, 255, 0.7)'
                                    }
                                },
                                '& .MuiTab-root.Mui-selected': {
                                    color: 'primary.main',
                                    fontWeight: 600,
                                    '@media (prefers-color-scheme: dark)': {
                                        color: 'primary.light'
                                    }
                                }
                            }}
                        >
                            <Tab label="Full" value="full" />
                            <Tab label="Focus" value="focus" />
                            <Tab label="QA Chat" value="qa" />
                            <Tab label="Overview" value="overview" />
                        </Tabs>
                    </Box>
                )}

                {activeTab === 'focus' ? (
                    <FocusReader
                        controller={sentenceAudio.controller}
                        highlightMode={settings.highlightMode}
                        ttsEnabled={settings.ttsEnabled}
                        autoFontScaling={settings.autoFontScaling}
                        bionicReadingEnabled={settings.bionicReadingEnabled}
                        book={book}
                    />
                ) : activeTab === 'qa' ? (
                    // QA Chat Tab - WRAPPER for ChatContent component
                    // IMPORTANT: This tab uses the SHARED ChatContent component from BookQAPanel/ChatContent.tsx
                    // ChatContent is also used by BookQAPanel (floating panel and fullscreen modes)
                    // For bugs related to message display or scrolling, check ChatContent.tsx FIRST
                    <Box sx={{
                        maxWidth: 800,
                        mx: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        height: 'calc(100vh - 56px - 120px)', // Tab bar (56px) + compact audio player (120px)
                        backgroundColor: 'background.default',
                        pb: 2 // Add padding at the bottom for spacing from audio player
                    }}>
                        {/* QA Chat Header */}
                        <Box sx={{
                            px: 2,
                            py: 1.5,
                            borderBottom: 1,
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            minHeight: 56,
                            backgroundColor: 'background.paper'
                        }}>
                            <PanelHeader
                                onClose={() => setActiveTab('full')}
                                onToggleFullScreen={() => { }}
                                onClearHistory={bookQA.clearHistory}
                                onOpenSettings={bookQA.openSettings}
                                fullScreen={false}
                            />
                        </Box>

                        {/* Chat Content */}
                        <ChatContent
                            messages={bookQA.messages}
                            messagesEndRef={messagesEndRef}
                            currentChapterNumber={chapter?.chapterNumber || 1}
                            currentChapterTitle={chapter?.title || ''}
                            fullScreen={true}
                            currentSentence={contentContext.getCurrentSentence()}
                            loading={bookQA.isLoading}
                            onTextSelection={handleTextSelection}
                            onReply={handleQaReply}
                            showExpandButton={chatInputCollapsed}
                            onExpandInput={handleExpandInput}
                        />

                        {/* Chat Input */}
                        {!chatInputCollapsed && (
                            <ChatInput
                                question={qaQuestion}
                                loading={bookQA.isLoading}
                                onQuestionChange={setQaQuestion}
                                onSubmit={handleQaSubmit}
                                onKeyPress={handleQaKeyPress}
                                fullScreen={true}
                                contextLines={bookQA.contextLines}
                                onContextLinesChange={bookQA.handleContextLinesChange}
                                selectedModelId={bookQA.selectedModelId}
                                onModelChange={bookQA.handleModelChange}
                                currentBookTitle={book?.title || ''}
                                currentChapterTitle={chapter?.title || ''}
                                currentChapterNumber={chapter?.chapterNumber || 1}
                                currentSentence={contentContext.getCurrentSentence()}
                                messages={bookQA.messages}
                                getLastSentences={() => contentContext.getLastSentences}
                                answerLength={bookQA.answerLength}
                                answerLevel={bookQA.answerLevel}
                                answerStyle={bookQA.answerStyle}
                                onCollapseInput={handleCollapseInput}
                            />
                        )}
                    </Box>
                ) : activeTab === 'overview' ? (
                    // Overview Tab
                    <BookOverviewPanel
                        isGenerating={chapterOverview.isGenerating}
                        overviews={chapterOverview.overviews}
                        selectedOverviewId={chapterOverview.selectedOverviewId}
                        selectedOverview={chapterOverview.selectedOverview}
                        selectedModelId={chapterOverview.selectedModelId}
                        selectedFormat={chapterOverview.selectedFormat}
                        selectedLength={chapterOverview.selectedLength}
                        selectedLevel={chapterOverview.selectedLevel}
                        error={chapterOverview.error}
                        onModelChange={chapterOverview.handleModelChange}
                        onFormatChange={chapterOverview.handleFormatChange}
                        onLengthChange={chapterOverview.handleLengthChange}
                        onLevelChange={chapterOverview.handleLevelChange}
                        onSelectOverview={chapterOverview.selectOverview}
                        onDeleteOverview={chapterOverview.deleteOverview}
                        onGenerateOverview={chapterOverview.generateOverview}
                        onClearError={chapterOverview.clearError}
                    />
                ) : (
                    <Paper
                        ref={scrollContainerRef}
                        elevation={0}
                        sx={{
                            maxWidth: isFullscreen ? '100%' : 800,
                            mx: 'auto',
                            p: isFullscreen ? { xs: 2, sm: 4 } : 1,
                            pb: isFullscreen ? { xs: 12, sm: 14 } : { xs: 20, sm: 16 },
                            borderRadius: 0,
                            height: isFullscreen ? '100vh' : 'calc(100vh - 200px)',
                            overflow: 'auto'
                        }}
                    >
                        {/* ReaderHeader - Hidden in fullscreen mode */}
                        {!isFullscreen && <ReaderHeader book={book} chapter={chapter} />}

                        <ReaderContent
                            chapter={chapter}
                            book={book}
                            scrollContainerRef={scrollContainerRef}
                            onNavigateToChapter={navigation.setCurrentChapterNumber}
                            onNavigateToChunk={navigation.setCurrentChunkIndex}
                            onNavigateToBookmark={navigation.handleNavigateToBookmark}
                            onChunkClick={handleChunkClick}
                            currentChunkIndex={audio.currentChunkIndex}
                            fontSize={settings.fontSize}
                            lineHeight={settings.lineHeight}
                            fontFamily={settings.fontFamily}
                            textColor={settings.textColor}
                            highlightColor={settings.highlightColor}
                            sentenceHighlightColor={settings.sentenceHighlightColor}
                            chunkSpacing={settings.chunkSpacing}
                            bionicReadingEnabled={settings.bionicReadingEnabled}
                        />
                    </Paper>
                )}

                {/* FAB buttons removed - now integrated into AudioControls */}

                {/* Fullscreen Text Controls - Only shown in fullscreen mode */}
                {activeTab === 'full' && isFullscreen && (
                    <FullscreenTextControls
                        fontSize={settings.fontSize}
                        onFontSizeChange={settings.handleFontSizeChange}
                        textColor={settings.textColor}
                        onTextColorChange={settings.handleTextColorChange}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={handleToggleFullscreen}
                        isAutoScrolling={isAutoScrollActive}
                        onToggleAutoScroll={handleToggleAutoScroll}
                        autoScrollSpeed={autoScrollSpeed}
                        onAutoScrollSpeedChange={settings.handleAutoScrollSpeedChange}
                        onPreviousSentence={handleFullscreenPrevSentence}
                        onNextSentence={handleFullscreenNextSentence}
                        canGoToPrevious={canGoPrevSentence}
                        canGoToNext={canGoNextSentence}
                        currentSentenceIndex={currentSentenceIndex}
                        totalSentences={sentences.length}
                    />
                )}

                {/* Audio Controls - Fixed at bottom (unified sentence controller for both modes) - Hidden in fullscreen mode */}
                {!(isFullscreen && activeTab === 'full') && (
                    <AudioControls
                        chapterTitle={`Chapter ${chapter.chapterNumber}: ${chapter.title}`}
                        currentChunk={sentenceAudio.controller.currentSentenceIndex + 1}
                        totalChunks={sentenceAudio.sentences.length}
                        onPlay={handleUserPlay}
                        onPause={sentenceAudio.controller.pause}
                        onPreviousChunk={handlePreviousChunk}
                        onNextChunk={handleNextChunk}
                        onPreviousChapter={navigation.handlePreviousChapter}
                        onNextChapter={navigation.handleNextChapter}
                        onBookmark={bookmarks.handleBookmark}
                        onSettings={settings.handleSettings}
                        onSpeedSettings={settings.handleSpeedSettings}
                        onAskAI={handleOpenQAChat}
                        onQuickPrompts={handleOpenQuickPrompts}
                        isPlaying={sentenceAudio.controller.isPlaying}
                        ttsEnabled={settings.ttsEnabled}
                        isCurrentChunkLoading={sentenceAudio.controller.isCurrentSentenceLoading}
                        isBookmarked={bookmarks.isBookmarked}
                        progress={(sentenceAudio.controller.currentSentenceIndex / Math.max(sentenceAudio.sentences.length - 1, 1)) * 100}
                        playbackSpeed={settings.playbackSpeed}
                        bookmarks={bookmarks.bookmarks}
                        currentChapterNumber={chapter.chapterNumber}
                        currentChunkIndex={audio.currentChunkIndex}
                        totalChapters={book.totalChapters}
                        onNavigateToBookmark={navigation.handleNavigateToBookmark}
                        onNavigateToChunk={sentenceAudio.controller.goToSentence}
                        progressData={progress}
                        onChapters={chapterDialog.openDialog}
                        minChapterNumber={book?.chapterStartNumber ?? 1}
                        ttsServiceAvailable={sentenceAudio.controller.ttsServiceAvailable}
                        ttsError={
                            // Only show errors for the current sentence (not preloading errors)
                            sentenceAudio.controller.ttsError &&
                                sentenceAudio.controller.ttsError.sentenceIndex === sentenceAudio.controller.currentSentenceIndex
                                ? {
                                    code: 'TTS_ERROR',
                                    message: sentenceAudio.controller.ttsError.message,
                                    timestamp: new Date().toISOString()
                                }
                                : null
                        }
                        onDismissError={sentenceAudio.controller.clearError}
                        chapterTransitionLoading={chapterTransitionLoading}
                        unitLabelOverride="sentences"
                        estimatedTimeRemaining={estimatedTimeRemaining}
                        hideChapterInfo={activeTab === 'qa' || activeTab === 'overview'}
                        onJumpToCurrentChunk={handleScrollToCurrentChunk}
                        showJumpToCurrentChunk={activeTab === 'full'}
                        onToggleFullscreen={handleToggleFullscreen}
                        showFullscreenButton={activeTab === 'full' && !isFullscreen}
                        onGoToTop={handleGoToTop}
                    />
                )}

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
                    currentChunkSpacing={settings.chunkSpacing}
                    currentAutoScrollSpeed={settings.autoScrollSpeed}
                    onThemeChange={settings.handleThemeChange}
                    onHighlightColorChange={settings.handleHighlightColorChange}
                    onSentenceHighlightColorChange={settings.handleSentenceHighlightColorChange}
                    onFontSizeChange={settings.handleFontSizeChange}
                    onLineHeightChange={settings.handleLineHeightChange}
                    onFontFamilyChange={settings.handleFontFamilyChange}
                    onTextColorChange={settings.handleTextColorChange}
                    onChunkSpacingChange={settings.handleChunkSpacingChange}
                    onAutoScrollSpeedChange={settings.handleAutoScrollSpeedChange}
                    highlightMode={settings.highlightMode}
                    onHighlightModeChange={settings.handleHighlightModeChange}
                    autoFontScaling={settings.autoFontScaling}
                    onAutoFontScalingChange={settings.handleAutoFontScalingChange}
                    bionicReadingEnabled={settings.bionicReadingEnabled}
                    onBionicReadingChange={settings.handleBionicReadingChange}
                    onResetToDefaults={settings.handleResetToDefaults}
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

                {/* Chapter Overview Cost Approval Dialog */}
                <CostApprovalDialog
                    open={chapterOverview.showCostApprovalDialog}
                    estimatedCost={chapterOverview.estimatedCost || 0}
                    onApprove={() => chapterOverview.handleCostApproval(true)}
                    onCancel={() => chapterOverview.handleCostApproval(false)}
                />

                {/* Chapter Selector Dialog */}
                <ChapterSelector
                    bookId={book?._id || ''}
                    currentChapterNumber={chapter?.chapterNumber || 1}
                    open={chapterDialog.isOpen}
                    onClose={chapterDialog.closeDialog}
                    onChapterSelect={navigation.setCurrentChapterNumber}
                />

                {/* Quick Prompts Dialog */}
                <QuickPromptsDialog
                    open={quickPromptsOpen}
                    onClose={handleCloseQuickPrompts}
                    onSelectPrompt={handleSelectPrompt}
                    onOpenSettings={bookQA.openSettings}
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

                {/* Chapter Navigation Error Alert */}
                <Snackbar
                    open={!!navigationError}
                    autoHideDuration={6000}
                    onClose={clearNavigationError}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                >
                    <Alert
                        onClose={clearNavigationError}
                        severity="error"
                        sx={{ width: '100%' }}
                    >
                        {navigationError}
                    </Alert>
                </Snackbar>
            </Box>
        </UserThemeProvider>
    );
};

