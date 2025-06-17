import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';

interface TypingIndicatorProps {
    fullScreen: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ fullScreen }) => {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                px: 1,
                mb: 3
            }}
        >
            <Box
                sx={{
                    maxWidth: '85%',
                    minWidth: 80,
                    backgroundColor: alpha(theme.palette.background.default, 0.6),
                    color: theme.palette.text.primary,
                    borderRadius: '20px 20px 20px 6px',
                    px: 3,
                    py: 2,
                    border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    boxShadow: theme.palette.mode === 'light'
                        ? '0 1px 3px rgba(0,0,0,0.08)'
                        : '0 1px 3px rgba(0,0,0,0.16)',
                    transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}
            >
                {/* Typing dots animation */}
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {[0, 1, 2].map((index) => (
                        <Box
                            key={index}
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: theme.palette.text.secondary,
                                opacity: 0.4,
                                animation: 'typing-dots 1.4s infinite ease-in-out',
                                animationDelay: `${index * 0.2}s`,
                                '@keyframes typing-dots': {
                                    '0%, 80%, 100%': {
                                        opacity: 0.4,
                                        transform: 'scale(1)'
                                    },
                                    '40%': {
                                        opacity: 1,
                                        transform: 'scale(1.2)'
                                    }
                                }
                            }}
                        />
                    ))}
                </Box>
                <Box
                    sx={{
                        fontSize: fullScreen ? '0.875rem' : '0.75rem',
                        color: theme.palette.text.secondary,
                        fontStyle: 'italic',
                        ml: 1
                    }}
                >
                    AI is thinking...
                </Box>
            </Box>
        </Box>
    );
}; 