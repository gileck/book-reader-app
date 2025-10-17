import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { SentenceAudioApi } from './hooks/useSentenceAudioController';
import type { TextChunkClient } from '@/apis/chapters/types';
import { useUserTheme } from '@/client/components/UserThemeProvider';

export const FocusReader: React.FC<{ controller: SentenceAudioApi; highlightMode?: 'word' | 'line' | 'off' }> = ({ controller, highlightMode = 'word' }) => {
    const sentences = controller.sentences;
    const currentSentenceIndex = controller.currentSentenceIndex;
    const isPlaying = controller.isPlaying;
    const currentWordIndex = controller.currentWordIndex;
    const { textColor, highlightColor, fontSize, lineHeight, fontFamily } = useUserTheme();

    const handleNext = useCallback(() => {
        controller.nextSentence();
    }, [controller]);

    const handlePrev = useCallback(() => {
        controller.prevSentence();
    }, [controller]);

    // Get chunks including headers - skip only images
    const getPlayableChunk = useCallback((fromIndex: number, direction: 'prev' | 'current' | 'next'): TextChunkClient | null => {
        if (direction === 'current') {
            const chunk = sentences[fromIndex];
            return (chunk && (chunk.type === 'text' || chunk.type === 'header') && chunk?.text?.trim()) ? chunk : null;
        }

        if (direction === 'next') {
            for (let i = fromIndex + 1; i < sentences.length; i++) {
                const chunk = sentences[i];
                if (chunk && (chunk.type === 'text' || chunk.type === 'header') && chunk?.text?.trim()) return chunk;
            }
            return null;
        }

        // prev
        for (let i = fromIndex - 1; i >= 0; i--) {
            const chunk = sentences[i];
            if (chunk && (chunk.type === 'text' || chunk.type === 'header') && chunk?.text?.trim()) return chunk;
        }
        return null;
    }, [sentences]);

    const prevChunk = getPlayableChunk(currentSentenceIndex, 'prev');
    const currChunk = getPlayableChunk(currentSentenceIndex, 'current');
    const nextChunk = getPlayableChunk(currentSentenceIndex, 'next');

    const prevText = prevChunk?.text ?? '';
    const currText = currChunk?.text ?? '';
    const nextText = nextChunk?.text ?? '';

    const isHeader = currChunk?.type === 'header';
    const isPrevHeader = prevChunk?.type === 'header';
    const isNextHeader = nextChunk?.type === 'header';

    const currentWords = useMemo(() => {
        // Split into words preserving order; spaces will be inserted during render
        return currText.length ? currText.split(/\s+/) : [];
    }, [currText]);

    // Animate sentence transitions (simple fade/slide)
    const containerRef = useRef<HTMLDivElement>(null);
    // Line highlight overlay position (for straight background across the whole line)
    const [linePos, setLinePos] = useState<{ top: number; height: number } | null>(null);
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.animate([
            { opacity: 0.5, transform: 'translateY(16px)' },
            { opacity: 1, transform: 'translateY(0px)' }
        ], {
            duration: 360,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        });
    }, [currentSentenceIndex]);

    // Compute current visual line (top/height) and which word indexes are on that line
    useEffect(() => {
        const updateLinePos = () => {
            const container = containerRef.current;
            if (!container) return;
            const wordEl = container.querySelector(`[data-word-index="${currentWordIndex}"]`) as HTMLElement | null;
            if (!wordEl) {
                setLinePos(null);
                return;
            }
            const cr = container.getBoundingClientRect();
            const wr = wordEl.getBoundingClientRect();
            setLinePos({ top: wr.top - cr.top, height: wr.height });
        };
        updateLinePos();
        window.addEventListener('resize', updateLinePos);
        return () => window.removeEventListener('resize', updateLinePos);
    }, [currentWordIndex, currentWords.length]);

    return (
        <Box
            sx={{
                maxWidth: 800,
                mx: 'auto',
                px: 2,
                py: 1,
                pb: { xs: 20, sm: 16 },
                height: 'calc(100vh - 200px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 2,
                background: 'var(--color-system-bg)',
                color: textColor,
                fontSize: `${fontSize}rem`,
                lineHeight: lineHeight,
                fontFamily: fontFamily
            }}
            role="region"
            aria-label="Focus reading area"
            onClick={handleNext}
            onKeyDown={(e) => {
                if (e.key === 'ArrowRight') handleNext();
                if (e.key === 'ArrowLeft') handlePrev();
            }}
            tabIndex={0}
        >
            {/* Use same global class as full reader: .highlight-word; set CSS var for color */}
            {/* Previous (smaller, subdued, under) */}
            <Box
                sx={{
                    minHeight: 44,
                    cursor: prevText ? 'pointer' : 'default',
                    ...(isPrevHeader && {
                        mx: -2,
                        px: 2,
                        py: 1.5,
                        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                        backgroundColor: 'rgba(211, 211, 211, 0.6)',
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: 'rgba(51, 51, 51, 0.6)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                        }
                    })
                }}
                onClick={(e) => {
                    if (prevText) {
                        e.stopPropagation();
                        handlePrev();
                    }
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        color: textColor,
                        textAlign: 'center',
                        opacity: isPrevHeader ? 0.8 : 0.6,
                        fontWeight: isPrevHeader ? 700 : 400,
                        fontSize: isPrevHeader ? '0.95rem' : 'inherit',
                        textTransform: isPrevHeader ? 'uppercase' : 'none',
                        letterSpacing: isPrevHeader ? '0.05em' : 'normal'
                    }}
                >
                    {prevText}
                </Typography>
                {/* CSS for line bolding; no layout shift */}
                <style>{`
                    .line-bold { font-weight: 700; }
                `}</style>
            </Box>

            {/* Current (bold, big, centered) */}
            <Box
                ref={containerRef}
                sx={{
                    position: 'relative',
                    ['--word-highlight-color' as unknown as string]: highlightColor,
                    ...(!isHeader && {
                        py: 2,
                        px: 2,
                        mx: -2,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '12px',
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: 'rgba(0, 0, 0, 0.6)'
                        }
                    }),
                    ...(isHeader && {
                        mx: -2,
                        px: 2,
                        py: 3,
                        backgroundColor: '#d3d3d3',
                        borderTop: '2px solid rgba(0, 0, 0, 0.1)',
                        borderBottom: '2px solid rgba(0, 0, 0, 0.1)',
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: '#333333',
                            borderTop: '2px solid rgba(255, 255, 255, 0.1)',
                            borderBottom: '2px solid rgba(255, 255, 255, 0.1)'
                        }
                    })
                }}
            >
                {highlightMode === 'line' && linePos && !isHeader && (
                    <Box
                        sx={{
                            position: 'absolute',
                            zIndex: 0,
                            left: 0,
                            right: 0,
                            top: `${linePos.top}px`,
                            height: `${linePos.height}px`,
                            backgroundColor: highlightColor,
                            borderRadius: '6px',
                            pointerEvents: 'none',
                            transition: 'top 220ms cubic-bezier(0.22, 1, 0.36, 1)'
                        }}
                    />
                )}
                <Typography
                    variant={isHeader ? "h2" : "h4"}
                    sx={{
                        fontSize: isHeader ? `${fontSize * 2}rem` : `${fontSize * 1.5}rem`,
                        lineHeight: isHeader ? 1.3 : lineHeight,
                        fontWeight: isHeader ? 800 : 700,
                        textAlign: 'center',
                        color: textColor,
                        fontFamily: fontFamily,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        position: 'relative',
                        zIndex: 1,
                        letterSpacing: isHeader ? '-0.01em' : 'normal',
                        textTransform: isHeader ? 'uppercase' : 'none',
                        mb: 0
                    }}
                >
                    {currentWords.map((w, i) => {
                        // Check if this word starts with a bullet character
                        const startsWithBullet = /^[*•]/.test(w);
                        return (
                            <React.Fragment key={`w-${i}`}>
                                {startsWithBullet && i > 0 && <br />}
                                <span
                                    className={(() => {
                                        if (highlightMode === 'off') return '';
                                        if (highlightMode === 'word') return (isPlaying && i === currentWordIndex) ? 'highlight-word' : '';
                                        // line mode uses overlay bar; no per-word class to keep line straight
                                        return '';
                                    })()}
                                    data-word-index={i}
                                >
                                    {w}
                                    {i < currentWords.length - 1 ? ' ' : ''}
                                </span>
                            </React.Fragment>
                        );
                    })}
                </Typography>
            </Box>

            {/* Next (smaller, subdued, under) */}
            <Box
                sx={{
                    minHeight: 44,
                    ...(isNextHeader && {
                        mx: -2,
                        px: 2,
                        py: 1.5,
                        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                        backgroundColor: 'rgba(211, 211, 211, 0.6)',
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: 'rgba(51, 51, 51, 0.6)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                        }
                    })
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        color: textColor,
                        textAlign: 'center',
                        opacity: isNextHeader ? 0.8 : 0.6,
                        fontWeight: isNextHeader ? 700 : 400,
                        fontSize: isNextHeader ? '0.95rem' : 'inherit',
                        textTransform: isNextHeader ? 'uppercase' : 'none',
                        letterSpacing: isNextHeader ? '0.05em' : 'normal'
                    }}
                >
                    {nextText}
                </Typography>
            </Box>
        </Box>
    );
};


