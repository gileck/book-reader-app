import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { SentenceAudioApi } from './hooks/useSentenceAudioController';
import { useUserTheme } from '@/client/components/UserThemeProvider';

export const FocusReader: React.FC<{ controller: SentenceAudioApi; highlightMode?: 'word' | 'line' | 'off' }> = ({ controller, highlightMode = 'word' }) => {
    const sentences = controller.sentences;
    const currentSentenceIndex = controller.currentSentenceIndex;
    const isPlaying = controller.isPlaying;
    const currentWordIndex = controller.currentWordIndex;
    const { textColor, highlightColor } = useUserTheme() as { textColor: string; highlightColor: string };

    const handleNext = useCallback(() => {
        controller.nextSentence();
    }, [controller]);

    const handlePrev = useCallback(() => {
        controller.prevSentence();
    }, [controller]);

    const prevText = sentences[currentSentenceIndex - 1]?.text ?? '';
    const currText = sentences[currentSentenceIndex]?.text ?? '';
    const nextText = sentences[currentSentenceIndex + 1]?.text ?? '';

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
                color: 'var(--color-label)'
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
            <Box sx={{ minHeight: 44 }}>
                <Typography variant="body2" sx={{ color: textColor, textAlign: 'center', opacity: 0.6 }}>
                    {prevText}
                </Typography>
                {/* CSS for line bolding; no layout shift */}
                <style>{`
                    .line-bold { font-weight: 700; }
                `}</style>
            </Box>

            {/* Current (bold, big, centered) */}
            <Box ref={containerRef} sx={{ position: 'relative', ['--word-highlight-color' as unknown as string]: highlightColor }}>
                {highlightMode === 'line' && linePos && (
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
                    variant="h4"
                    sx={{
                        fontSize: 'min(calc(var(--font-size-title1) * 1.2), 34px)',
                        lineHeight: 'var(--line-tight)',
                        fontWeight: 700,
                        textAlign: 'center',
                        color: textColor,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        position: 'relative',
                        zIndex: 1
                    }}
                >
                    {currentWords.map((w, i) => (
                        <span
                            key={`w-${i}`}
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
                    ))}
                </Typography>
            </Box>

            {/* Next (smaller, subdued, under) */}
            <Box sx={{ minHeight: 44 }}>
                <Typography variant="body2" sx={{ color: textColor, textAlign: 'center', opacity: 0.6 }}>
                    {nextText}
                </Typography>
            </Box>
        </Box>
    );
};


