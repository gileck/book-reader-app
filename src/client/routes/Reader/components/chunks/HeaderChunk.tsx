import React from 'react';
import { Typography, Box } from '@mui/material';
import { useSettings } from '../../../../settings/SettingsContext';
import { TextChunkClient } from '@/apis/chapters/types';

interface HeaderChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    currentSentenceIndex: number;
    level?: number; // Determined by content analysis
    onChunkClick?: (chunkIndex: number) => void;
}

export const HeaderChunk: React.FC<HeaderChunkProps> = ({
    chunk,
    chunkIndex,
    currentSentenceIndex,
    level = 2,
    onChunkClick
}) => {
    const { settings } = useSettings();

    // Single/Double click differentiation (same pattern as TextChunk)
    const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const CLICK_DELAY = 200; // milliseconds to wait before treating as single click

    // Mobile double-tap detection
    const lastTapRef = React.useRef<number>(0);
    const DOUBLE_TAP_DELAY = 300; // milliseconds

    /**
     * Handle single click - navigate to next/prev sentence
     */
    const handleClick = () => {
        // Clear any existing timeout (important for double-click to work properly)
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }

        // Set timeout to execute single click after delay
        clickTimeoutRef.current = setTimeout(() => {
            if (onChunkClick) {
                onChunkClick(chunkIndex);
            }
        }, CLICK_DELAY);
    };

    /**
     * Handle double click - for headers, just cancel single click (no special action)
     */
    const handleDoubleClick = () => {
        // Clear single click timeout to prevent navigation on double-click
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
        }
    };

    // Handle touch events for mobile
    const handleTouchEnd = (event: React.TouchEvent) => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
            // Double tap detected - just cancel navigation
            event.preventDefault();

            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = null;
            }

            lastTapRef.current = 0; // Reset
        } else {
            // Single tap - handle navigation
            if (onChunkClick) {
                if (clickTimeoutRef.current) {
                    clearTimeout(clickTimeoutRef.current);
                }

                clickTimeoutRef.current = setTimeout(() => {
                    onChunkClick(chunkIndex);
                }, DOUBLE_TAP_DELAY);
            }
            lastTapRef.current = now;
        }
    };

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
            }
        };
    }, []);

    // Determine header level based on content length and formatting
    const determineHeaderLevel = (text: string, suggestedLevel: number): number => {
        const textLength = text.length;

        // Very short text (under 30 chars) is likely a main heading
        if (textLength < 30) return Math.max(suggestedLevel, 2);

        // Medium text (30-60 chars) is likely a section heading
        if (textLength < 60) return Math.max(suggestedLevel + 1, 3);

        // Longer text is likely a subsection
        return Math.max(suggestedLevel + 2, 4);
    };

    const headerLevel = Math.min(determineHeaderLevel(chunk.text, level), 6);
    const variant = `h${headerLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    const headingColor = settings.theme === 'dark' ? '#ffffff' : '#000000';

    // Responsive font sizes for different header levels
    const getFontSize = (level: number) => {
        switch (level) {
            case 1:
                return { xs: '2rem', sm: '2.5rem', md: '3rem' };
            case 2:
                return { xs: '1.75rem', sm: '2.25rem', md: '2.5rem' };
            case 3:
                return { xs: '1.5rem', sm: '2rem', md: '2.25rem' };
            case 4:
                return { xs: '1.3rem', sm: '1.75rem', md: '2rem' };
            case 5:
                return { xs: '1.2rem', sm: '1.5rem', md: '1.75rem' };
            case 6:
                return { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' };
            default:
                return { xs: '1.3rem', sm: '1.75rem', md: '2rem' };
        }
    };

    return (
        <Box
            sx={{
                mt: {
                    xs: headerLevel <= 2 ? 3 : 2,
                    sm: headerLevel <= 2 ? 4 : 3,
                    md: headerLevel <= 2 ? 5 : 4
                },
                mb: {
                    xs: headerLevel <= 2 ? 2 : 1.5,
                    sm: headerLevel <= 2 ? 3 : 2,
                    md: headerLevel <= 2 ? 4 : 3
                },
                p: { xs: 2, sm: 3 },
                backgroundColor:
                    currentSentenceIndex === chunkIndex
                        ? 'var(--sentence-highlight-color, transparent)'
                        : 'transparent',
                borderRadius: '6px',
                transition: 'all 0.3s ease',
                cursor: onChunkClick ? 'pointer' : 'default'
            }}
            id={`header-chunk-${chunkIndex}`}
            data-chunk-index={chunkIndex}
            data-paragraph-index={chunk.paragraphIndex}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onTouchEnd={handleTouchEnd}
        >
            <Typography
                variant={variant}
                component={variant}
                sx={{
                    color: headingColor,
                    fontWeight: 'bold',
                    lineHeight: { xs: 1.2, sm: 1.3 },
                    fontSize: getFontSize(headerLevel),
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    letterSpacing: '0.5px',
                    m: 0
                }}
            >
                {chunk.text}
            </Typography>
        </Box>
    );
}; 