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
    alpha
} from '@mui/material';
import {
    Close,
    Send,
    Fullscreen,
    FullscreenExit,
    Settings,
    DeleteSweep
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { ChatMessage } from '../../../../apis/bookContentChat/types';

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
}

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentBookTitle,
    currentChapterTitle,
    currentChapterNumber,
    currentSentence
}) => {
    const [question, setQuestion] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (question.trim() && !loading) {
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
                        position: 'relative',
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
                    backgroundColor: theme.palette.background.default
                }}>
                    <ChatContent
                        messages={messages}
                        messagesEndRef={messagesEndRef}
                        currentChapterNumber={currentChapterNumber}
                        currentChapterTitle={currentChapterTitle}
                        fullScreen={true}
                        currentSentence={currentSentence}
                    />
                    <ChatInput
                        question={question}
                        loading={loading}
                        onQuestionChange={setQuestion}
                        onSubmit={handleSubmit}
                        onKeyPress={handleKeyPress}
                        fullScreen={true}
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
    currentSentence
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
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)'
                        }}
                    >
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
                        {message.role === 'assistant' && (
                            <Box
                                sx={{
                                    mt: 2,
                                    pt: 2,
                                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`
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
                            <span> • ${message.cost.toFixed(4)}</span>
                        )}
                    </Typography>
                </Box>
            ))}
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
}

const ChatInput: React.FC<ChatInputProps> = ({
    question,
    loading,
    onQuestionChange,
    onSubmit,
    onKeyPress,
    fullScreen
}) => {
    const theme = useTheme();

    return (
        <Box
            component="form"
            onSubmit={onSubmit}
            sx={{
                p: 3,
                borderTop: fullScreen ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : 'none',
                display: 'flex',
                gap: 2,
                alignItems: 'flex-end',
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
            }}
        >
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
    );
}; 