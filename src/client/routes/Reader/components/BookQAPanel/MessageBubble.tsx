import React from 'react';
import { Box, Typography, Button, alpha, useTheme } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import { MessageBubbleProps } from './types';

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    index,
    fullScreen,
    onTextSelection,
    onReply
}) => {
    const theme = useTheme();

    return (
        <Box
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
    );
}; 