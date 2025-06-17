import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    IconButton,
    CircularProgress,
    Dialog,
    AppBar,
    Toolbar,
    Slide,
    useTheme,
    useMediaQuery,
    alpha,
    FormControl,
    Select,
    MenuItem,
    Chip,
    Stack,
    Button,
    InputAdornment
} from '@mui/material';
import {
    Close,
    Send,
    Fullscreen,
    FullscreenExit,
    Settings,
    DeleteSweep,
    Clear,
    OpenInNew
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { ChatMessage } from '../../../../apis/bookContentChat/types';
import { getAllModels } from '../../../../server/ai/models';
import ReactMarkdown from 'react-markdown';
import { TypingIndicator } from './TypingIndicator';

interface BookQAPanelProps {
    open: boolean;
    fullScreen: boolean;
    loading: boolean;
    messages: ChatMessage[];
    onClose: () => void;
    onToggleFullScreen: () => void;
    onSubmitQuestion: (question: string) => void;
    onClearHistory: () => void;
    onOpenSettings: () => void;
    currentBookTitle: string;
    currentChapterTitle: string;
    currentChapterNumber: number;
    currentSentence: string;
    contextLines: number;
    onContextLinesChange: (lines: number) => void;
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    onSetReplyContext: (messageIndex: number, messageContent: string) => void;
}

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

function buildContextPrompt(
    bookTitle: string,
    chapterTitle: string,
    chapterNumber: number,
    currentSentence: string,
    lastSentences: string,
    question: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string; chapterContext: { number: number; title: string; } }>,
    externalPrompt?: boolean
): string {
    let prompt = `You are a helpful reading assistant for the book "${bookTitle}". The reader is currently in Chapter ${chapterNumber}: "${chapterTitle}".

`;

    // Check if this is a reply to a specific AI message (based on question prefix)
    const isReply = question.startsWith('Reply to:');

    if (!isReply) {
        prompt += `Current reading context:
Previous sentences: ${lastSentences}
Current sentence: ${currentSentence}

`;
    }

    // Include conversation history (last 4 messages) if available and not external prompt
    if (!externalPrompt && conversationHistory && conversationHistory.length > 0) {
        prompt += "Previous conversation:\n";
        const recentHistory = conversationHistory.slice(-4); // Last 4 messages

        for (const message of recentHistory) {
            const roleLabel = message.role === 'user' ? 'Reader' : 'Assistant';
            prompt += `${roleLabel} (Chapter ${message.chapterContext.number}): ${message.content}\n`;
        }
        prompt += "\n";
    }

    if (isReply) {
        prompt += `Reader's follow-up question: ${question}

Please provide a helpful response to this follow-up question about your previous response.`;
    } else {
        prompt += `Reader's question about the current text: ${question}

Please provide a helpful response based on the current reading context above. The reader is asking about the text they are currently reading.`;
    }

    return prompt;
}

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
    onSetReplyContext
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

    // Auto-scroll when loading state changes (when answer arrives)
    useEffect(() => {
        if (!loading && messages.length > 0) {
            // Small delay to ensure the message is rendered
            setTimeout(scrollToBottom, 100);
        }
    }, [loading, messages.length]);

    // Auto-scroll when opening or expanding chat
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
            // Aggressive immediate scrolling - no delay at all
            messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
            // Double-call to ensure it works even during state changes
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
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                                color="inherit"
                                onClick={onOpenSettings}
                                aria-label="settings"
                                sx={{
                                    borderRadius: '12px',
                                    width: 44,
                                    height: 44,
                                    transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                                    '&:hover': {
                                        backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                        transform: 'scale(1.05)'
                                    },
                                    '&:active': {
                                        transform: 'scale(0.95)'
                                    }
                                }}
                            >
                                <Settings />
                            </IconButton>
                            <IconButton
                                color="inherit"
                                onClick={onClearHistory}
                                aria-label="clear"
                                sx={{
                                    borderRadius: '12px',
                                    width: 44,
                                    height: 44,
                                    transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                                    '&:hover': {
                                        backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                        transform: 'scale(1.05)'
                                    },
                                    '&:active': {
                                        transform: 'scale(0.95)'
                                    }
                                }}
                            >
                                <DeleteSweep />
                            </IconButton>
                            <IconButton
                                color="inherit"
                                onClick={onToggleFullScreen}
                                aria-label="minimize"
                                sx={{
                                    borderRadius: '12px',
                                    width: 44,
                                    height: 44,
                                    transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                                    '&:hover': {
                                        backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                        transform: 'scale(1.05)'
                                    },
                                    '&:active': {
                                        transform: 'scale(0.95)'
                                    }
                                }}
                            >
                                <FullscreenExit />
                            </IconButton>
                            <IconButton
                                color="inherit"
                                onClick={onClose}
                                aria-label="close"
                                sx={{
                                    borderRadius: '12px',
                                    width: 44,
                                    height: 44,
                                    transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                                    '&:hover': {
                                        backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                        transform: 'scale(1.05)'
                                    },
                                    '&:active': {
                                        transform: 'scale(0.95)'
                                    }
                                }}
                            >
                                <Close />
                            </IconButton>
                        </Box>
                    </Toolbar>
                </AppBar>
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: theme.palette.background.default,
                    pt: '64px' // Account for fixed AppBar
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
                        onReply={(messageIndex, messageContent) => {
                            onSetReplyContext(messageIndex, messageContent);
                            setQuestion(`Reply to: "${messageContent.slice(0, 50)}${messageContent.length > 50 ? '...' : ''}" - `);
                        }}
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
            {/* Panel Header */}
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
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={onOpenSettings}
                        sx={{
                            color: theme.palette.text.secondary,
                            borderRadius: '8px',
                            width: 36,
                            height: 36,
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                transform: 'scale(1.05)',
                                color: theme.palette.text.primary
                            },
                            '&:active': {
                                transform: 'scale(0.95)'
                            }
                        }}
                    >
                        <Settings fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={onClearHistory}
                        sx={{
                            color: theme.palette.text.secondary,
                            borderRadius: '8px',
                            width: 36,
                            height: 36,
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                transform: 'scale(1.05)',
                                color: theme.palette.text.primary
                            },
                            '&:active': {
                                transform: 'scale(0.95)'
                            }
                        }}
                    >
                        <DeleteSweep fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={onToggleFullScreen}
                        sx={{
                            color: theme.palette.text.secondary,
                            borderRadius: '8px',
                            width: 36,
                            height: 36,
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                transform: 'scale(1.05)',
                                color: theme.palette.text.primary
                            },
                            '&:active': {
                                transform: 'scale(0.95)'
                            }
                        }}
                    >
                        <Fullscreen fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={onClose}
                        sx={{
                            color: theme.palette.text.secondary,
                            borderRadius: '8px',
                            width: 36,
                            height: 36,
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                transform: 'scale(1.05)',
                                color: theme.palette.text.primary
                            },
                            '&:active': {
                                transform: 'scale(0.95)'
                            }
                        }}
                    >
                        <Close fontSize="small" />
                    </IconButton>
                </Box>
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
            />
        </Paper>
    );
};

interface ChatContentProps {
    messages: ChatMessage[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    currentChapterNumber: number;
    currentChapterTitle: string;
    fullScreen: boolean;
    currentSentence: string;
    loading: boolean;
    onTextSelection: (selectedText: string) => void;
    onReply: (messageIndex: number, messageContent: string) => void;
}

const ChatContent: React.FC<ChatContentProps> = ({
    messages,
    messagesEndRef,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentChapterNumber,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentChapterTitle,
    fullScreen,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentSentence,
    loading,
    onTextSelection,
    onReply
}) => {
    const theme = useTheme();

    if (messages.length === 0) {
        return (
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 4,
                    textAlign: 'center'
                }}
            >
                <Box
                    sx={{
                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                        borderRadius: '16px',
                        p: 3,
                        maxWidth: 280,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`
                    }}
                >
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{
                            fontSize: fullScreen ? '1rem' : '0.875rem',
                            lineHeight: 1.5,
                            fontWeight: 500
                        }}
                    >
                        Ask me anything about this book! I can help explain characters, plot points, themes, and more.
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                flex: 1,
                overflow: 'auto',
                px: 3,
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 3
            }}
        >
            {messages.map((message, index) => (
                <Box
                    key={index}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                        px: 1
                    }}
                >
                    <Box
                        sx={{
                            maxWidth: '85%',
                            minWidth: 80,
                            backgroundColor: message.role === 'user'
                                ? theme.palette.primary.main
                                : alpha(theme.palette.background.default, 0.6),
                            color: message.role === 'user'
                                ? theme.palette.primary.contrastText
                                : theme.palette.text.primary,
                            borderRadius: message.role === 'user'
                                ? '20px 20px 6px 20px'
                                : '20px 20px 20px 6px',
                            px: 3,
                            py: 2,
                            border: message.role === 'assistant'
                                ? `1px solid ${alpha(theme.palette.divider, 0.08)}`
                                : 'none',
                            boxShadow: message.role === 'user'
                                ? theme.palette.mode === 'light'
                                    ? '0 2px 8px rgba(0,0,0,0.12)'
                                    : '0 2px 8px rgba(0,0,0,0.24)'
                                : theme.palette.mode === 'light'
                                    ? '0 1px 3px rgba(0,0,0,0.08)'
                                    : '0 1px 3px rgba(0,0,0,0.16)',
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                            userSelect: 'text',
                            cursor: 'text'
                        }}
                        onMouseUp={() => {
                            const selection = window.getSelection();
                            const selectedText = selection?.toString();
                            if (selectedText && selectedText.trim()) {
                                onTextSelection(selectedText);
                            }
                        }}
                    >
                        {message.role === 'assistant' ? (
                            <ReactMarkdown
                                components={{
                                    p: ({ children }) => (
                                        <Typography
                                            component="div"
                                            sx={{
                                                fontSize: fullScreen ? '1rem' : '0.875rem',
                                                lineHeight: 1.5,
                                                fontWeight: 400,
                                                margin: 0,
                                                '&:not(:last-child)': { mb: 1 }
                                            }}
                                        >
                                            {children}
                                        </Typography>
                                    ),
                                    strong: ({ children }) => (
                                        <Typography component="span" sx={{ fontWeight: 600 }}>
                                            {children}
                                        </Typography>
                                    ),
                                    em: ({ children }) => (
                                        <Typography component="span" sx={{ fontStyle: 'italic' }}>
                                            {children}
                                        </Typography>
                                    ),
                                    ul: ({ children }) => (
                                        <Box component="ul" sx={{ mt: 1, mb: 1, pl: 2 }}>
                                            {children}
                                        </Box>
                                    ),
                                    ol: ({ children }) => (
                                        <Box component="ol" sx={{ mt: 1, mb: 1, pl: 2 }}>
                                            {children}
                                        </Box>
                                    ),
                                    li: ({ children }) => (
                                        <Typography
                                            component="li"
                                            sx={{
                                                fontSize: fullScreen ? '1rem' : '0.875rem',
                                                lineHeight: 1.5,
                                                mb: 0.5
                                            }}
                                        >
                                            {children}
                                        </Typography>
                                    ),
                                    code: ({ children }) => (
                                        <Typography
                                            component="code"
                                            sx={{
                                                backgroundColor: alpha(theme.palette.background.paper, 0.6),
                                                px: 0.5,
                                                py: 0.25,
                                                borderRadius: '4px',
                                                fontSize: '0.85em',
                                                fontFamily: 'monospace'
                                            }}
                                        >
                                            {children}
                                        </Typography>
                                    ),
                                    blockquote: ({ children }) => (
                                        <Box
                                            sx={{
                                                borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                                pl: 2,
                                                my: 1,
                                                fontStyle: 'italic',
                                                color: alpha(theme.palette.text.primary, 0.8)
                                            }}
                                        >
                                            {children}
                                        </Box>
                                    )
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        ) : (
                            <Typography
                                variant="body1"
                                sx={{
                                    fontSize: fullScreen ? '1rem' : '0.875rem',
                                    lineHeight: 1.5,
                                    fontWeight: 400,
                                    whiteSpace: 'pre-wrap'
                                }}
                            >
                                {message.content}
                            </Typography>
                        )}
                        {message.role === 'user' && message.currentSentence && (
                            <Box
                                sx={{
                                    mt: 1.5,
                                    pt: 1.5,
                                    borderTop: `1px solid ${alpha(theme.palette.primary.contrastText, 0.2)}`,
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                                        fontWeight: 400,
                                        color: alpha(theme.palette.primary.contrastText, 0.8),
                                        fontStyle: 'italic',
                                        lineHeight: 1.4
                                    }}
                                >
                                    Replying to: &ldquo;{message.currentSentence}&rdquo;
                                </Typography>
                            </Box>
                        )}
                        {message.role === 'user' && message.replyTo && (
                            <Box
                                sx={{
                                    mt: 1.5,
                                    pt: 1.5,
                                    borderTop: `1px solid ${alpha(theme.palette.primary.contrastText, 0.2)}`,
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                                        fontWeight: 400,
                                        color: alpha(theme.palette.primary.contrastText, 0.8),
                                        fontStyle: 'italic',
                                        lineHeight: 1.4
                                    }}
                                >
                                    Replying to AI: &ldquo;{message.replyTo.content.slice(0, 100)}{message.replyTo.content.length > 100 ? '...' : ''}&rdquo;
                                </Typography>
                            </Box>
                        )}
                        {message.role === 'assistant' && (
                            <Box
                                sx={{
                                    mt: 2,
                                    pt: 2,
                                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                                        fontWeight: 500,
                                        color: alpha(theme.palette.text.secondary, 0.7),
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1
                                    }}
                                >
                                    📖 Chapter {message.chapterContext.number}: {message.chapterContext.title}
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={() => onReply(index, message.content)}
                                    sx={{
                                        fontSize: fullScreen ? '0.6875rem' : '0.625rem',
                                        color: alpha(theme.palette.text.secondary, 0.7),
                                        minWidth: 'auto',
                                        px: 1,
                                        py: 0.5,
                                        textTransform: 'none',
                                        '&:hover': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.08)
                                        }
                                    }}
                                >
                                    Reply
                                </Button>
                            </Box>
                        )}
                    </Box>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            mt: 1,
                            mx: 2,
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            fontWeight: 400,
                            opacity: 0.6
                        }}
                    >
                        {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                        {message.role === 'assistant' && message.cost && (
                            <span> • ${message.cost.toFixed(4)}{message.estimatedCost ? ` ($${message.estimatedCost.toFixed(4)})` : ''}</span>
                        )}
                    </Typography>
                </Box>
            ))}

            {/* Show typing indicator when loading */}
            {loading && <TypingIndicator fullScreen={fullScreen} />}

            <div ref={messagesEndRef} />
        </Box>
    );
};

interface ChatInputProps {
    question: string;
    loading: boolean;
    onQuestionChange: (question: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    fullScreen: boolean;
    contextLines: number;
    onContextLinesChange: (lines: number) => void;
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    currentBookTitle: string;
    currentChapterTitle: string;
    currentChapterNumber: number;
    currentSentence: string;
    messages: ChatMessage[];
}

const ChatInput: React.FC<ChatInputProps> = ({
    question,
    loading,
    onQuestionChange,
    onSubmit,
    onKeyPress,
    fullScreen,
    contextLines,
    onContextLinesChange,
    selectedModelId,
    onModelChange,
    currentBookTitle,
    currentChapterTitle,
    currentChapterNumber,
    currentSentence,
    messages
}) => {
    const theme = useTheme();

    const quickQuestions = [
        'Explain Simply',
        'Summarize the last few sentences',
    ];

    const handleQuickQuestion = (quickQuestion: string) => {
        const fullQuestion = question.trim()
            ? `${quickQuestion}: ${question.trim()}`
            : quickQuestion;
        onQuestionChange(fullQuestion);
    };
    
    const handleClearInput = () => {
        onQuestionChange('');
    };

    const handleOpenInChatGPT = () => {
        if (!question.trim()) return;

        // Generate the same context as the server would
        const conversationHistory = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            chapterContext: {
                number: msg.chapterContext.number,
                title: msg.chapterContext.title
            }
        }));

        // Use current sentence as last sentences since we don't have access to the full context
        const lastSentences = currentSentence;

        const prompt = buildContextPrompt(
            currentBookTitle,
            currentChapterTitle,
            currentChapterNumber,
            currentSentence,
            lastSentences,
            question.trim(),
            conversationHistory,
            true
        );

        const chatGPTUrl = `https://chatgpt.com/?model=gpt-4o&q=${encodeURIComponent(prompt)}`;
        window.open(chatGPTUrl, '_blank');
    };

    return (
        <Box
            sx={{
                p: 3,
                borderTop: fullScreen ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : 'none',
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
            }}
        >
            {/* Quick Questions */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                {quickQuestions.map((quickQ) => (
                    <Chip
                        key={quickQ}
                        label={quickQ}
                        size="small"
                        onClick={() => handleQuickQuestion(quickQ)}
                        disabled={loading}
                        sx={{
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            height: 24,
                            borderRadius: '12px',
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            color: theme.palette.primary.main,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.15),
                                transform: 'scale(1.02)'
                            },
                            '&:active': {
                                transform: 'scale(0.98)'
                            }
                        }}
                    />
                ))}
            </Stack>

            {/* Main Input Row */}
            <Box
                component="form"
                onSubmit={onSubmit}
                sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    mb: 2
                }}
            >
                {/* Text Input */}
                <TextField
                    fullWidth
                    multiline
                    maxRows={fullScreen ? 6 : 3}
                    placeholder="Ask a question about the book..."
                    value={question}
                    onChange={(e) => onQuestionChange(e.target.value)}
                    onKeyPress={onKeyPress}
                    disabled={loading}
                    variant="outlined"
                    InputProps={{
                        endAdornment: question && (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={handleClearInput}
                                    disabled={loading}
                                    sx={{
                                        color: alpha(theme.palette.text.secondary, 0.7),
                                        '&:hover': {
                                            color: theme.palette.text.primary,
                                        }
                                    }}
                                >
                                    <Clear fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                    sx={{
                        '& .MuiInputBase-root': {
                            fontSize: fullScreen ? '1rem' : '0.875rem',
                            borderRadius: '20px',
                            backgroundColor: alpha(theme.palette.background.default, 0.6),
                            border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                            '&:hover': {
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                backgroundColor: alpha(theme.palette.background.default, 0.8)
                            },
                            '&.Mui-focused': {
                                border: `2px solid ${theme.palette.primary.main}`,
                                backgroundColor: theme.palette.background.paper,
                                boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`
                            }
                        },
                        '& .MuiInputBase-input': {
                            padding: '12px 16px',
                            lineHeight: 1.5
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none'
                        },
                        '& .MuiInputBase-input::placeholder': {
                            color: alpha(theme.palette.text.secondary, 0.6),
                            opacity: 1
                        }
                    }}
                />

                {/* ChatGPT Button */}
                <IconButton
                    onClick={handleOpenInChatGPT}
                    disabled={!question.trim() || loading}
                    title="Open in ChatGPT"
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '8px',
                        backgroundColor: alpha(theme.palette.text.secondary, 0.08),
                        color: question.trim() && !loading
                            ? theme.palette.text.secondary
                            : theme.palette.action.disabled,
                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                        '&:hover': {
                            backgroundColor: alpha(theme.palette.text.secondary, 0.15),
                            transform: question.trim() && !loading ? 'scale(1.05)' : 'none'
                        },
                        '&:active': {
                            transform: question.trim() && !loading ? 'scale(0.95)' : 'none'
                        },
                        '&:disabled': {
                            backgroundColor: alpha(theme.palette.action.disabled, 0.12),
                            color: theme.palette.action.disabled
                        }
                    }}
                >
                    <OpenInNew sx={{ fontSize: 16 }} />
                </IconButton>

                {/* Send Button */}
                <IconButton
                    type="submit"
                    disabled={!question.trim() || loading}
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: question.trim() && !loading
                            ? theme.palette.primary.main
                            : alpha(theme.palette.action.disabled, 0.12),
                        color: question.trim() && !loading
                            ? theme.palette.primary.contrastText
                            : theme.palette.action.disabled,
                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                        boxShadow: question.trim() && !loading
                            ? theme.palette.mode === 'light'
                                ? '0 2px 8px rgba(0,0,0,0.15)'
                                : '0 2px 8px rgba(0,0,0,0.3)'
                            : 'none',
                        '&:hover': {
                            backgroundColor: question.trim() && !loading
                                ? theme.palette.primary.dark
                                : alpha(theme.palette.action.disabled, 0.12),
                            transform: question.trim() && !loading ? 'scale(1.05)' : 'none'
                        },
                        '&:active': {
                            transform: question.trim() && !loading ? 'scale(0.95)' : 'none'
                        },
                        '&:disabled': {
                            backgroundColor: alpha(theme.palette.action.disabled, 0.12),
                            color: theme.palette.action.disabled
                        }
                    }}
                >
                    {loading ? (
                        <CircularProgress
                            size={20}
                            sx={{
                                color: theme.palette.action.disabled
                            }}
                        />
                    ) : (
                        <Send sx={{ fontSize: 20 }} />
                    )}
                </IconButton>
            </Box>

            {/* Context Lines Selector - Under input */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                {/* Context Selector */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            color: 'text.secondary',
                            minWidth: 'auto'
                        }}
                    >
                        Context:
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 60 }}>
                        <Select
                            value={contextLines}
                            onChange={(e) => onContextLinesChange(Number(e.target.value))}
                            disabled={loading}
                            sx={{
                                fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                                height: 28,
                                borderRadius: '6px',
                                backgroundColor: alpha(theme.palette.background.default, 0.6),
                                '& .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${alpha(theme.palette.divider, 0.12)}`
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${theme.palette.primary.main}`
                                }
                            }}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                <MenuItem key={num} value={num} sx={{ fontSize: fullScreen ? '0.75rem' : '0.6875rem' }}>
                                    {num}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            color: 'text.secondary'
                        }}
                    >
                        lines
                    </Typography>
                </Box>

                {/* Model Selector */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            color: 'text.secondary',
                            minWidth: 'auto'
                        }}
                    >
                        Model:
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                            value={selectedModelId}
                            onChange={(e) => onModelChange(e.target.value)}
                            disabled={loading}
                            sx={{
                                fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                                height: 28,
                                borderRadius: '6px',
                                backgroundColor: alpha(theme.palette.background.default, 0.6),
                                '& .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${alpha(theme.palette.divider, 0.12)}`
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${theme.palette.primary.main}`
                                }
                            }}
                        >
                            {getAllModels().map((model) => (
                                <MenuItem
                                    key={model.id}
                                    value={model.id}
                                    sx={{ fontSize: fullScreen ? '0.75rem' : '0.6875rem' }}
                                >
                                    {model.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Box>
        </Box>
    );
}; 