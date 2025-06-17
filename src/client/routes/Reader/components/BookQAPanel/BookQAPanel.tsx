import React, { useState, useRef, useEffect } from 'react';
import {
    Paper,
    Dialog,
    AppBar,
    Toolbar,
    Slide,
    useTheme,
    useMediaQuery,
    alpha,
    Box
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { BookQAPanelProps } from './types';
import { ChatContent } from './ChatContent';
import { ChatInput } from './ChatInput';
import { PanelHeader } from './PanelHeader';

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export const BookQAPanel: React.FC<BookQAPanelProps> = ({
    open,
    fullScreen,
    loading,
    messages,
    onClose,
    onToggleFullScreen,
    onSubmitQuestion,
    onClearHistory,
    onOpenSettings,
    currentBookTitle,
    currentChapterTitle,
    currentChapterNumber,
    currentSentence,
    contextLines,
    onContextLinesChange,
    selectedModelId,
    onModelChange,
    onSetReplyContext,
    getLastSentences,
    answerLength,
    answerLevel,
    answerStyle
}) => {
    const [question, setQuestion] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!loading && messages.length > 0) {
            setTimeout(scrollToBottom, 100);
        }
    }, [loading, messages.length]);

    useEffect(() => {
        if (open) {
            setTimeout(scrollToBottom, 200);
        }
    }, [open]);

    useEffect(() => {
        if (fullScreen) {
            setTimeout(scrollToBottom, 200);
        }
    }, [fullScreen]);

    const handleTextSelection = (selectedText: string) => {
        if (selectedText.trim()) {
            setQuestion(selectedText.trim());
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (question.trim() && !loading) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 0);
            onSubmitQuestion(question.trim());
            setQuestion('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleReply = (messageIndex: number, messageContent: string) => {
        onSetReplyContext(messageIndex, messageContent);
        setQuestion(`Reply to: "${messageContent.slice(0, 50)}${messageContent.length > 50 ? '...' : ''}" - `);
    };

    if (fullScreen) {
        return (
            <Dialog
                fullScreen
                open={open}
                onClose={onClose}
                TransitionComponent={Transition}
                sx={{
                    '& .MuiDialog-paper': {
                        borderRadius: 0,
                        backgroundColor: theme.palette.background.default
                    }
                }}
            >
                <AppBar
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1400,
                        backgroundColor: alpha(theme.palette.background.paper, 0.9),
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        color: theme.palette.text.primary,
                        boxShadow: `0 1px 3px ${alpha(theme.palette.divider, 0.12)}`,
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`
                    }}
                >
                    <Toolbar sx={{ px: 3, minHeight: '64px !important', justifyContent: 'flex-end' }}>
                        <PanelHeader
                            onClose={onClose}
                            onToggleFullScreen={onToggleFullScreen}
                            onClearHistory={onClearHistory}
                            onOpenSettings={onOpenSettings}
                            fullScreen={true}
                        />
                    </Toolbar>
                </AppBar>
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: theme.palette.background.default,
                    pt: '64px'
                }}>
                    <ChatContent
                        messages={messages}
                        messagesEndRef={messagesEndRef}
                        currentChapterNumber={currentChapterNumber}
                        currentChapterTitle={currentChapterTitle}
                        fullScreen={true}
                        currentSentence={currentSentence}
                        loading={loading}
                        onTextSelection={handleTextSelection}
                        onReply={handleReply}
                    />
                    <ChatInput
                        question={question}
                        loading={loading}
                        onQuestionChange={setQuestion}
                        onSubmit={handleSubmit}
                        onKeyPress={handleKeyPress}
                        fullScreen={true}
                        contextLines={contextLines}
                        onContextLinesChange={onContextLinesChange}
                        selectedModelId={selectedModelId}
                        onModelChange={onModelChange}
                        currentBookTitle={currentBookTitle}
                        currentChapterTitle={currentChapterTitle}
                        currentChapterNumber={currentChapterNumber}
                        currentSentence={currentSentence}
                        messages={messages}
                        getLastSentences={getLastSentences}
                        answerLength={answerLength}
                        answerLevel={answerLevel}
                        answerStyle={answerStyle}
                    />
                </Box>
            </Dialog>
        );
    }

    if (!open) return null;

    return (
        <Paper
            elevation={0}
            sx={{
                position: 'fixed',
                bottom: isMobile ? 80 : 100,
                right: isMobile ? 8 : 16,
                left: isMobile ? 8 : 'auto',
                width: isMobile ? 'auto' : 400,
                height: 'auto',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1300,
                backgroundColor: theme.palette.background.paper,
                borderRadius: '16px',
                border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                boxShadow: theme.palette.mode === 'light'
                    ? '0 4px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)'
                    : '0 4px 24px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.16)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                overflow: 'hidden'
            }}
        >
            <Box
                sx={{
                    px: 2,
                    py: 1,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    minHeight: 48,
                    backgroundColor: alpha(theme.palette.background.paper, 0.8),
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)'
                }}
            >
                <PanelHeader
                    onClose={onClose}
                    onToggleFullScreen={onToggleFullScreen}
                    onClearHistory={onClearHistory}
                    onOpenSettings={onOpenSettings}
                    fullScreen={false}
                />
            </Box>

            <ChatInput
                question={question}
                loading={loading}
                onQuestionChange={setQuestion}
                onSubmit={handleSubmit}
                onKeyPress={handleKeyPress}
                fullScreen={false}
                contextLines={contextLines}
                onContextLinesChange={onContextLinesChange}
                selectedModelId={selectedModelId}
                onModelChange={onModelChange}
                currentBookTitle={currentBookTitle}
                currentChapterTitle={currentChapterTitle}
                currentChapterNumber={currentChapterNumber}
                currentSentence={currentSentence}
                messages={messages}
                getLastSentences={getLastSentences}
                answerLength={answerLength}
                answerLevel={answerLevel}
                answerStyle={answerStyle}
            />
        </Paper>
    );
}; 