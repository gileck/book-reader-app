import React, { useState } from 'react';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { EnhancedText } from '../EnhancedText';
import { IconButton, Box } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloseIcon from '@mui/icons-material/Close';

interface TextChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    currentChunkIndex: number;
    handleLinkClick: (link: ChunkLink) => void;
    onChunkClick?: (chunkIndex: number) => void;
    onChunkDoubleClick?: (chunkIndex: number, event: React.MouseEvent) => void;
    bionicReadingEnabled?: boolean;
    chunkSpacing?: number;
    translatedText?: string;
    translatedLanguage?: string;
    translationCost?: number;
    translationFromCache?: boolean;
    freeTierUsage?: {
        used: number;
        total: number;
        remaining: number;
        percentUsed: number;
    };
    onToggleTranslation?: (chunkIndex: number) => void;
}

// RTL languages list
const RTL_LANGUAGES = ['ar', 'he', 'ur', 'fa', 'yi'];

// Helper function to detect if text is RTL
const isRTLLanguage = (languageCode?: string): boolean => {
    if (!languageCode) return false;
    return RTL_LANGUAGES.includes(languageCode.toLowerCase());
};

export const TextChunk: React.FC<TextChunkProps> = ({
    chunk,
    chunkIndex,
    currentChunkIndex,
    handleLinkClick,
    onChunkClick,
    onChunkDoubleClick,
    bionicReadingEnabled = false,
    chunkSpacing = 0.5,
    translatedText,
    translatedLanguage,
    translationCost,
    translationFromCache,
    freeTierUsage,
    onToggleTranslation
}) => {
    const isHighlighted = currentChunkIndex === chunkIndex;
    const [showOriginal, setShowOriginal] = useState(false);
    const hasTranslation = !!translatedText;
    const isRTL = isRTLLanguage(translatedLanguage);
    
    // Single/Double click differentiation
    const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const CLICK_DELAY = 200; // milliseconds to wait before treating as single click
    
    // Mobile double-tap detection
    const lastTapRef = React.useRef<number>(0);
    const DOUBLE_TAP_DELAY = 300; // milliseconds

    /**
     * Handle single click - navigate to next/prev sentence
     * Only works when there's no translation (to avoid interfering with translation UI)
     */
    const handleClick = (event: React.MouseEvent) => {
        // Don't handle single clicks if there's a translation or if clicking on controls
        if (hasTranslation) return;
        
        // Check if clicking on interactive elements (links, buttons)
        const target = event.target as HTMLElement;
        if (target.closest('a') || target.closest('button') || target.closest('[role="button"]')) {
            return;
        }

        // Set timeout to execute single click after delay
        // This will be cleared if double click happens before timeout
        clickTimeoutRef.current = setTimeout(() => {
            if (onChunkClick) {
                onChunkClick(chunkIndex);
            }
        }, CLICK_DELAY);
    };

    /**
     * Handle double click - open translation menu
     */
    const handleDoubleClick = (event: React.MouseEvent) => {
        // Clear single click timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
        }

        // Execute double click action (translation menu)
        if (onChunkDoubleClick) {
            onChunkDoubleClick(chunkIndex, event);
        }
    };

    // Handle touch events for mobile double-tap
    const handleTouchEnd = (event: React.TouchEvent) => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;

        if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
            // Double tap detected - open translation
            event.preventDefault();
            
            // Clear single click timeout
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = null;
            }
            
            if (onChunkDoubleClick) {
                // Create a synthetic mouse event for compatibility
                const touch = event.changedTouches[0];
                const syntheticEvent = {
                    target: event.target,
                    currentTarget: event.currentTarget,
                    clientX: touch?.clientX || 0,
                    clientY: touch?.clientY || 0,
                } as React.MouseEvent;
                onChunkDoubleClick(chunkIndex, syntheticEvent);
            }
            lastTapRef.current = 0; // Reset
        } else {
            // Single tap - handle navigation if no translation
            if (!hasTranslation && onChunkClick) {
                setTimeout(() => {
                    // Only execute if no double tap follows
                    const timeSinceThisTap = Date.now() - now;
                    if (timeSinceThisTap >= DOUBLE_TAP_DELAY) {
                        onChunkClick(chunkIndex);
                    }
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

    const handleToggle = (event: React.MouseEvent) => {
        event.stopPropagation();
        setShowOriginal(!showOriginal);
    };

    const handleClose = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (onToggleTranslation) {
            onToggleTranslation(chunkIndex);
        }
    };

    const displayText = hasTranslation && !showOriginal ? translatedText : chunk.text;

    return (
        <Box
            sx={{
                position: 'relative',
                lineHeight: 'var(--reader-line-height, 1.6)',
                fontSize: 'var(--reader-font-size, 1rem)',
                fontFamily: 'var(--reader-font-family, inherit)',
                color: 'var(--reader-text-color, inherit)',
                padding: hasTranslation ? '8px' : '0px 5px 0px 5px',
                marginBottom: `${chunkSpacing}em`,
                backgroundColor: hasTranslation 
                    ? 'rgba(33, 150, 243, 0.08)' 
                    : isHighlighted 
                        ? 'var(--sentence-highlight-color, transparent)' 
                        : 'transparent',
                borderRadius: '6px',
                borderLeft: hasTranslation ? '3px solid #2196f3' : 'none',
                transition: 'all 0.3s ease',
                cursor: (onChunkClick || onChunkDoubleClick) ? 'pointer' : 'default',
            }}
            id={`text-chunk-${chunkIndex}`}
            data-chunk-index={chunkIndex}
            data-paragraph-index={chunk.paragraphIndex}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onTouchEnd={handleTouchEnd}
        >
            {hasTranslation ? (
                <>
                    {/* Translated text */}
                    <div
                        dir={!showOriginal && isRTL ? 'rtl' : 'ltr'}
                        style={{
                            textAlign: !showOriginal && isRTL ? 'right' : 'left',
                            unicodeBidi: 'embed',
                        }}
                    >
                        {displayText}
                    </div>
                    
                    {/* Bottom bar with usage info and controls */}
                    <Box
                        sx={{
                            marginTop: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            gap: '8px',
                            flexWrap: 'wrap',
                        }}
                    >
                        {/* Usage information - left side */}
                        {!showOriginal && (translationCost !== undefined || freeTierUsage) && (
                            <Box
                                sx={{
                                    fontSize: '0.70rem',
                                    color: 'text.secondary',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    opacity: 0.7,
                                    flex: 1,
                                }}
                            >
                                {/* Free tier usage */}
                                {freeTierUsage && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: '0.65rem' }}>
                                            {translationFromCache ? '💾' : '📊'}
                                        </span>
                                        <span>
                                            {translationFromCache ? 'Cached • ' : ''}
                                            {freeTierUsage.used.toLocaleString()} / {freeTierUsage.total.toLocaleString()} chars ({freeTierUsage.percentUsed.toFixed(1)}%)
                                        </span>
                                    </Box>
                                )}
                                
                                {/* Cost info - only show if exceeding free tier */}
                                {!translationFromCache && freeTierUsage && freeTierUsage.used > freeTierUsage.total && translationCost !== undefined && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: '0.65rem' }}>💰</span>
                                        <span>Cost: ${translationCost.toFixed(4)}</span>
                                    </Box>
                                )}
                            </Box>
                        )}
                        
                        {/* Translation controls - right side */}
                        <Box
                            sx={{
                                display: 'flex',
                                gap: '6px',
                                alignItems: 'center',
                            }}
                        >
                            <IconButton
                                size="small"
                                onClick={handleToggle}
                                title={showOriginal ? 'Show translation' : 'Show original'}
                                sx={{
                                    width: '32px',
                                    height: '32px',
                                    backgroundColor: 'action.hover',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    '&:hover': { 
                                        backgroundColor: 'action.selected',
                                        borderColor: 'primary.main',
                                    },
                                }}
                            >
                                <SwapHorizIcon sx={{ fontSize: '18px' }} />
                            </IconButton>
                            <IconButton
                                size="small"
                                onClick={handleClose}
                                title="Clear translation"
                                sx={{
                                    width: '32px',
                                    height: '32px',
                                    backgroundColor: 'action.hover',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    '&:hover': { 
                                        backgroundColor: 'error.light',
                                        borderColor: 'error.main',
                                        color: 'error.main',
                                    },
                                }}
                            >
                                <CloseIcon sx={{ fontSize: '18px' }} />
                            </IconButton>
                        </Box>
                    </Box>
                </>
            ) : (
                <EnhancedText
                    chunk={chunk}
                    chunkIndex={chunkIndex}
                    onLinkClick={handleLinkClick}
                    bionicReadingEnabled={bionicReadingEnabled}
                />
            )}
        </Box>
    );
}; 