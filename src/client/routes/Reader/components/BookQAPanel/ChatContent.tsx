import React, { useEffect } from 'react';
import { Box, Typography, alpha, useTheme, Tooltip } from '@mui/material';
import { KeyboardArrowUp } from '@mui/icons-material';
import { ChatContentProps } from './types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

/**
 * ChatContent Component
 * 
 * IMPORTANT: This component is SHARED across multiple contexts:
 * 1. QA Chat Tab (ReaderUI.tsx) - Rendered directly in the tab view
 * 2. BookQAPanel - Floating panel mode
 * 3. BookQAPanel - Fullscreen dialog mode
 * 
 * Any changes to this component will affect ALL three contexts.
 * 
 * Core Responsibilities:
 * - Renders the list of chat messages
 * - Handles auto-scrolling behavior (scrolls to top of AI messages, bottom for user messages)
 * - Displays empty state when no messages exist
 * - Shows typing indicator during AI response generation
 * 
 * When fixing bugs related to message display or scrolling:
 * - Check this component FIRST before modifying parent wrappers
 * - Test changes in all three contexts (QA Tab, Panel, Fullscreen)
 */
export const ChatContent: React.FC<ChatContentProps> = ({
    messages,
    messagesEndRef,
    fullScreen,
    loading,
    onTextSelection,
    onReply,
    showExpandButton = false,
    onExpandInput
}) => {
    const theme = useTheme();

    // Scroll to assistant message top when it arrives
    useEffect(() => {
        if (messages.length === 0 || loading) return;

        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage.role === 'assistant') {
            // AI just responded - scroll to TOP of the message
            const lastIndex = messages.length - 1;
            setTimeout(() => {
                const el = document.querySelector(`[data-message-index="${lastIndex}"]`) as HTMLElement | null;
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 150);
        } else {
            // User message - scroll to bottom
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [messages, loading, messagesEndRef]);

    if (messages.length === 0) {
        return (
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 0,
                    textAlign: 'center'
                }}
            >
                <Box
                    sx={{
                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                        borderRadius: '16px',
                        p: 0,
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
                px: 0.5,
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                position: 'relative'
            }}
        >
            {messages.map((message, index) => (
                <MessageBubble
                    key={index}
                    message={message}
                    index={index}
                    fullScreen={fullScreen}
                    onTextSelection={onTextSelection}
                    onReply={onReply}
                />
            ))}

            {loading && <TypingIndicator fullScreen={fullScreen} />}

            <div ref={messagesEndRef} />

            {/* Expand Input Button - shown when input is collapsed */}
            {showExpandButton && onExpandInput && (
                <Box
                    sx={{
                        position: 'sticky',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        py: 1,
                        background: `linear-gradient(to top, ${theme.palette.background.default} 60%, transparent)`,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)'
                    }}
                >
                    <Tooltip title="Show input">
                        <Box
                            onClick={onExpandInput}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 80,
                                height: 28,
                                px: 2,
                                backgroundColor: theme.palette.primary.main,
                                color: 'white',
                                borderRadius: '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    backgroundColor: theme.palette.primary.dark,
                                    transform: 'translateY(-1px)'
                                },
                                '&:active': {
                                    transform: 'translateY(0)'
                                },
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}
                        >
                            <KeyboardArrowUp sx={{ fontSize: 18 }} />
                        </Box>
                    </Tooltip>
                </Box>
            )}
        </Box>
    );
}; 