import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { ChatContentProps } from './types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export const ChatContent: React.FC<ChatContentProps> = ({
    messages,
    messagesEndRef,
    fullScreen,
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
        </Box>
    );
}; 