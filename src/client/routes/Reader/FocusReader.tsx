import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, useTheme, CircularProgress, Alert, Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { SentenceAudioApi } from './hooks/useSentenceAudioController';
import type { TextChunkClient } from '@/apis/chapters/types';
import type { BookClient } from '@/apis/books/types';
import { useUserTheme } from '@/client/components/UserThemeProvider';
import { VERCEL_BLOB_IMAGES_BASE_PATH } from '@/common/constants';

/**
 * FocusReader Component
 * 
 * A focused reading mode that displays one sentence at a time with optional
 * text-to-speech highlighting and dynamic font scaling for long sentences.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {SentenceAudioApi} props.controller - Audio playback controller for TTS
 * @param {'word' | 'line' | 'off'} [props.highlightMode='word'] - Text highlighting mode during TTS playback
 * @param {boolean} [props.ttsEnabled=true] - Whether text-to-speech is enabled
 * @param {boolean} [props.autoFontScaling=true] - Enable automatic font scaling for long sentences
 * @param {BookClient} [props.book] - Book data including image URLs
 * 
 * @example
 * ```tsx
 * <FocusReader
 *   controller={sentenceAudioController}
 *   highlightMode="word"
 *   ttsEnabled={true}
 *   autoFontScaling={true}
 *   book={currentBook}
 * />
 * ```
 */
export const FocusReader: React.FC<{
    controller: SentenceAudioApi;
    highlightMode?: 'word' | 'line' | 'off';
    ttsEnabled?: boolean;
    autoFontScaling?: boolean;
    bionicReadingEnabled?: boolean;
    book?: BookClient;
}> = ({ controller, highlightMode = 'word', ttsEnabled = true, autoFontScaling = true, bionicReadingEnabled = false, book }) => {
    const sentences = controller.sentences;
    const currentSentenceIndex = controller.currentSentenceIndex;
    const isPlaying = controller.isPlaying;
    const currentWordIndex = controller.currentWordIndex;
    const { textColor, highlightColor, fontSize, lineHeight, fontFamily } = useUserTheme();
    // Theme hook kept for potential future use with theme-dependent features
    useTheme();

    // Helper: find index of next/prev/current displayable (text/header/image)
    const getDisplayableIndex = useCallback((fromIndex: number, direction: 'prev' | 'current' | 'next'): number | null => {
        if (direction === 'current') {
            const chunk = sentences[fromIndex];
            if (!chunk) return null;
            if (chunk.type === 'image') return fromIndex;
            if ((chunk.type === 'text' || chunk.type === 'header') && chunk?.text?.trim()) return fromIndex;
            return null;
        }

        if (direction === 'next') {
            for (let i = fromIndex + 1; i < sentences.length; i++) {
                const chunk = sentences[i];
                if (!chunk) continue;
                if (chunk.type === 'image') return i;
                if ((chunk.type === 'text' || chunk.type === 'header') && chunk?.text?.trim()) return i;
            }
            return null;
        }

        // prev
        for (let i = fromIndex - 1; i >= 0; i--) {
            const chunk = sentences[i];
            if (!chunk) continue;
            if (chunk.type === 'image') return i;
            if ((chunk.type === 'text' || chunk.type === 'header') && chunk?.text?.trim()) return i;
        }
        return null;
    }, [sentences]);

    const handleNext = useCallback(() => {
        const nextIdx = getDisplayableIndex(currentSentenceIndex, 'next');
        if (nextIdx !== null) {
            controller.goToSentence(nextIdx);
        }
    }, [controller, currentSentenceIndex, getDisplayableIndex]);

    const handlePrev = useCallback(() => {
        const prevIdx = getDisplayableIndex(currentSentenceIndex, 'prev');
        if (prevIdx !== null) {
            controller.goToSentence(prevIdx);
        }
    }, [controller, currentSentenceIndex, getDisplayableIndex]);

    // Image modal state
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const handleOpenImageModal = () => setIsImageModalOpen(true);
    const handleCloseImageModal = () => setIsImageModalOpen(false);

    // Get chunks including headers and images
    const getDisplayableChunk = useCallback((fromIndex: number, direction: 'prev' | 'current' | 'next'): TextChunkClient | null => {
        const idx = getDisplayableIndex(fromIndex, direction);
        return idx !== null ? sentences[idx] : null;
    }, [getDisplayableIndex, sentences]);

    const prevChunk = getDisplayableChunk(currentSentenceIndex, 'prev');
    const currChunk = getDisplayableChunk(currentSentenceIndex, 'current');
    const nextChunk = getDisplayableChunk(currentSentenceIndex, 'next');

    const prevText = prevChunk?.text ?? '';
    const currText = currChunk?.text ?? '';
    const nextText = nextChunk?.text ?? '';

    const isHeader = currChunk?.type === 'header';
    const isPrevHeader = prevChunk?.type === 'header';
    const isNextHeader = nextChunk?.type === 'header';
    const isImage = currChunk?.type === 'image';
    const isPrevImage = prevChunk?.type === 'image';
    const isNextImage = nextChunk?.type === 'image';

    // Check if current chunk is in a different paragraph than prev
    const isPrevDifferentParagraph = prevChunk && currChunk && 
        prevChunk.paragraphIndex !== undefined && 
        currChunk.paragraphIndex !== undefined && 
        prevChunk.paragraphIndex !== currChunk.paragraphIndex;
    
    // Check if next chunk is in a different paragraph than current (or no next chunk)
    const isNextDifferentParagraph = nextChunk && currChunk && 
        nextChunk.paragraphIndex !== undefined && 
        currChunk.paragraphIndex !== undefined && 
        nextChunk.paragraphIndex !== currChunk.paragraphIndex;
    
    // Check if current chunk is the last sentence of its paragraph
    const isLastSentenceOfParagraph = isNextDifferentParagraph || (!nextChunk && currChunk?.paragraphIndex !== undefined);

    // Image loading states
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Construct image URL for current chunk
    const imageUrl = isImage && currChunk?.imageName && book?.imageBaseURL
        ? `${VERCEL_BLOB_IMAGES_BASE_PATH}${book.imageBaseURL}${currChunk.imageName}`
        : null;

    // Reset image states when current chunk changes
    useEffect(() => {
        if (isImage && imageUrl) {
            setImageLoading(true);
            setImageError(false);
        }
    }, [currentSentenceIndex, isImage, imageUrl]);

    const currentWords = useMemo(() => {
        // Split into words preserving order; spaces will be inserted during render
        return currText.length ? currText.split(/\s+/) : [];
    }, [currText]);

    // Animate sentence transitions (simple fade/slide)
    const containerRef = useRef<HTMLDivElement>(null);
    // Line highlight overlay position (for straight background across the whole line)
    const [linePos, setLinePos] = useState<{ top: number; height: number } | null>(null);

    // Clear all highlights when TTS is disabled
    useEffect(() => {
        if (!ttsEnabled) {
            // Clear any existing word highlights from the DOM
            const highlightedWords = document.querySelectorAll('.highlight-word');
            highlightedWords.forEach(word => word.classList.remove('highlight-word'));
        }
    }, [ttsEnabled]);

    // Smooth page-turn animation for sentence transitions
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.animate([
            { opacity: 0, transform: 'translateY(24px) scale(0.98)' },
            { opacity: 1, transform: 'translateY(0px) scale(1)' }
        ], {
            duration: 320,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        });
    }, [currentSentenceIndex]);

    // Compute current visual line (top/height) and which word indexes are on that line
    useEffect(() => {
        // Clear line position when TTS is disabled
        if (!ttsEnabled) {
            setLinePos(null);
            return;
        }

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
    }, [currentWordIndex, currentWords.length, ttsEnabled]);

    /**
     * Dynamic Font Scaling for Long Sentences
     * 
     * Automatically calculates and applies font scaling to ensure long sentences
     * fit within the viewport without requiring scrolling. This improves the
     * reading experience by maintaining all content visible on screen.
     * 
     * Algorithm Overview:
     * 1. Estimates the number of characters per line based on container width and font size
     * 2. Calculates how many lines the current text will occupy
     * 3. Estimates the total rendered height (lines × line height)
     * 4. Adds a 20% safety buffer to account for word wrapping variations
     * 5. Compares estimated height against available viewport height
     * 6. If content would overflow, scales font down proportionally
     * 
     * Key Features:
     * - Minimum scale: 0.65 (65%) - ensures text remains readable
     * - Maximum scale: 1.0 (100%) - never scales up
     * - Accounts for: container padding, nav bars, controls, prev/next sections
     * - Disabled for images (images have their own sizing)
     * - Can be disabled by user via Theme & Appearance Settings
     * 
     * Performance: Uses useMemo to only recalculate when dependencies change
     * 
     * @returns {number} Scale factor between 0.65 and 1.0 to apply to font size
     */
    const fontScale = useMemo(() => {
        // Skip scaling if disabled by user or for images
        if (!autoFontScaling || isImage) {
            return 1;
        }
        
        // Step 1: Calculate effective container width
        // Container has max-width: 800px and horizontal padding of 16px each side
        const containerMaxWidth = 800;
        const containerPadding = 32; // 16px left + 16px right
        const effectiveWidth = Math.min(containerMaxWidth, window.innerWidth) - containerPadding;
        
        // Step 2: Estimate characters per line
        // Font size calculation: user fontSize setting × 1.5 (h4 variant) × 16 (rem to px)
        // Character width ratio: 0.45 (empirically determined average for proportional fonts)
        const baseFontSizePx = fontSize * 1.5 * 16;
        const avgCharWidth = baseFontSizePx * 0.45;
        const avgCharsPerLine = Math.floor(effectiveWidth / avgCharWidth);
        
        // Step 3: Calculate estimated number of lines
        const textLength = currText.length;
        const estimatedLines = Math.ceil(textLength / avgCharsPerLine);
        
        // Step 4: Calculate estimated height with safety buffer
        // Line height in pixels = base font size × user's line height setting
        // Safety buffer: 1.2 (20%) accounts for:
        //   - Word wrapping variations (some lines may have fewer characters)
        //   - Container padding and margins
        //   - Font rendering differences across browsers
        const lineHeightPx = baseFontSizePx * lineHeight;
        const estimatedHeight = estimatedLines * lineHeightPx * 1.2;
        
        // Step 5: Calculate available height
        // Reserved space breakdown:
        //   - Top navigation bar: ~64px
        //   - Bottom playback controls: ~140px
        //   - Previous/next sentence sections: ~176px total (88px each when shown)
        //   - Additional padding and margins: ~50px
        //   Total reserved: ~430px (using 350px as conservative estimate)
        const availableHeight = window.innerHeight - 350;
        
        // Step 6: Apply scaling if content would overflow
        if (estimatedHeight > availableHeight) {
            // Calculate proportional scale to fit content
            const targetScale = (availableHeight / estimatedHeight);
            // Clamp scale between 0.65 (minimum for readability) and 1.0 (no upscaling)
            const scale = Math.max(0.65, Math.min(1, targetScale));
            return scale;
        }
        
        // Content fits without scaling
        return 1;
    }, [currText, isImage, fontSize, lineHeight, isHeader, autoFontScaling]);

    return (
        <Box
            sx={{
                maxWidth: 800,
                mx: 'auto',
                px: 2,
                py: 1,
                // Extra top padding so content is below floating tabs, negative margin to pull up
                pt: 5,
                mt: -5,
                pb: { xs: 20, sm: 16 },
                height: 'calc(100vh - 160px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 2,
                // Apple Books warm background
                backgroundColor: 'var(--reader-bg)',
                color: textColor,
                fontSize: `${fontSize}rem`,
                lineHeight: lineHeight,
                fontFamily: fontFamily,
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
            
            {/* Paragraph delimiter above previous chunk (when entering a new paragraph) */}
            {fontScale >= 1 && isPrevDifferentParagraph && !isPrevHeader && !isPrevImage && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        mb: 2,
                        mt: 1,
                        opacity: 0.6
                    }}
                >
                    <Box
                        sx={{
                            flex: 1,
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, var(--reader-accent) 50%, transparent)',
                            borderRadius: '1px'
                        }}
                    />
                    <Typography
                        sx={{
                            color: 'var(--reader-accent)',
                            fontSize: '11px',
                            fontWeight: 500,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            fontFamily: 'var(--reader-font-sans)'
                        }}
                    >
                        New Paragraph
                    </Typography>
                    <Box
                        sx={{
                            flex: 1,
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, var(--reader-accent) 50%, transparent)',
                            borderRadius: '1px'
                        }}
                    />
                </Box>
            )}

            {/* Previous (smaller, subdued, under) - Hidden when font is scaled */}
            {fontScale >= 1 && (
                <Box
                    sx={{
                        minHeight: 44,
                        maxHeight: 88,
                        overflow: 'hidden',
                        cursor: (prevText || isPrevImage) ? 'pointer' : 'default',
                        borderRadius: '12px',
                        px: 2,
                        py: 1,
                        transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
                        '&:hover': {
                            backgroundColor: 'var(--reader-accent-subtle)',
                        },
                        ...(isPrevHeader && {
                            mx: -2,
                            px: 2,
                            py: 1.5,
                            borderRadius: 0,
                            borderTop: '1px solid var(--reader-separator)',
                            borderBottom: '1px solid var(--reader-separator)',
                            backgroundColor: 'var(--reader-bg-secondary)',
                        })
                    }}
                    onClick={(e) => {
                        if (prevText || isPrevImage) {
                            e.stopPropagation();
                            handlePrev();
                        }
                    }}
                >
                    {isPrevImage ? (
                        <Typography
                            sx={{
                                color: 'var(--reader-text-muted)',
                                textAlign: 'center',
                                fontSize: '13px',
                                fontStyle: 'italic',
                                display: 'block',
                                fontFamily: 'var(--reader-font-sans)'
                            }}
                        >
                            [Previous Image]
                        </Typography>
                    ) : (
                        <Typography
                            sx={{
                                color: 'var(--reader-text-secondary)',
                                textAlign: 'center',
                                fontWeight: isPrevHeader ? 600 : 400,
                                fontSize: isPrevHeader ? '14px' : '14px',
                                textTransform: isPrevHeader ? 'uppercase' : 'none',
                                letterSpacing: isPrevHeader ? '0.06em' : '-0.01em',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontFamily: isPrevHeader ? 'var(--reader-font-sans)' : 'inherit'
                            }}
                        >
                            {prevText}
                        </Typography>
                    )}
                    {/* CSS for line bolding; no layout shift */}
                    <style>{`
                        .line-bold { font-weight: 700; }
                    `}</style>
                </Box>
            )}

            {/* Current (bold, big, centered) - Card layout */}
            <Box
                ref={containerRef}
                sx={{
                    position: 'relative',
                    ['--word-highlight-color' as unknown as string]: highlightColor,
                    ...(!isHeader && !isImage && {
                        py: 3,
                        px: 3,
                        mx: -1,
                        borderRadius: '16px',
                        // Apple Books card style
                        backgroundColor: 'var(--reader-surface)',
                        boxShadow: 'var(--reader-shadow-medium)',
                        transition: 'all 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }),
                    ...(isHeader && {
                        mx: -2,
                        px: 3,
                        py: 3,
                        backgroundColor: 'var(--reader-bg-secondary)',
                        borderTop: '2px solid var(--reader-accent)',
                        borderBottom: '1px solid var(--reader-separator)',
                        borderRadius: 0,
                    }),
                    ...(isImage && {
                        my: 3,
                        textAlign: 'center',
                        backgroundColor: 'var(--reader-surface)',
                        borderRadius: '16px',
                        boxShadow: 'var(--reader-shadow-medium)',
                        p: 2,
                    })
                }}
            >
                {isImage ? (
                    // Image display
                    <>
                        {imageLoading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                <CircularProgress size={40} />
                            </Box>
                        )}

                        {imageError && imageUrl ? (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Failed to load image
                            </Alert>
                        ) : imageUrl ? (
                            <>
                                <img
                                    src={imageUrl}
                                    alt={currChunk?.imageAlt || 'Book image'}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '60vh',
                                        objectFit: 'contain',
                                        backgroundColor: 'white',
                                        padding: '20px',
                                        borderRadius: '12px',
                                        display: imageLoading ? 'none' : 'block',
                                        cursor: 'zoom-in',
                                        margin: '0 auto'
                                    }}
                                    onLoad={() => {
                                        setImageLoading(false);
                                        setImageError(false);
                                    }}
                                    onError={() => {
                                        setImageLoading(false);
                                        setImageError(true);
                                    }}
                                    onClick={(e) => { e.stopPropagation(); handleOpenImageModal(); }}
                                    onDoubleClick={(e) => { e.stopPropagation(); handleOpenImageModal(); }}
                                />
                                {currChunk?.imageAlt && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            mt: 2,
                                            display: 'block',
                                            fontStyle: 'italic',
                                            color: textColor,
                                            opacity: 0.8
                                        }}
                                    >
                                        {currChunk.imageAlt}
                                    </Typography>
                                )}
                            </>
                        ) : null}
                    </>
                ) : (
                    // Text/Header display
                    <>
                        {ttsEnabled && highlightMode === 'line' && linePos !== null && !isHeader && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    zIndex: 0,
                                    left: -8,
                                    right: -8,
                                    top: `${linePos.top}px`,
                                    height: `${linePos.height}px`,
                                    backgroundColor: highlightColor,
                                    borderRadius: '8px',
                                    pointerEvents: 'none',
                                    transition: 'top 220ms cubic-bezier(0.22, 1, 0.36, 1)'
                                }}
                            />
                        )}
                        <Typography
                            variant={isHeader ? "h2" : "h4"}
                            sx={{
                                fontSize: isHeader ? `${fontSize * 2 * fontScale}rem` : `${fontSize * 1.5 * fontScale}rem`,
                                lineHeight: isHeader ? 1.35 : lineHeight,
                                fontWeight: isHeader ? 700 : (bionicReadingEnabled ? 400 : 600),
                                textAlign: 'center',
                                color: isHeader ? 'var(--reader-accent)' : 'var(--reader-text)',
                                fontFamily: isHeader ? 'var(--reader-font-sans)' : fontFamily,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                position: 'relative',
                                zIndex: 1,
                                letterSpacing: isHeader ? '0.02em' : '-0.015em',
                                textTransform: isHeader ? 'uppercase' : 'none',
                                mb: 0,
                                transition: 'font-size 220ms cubic-bezier(0.22, 1, 0.36, 1)'
                            }}
                        >
                            {currentWords.map((w, i) => {
                                // Check if this word starts with a bullet character
                                const startsWithBullet = /^[*•]/.test(w);
                                
                                // Bionic reading: determine bold length
                                const getBoldLength = (word: string) => {
                                    const len = word.length;
                                    if (len <= 1) return 1;
                                    if (len <= 3) return 1;
                                    if (len <= 5) return 2;
                                    return Math.ceil(len / 2);
                                };
                                
                                return (
                                    <React.Fragment key={`w-${i}`}>
                                        {startsWithBullet && i > 0 && <br />}
                                        <span
                                            className={(() => {
                                                if (!ttsEnabled) return '';
                                                if (highlightMode === 'off') return '';
                                                if (highlightMode === 'word') return (isPlaying && i === currentWordIndex) ? 'highlight-word' : '';
                                                // line mode uses overlay bar; no per-word class to keep line straight
                                                return '';
                                            })()}
                                            data-word-index={i}
                                        >
                                            {bionicReadingEnabled ? (
                                                <>
                                                    <span style={{ fontWeight: 900 }}>{w.slice(0, getBoldLength(w))}</span>
                                                    <span style={{ fontWeight: 400 }}>{w.slice(getBoldLength(w))}</span>
                                                </>
                                            ) : w}
                                            {i < currentWords.length - 1 ? ' ' : ''}
                                        </span>
                                    </React.Fragment>
                                );
                            })}
                        </Typography>
                    </>
                )}
            </Box>

            {/* Next (smaller, subdued, under) OR End of Paragraph indicator - Hidden when font is scaled */}
            {fontScale >= 1 && (
                isLastSentenceOfParagraph && !isHeader && !isImage ? (
                    // Show "End of Paragraph" indicator instead of next sentence
                    <Box
                        sx={{
                            minHeight: 44,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1.5,
                            py: 2
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                width: '100%',
                                opacity: 0.6
                            }}
                        >
                            <Box
                                sx={{
                                    flex: 1,
                                    height: '2px',
                                    background: 'linear-gradient(90deg, transparent, var(--reader-accent) 50%, transparent)',
                                    borderRadius: '1px'
                                }}
                            />
                            <Typography
                                sx={{
                                    color: 'var(--reader-accent)',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    whiteSpace: 'nowrap',
                                    fontFamily: 'var(--reader-font-sans)'
                                }}
                            >
                                End of Paragraph
                            </Typography>
                            <Box
                                sx={{
                                    flex: 1,
                                    height: '2px',
                                    background: 'linear-gradient(90deg, transparent, var(--reader-accent) 50%, transparent)',
                                    borderRadius: '1px'
                                }}
                            />
                        </Box>
                    </Box>
                ) : (
                    // Show next sentence as normal
                    <Box
                        sx={{
                            minHeight: 44,
                            maxHeight: 88,
                            overflow: 'hidden',
                            borderRadius: '12px',
                            px: 2,
                            py: 1,
                            transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
                            '&:hover': {
                                backgroundColor: 'var(--reader-accent-subtle)',
                            },
                            ...(isNextHeader && {
                                mx: -2,
                                px: 2,
                                py: 1.5,
                                borderRadius: 0,
                                borderTop: '1px solid var(--reader-separator)',
                                borderBottom: '1px solid var(--reader-separator)',
                                backgroundColor: 'var(--reader-bg-secondary)',
                            })
                        }}
                    >
                        {isNextImage ? (
                            <Typography
                                sx={{
                                    color: 'var(--reader-text-muted)',
                                    textAlign: 'center',
                                    fontSize: '13px',
                                    fontStyle: 'italic',
                                    display: 'block',
                                    fontFamily: 'var(--reader-font-sans)'
                                }}
                            >
                                [Next Image]
                            </Typography>
                        ) : (
                            <Typography
                                sx={{
                                    color: 'var(--reader-text-secondary)',
                                    textAlign: 'center',
                                    fontWeight: isNextHeader ? 600 : 400,
                                    fontSize: '14px',
                                    textTransform: isNextHeader ? 'uppercase' : 'none',
                                    letterSpacing: isNextHeader ? '0.06em' : '-0.01em',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontFamily: isNextHeader ? 'var(--reader-font-sans)' : 'inherit'
                                }}
                            >
                                {nextText}
                            </Typography>
                        )}
                    </Box>
                )
            )}

            {/* Paragraph delimiter below next chunk (when entering a new paragraph and not last sentence) */}
            {fontScale >= 1 && !isLastSentenceOfParagraph && isNextDifferentParagraph && !isNextHeader && !isNextImage && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        mt: 2,
                        mb: 1,
                        opacity: 0.6
                    }}
                >
                    <Box
                        sx={{
                            flex: 1,
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, var(--reader-accent) 50%, transparent)',
                            borderRadius: '1px'
                        }}
                    />
                    <Typography
                        sx={{
                            color: 'var(--reader-accent)',
                            fontSize: '11px',
                            fontWeight: 500,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            fontFamily: 'var(--reader-font-sans)'
                        }}
                    >
                        New Paragraph
                    </Typography>
                    <Box
                        sx={{
                            flex: 1,
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, var(--reader-accent) 50%, transparent)',
                            borderRadius: '1px'
                        }}
                    />
                </Box>
            )}

            {/* Full-Screen Image Modal */}
            {isImage && imageUrl && (
                <Dialog
                    fullScreen
                    open={isImageModalOpen}
                    onClose={handleCloseImageModal}
                    PaperProps={{
                        sx: {
                            backgroundColor: 'rgba(0,0,0,0.95)'
                        }
                    }}
                >
                    <Box sx={{ position: 'fixed', top: 8, right: 8, zIndex: 1 }}>
                        <IconButton
                            aria-label="Close"
                            onClick={handleCloseImageModal}
                            sx={{ color: 'white' }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Box
                        onClick={handleCloseImageModal}
                        onDoubleClick={handleCloseImageModal}
                        sx={{
                            width: '100vw',
                            height: '100vh',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt={currChunk?.imageAlt || 'Full size image'}
                            style={{
                                width: '100vw',
                                height: '100vh',
                                objectFit: 'contain',
                                backgroundColor: 'white',
                                padding: 0,
                                borderRadius: 0,
                                cursor: 'zoom-out'
                            }}
                        />
                    </Box>
                </Dialog>
            )}
        </Box>
    );
};


