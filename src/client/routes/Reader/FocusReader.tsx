import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, useTheme, CircularProgress, Alert, Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { SentenceAudioApi } from './hooks/useSentenceAudioController';
import type { TextChunkClient } from '@/apis/chapters/types';
import type { BookClient } from '@/apis/books/types';
import { useUserTheme } from '@/client/components/UserThemeProvider';
import { VERCEL_BLOB_IMAGES_BASE_PATH } from '@/common/constants';

export const FocusReader: React.FC<{
    controller: SentenceAudioApi;
    highlightMode?: 'word' | 'line' | 'off';
    ttsEnabled?: boolean;
    book?: BookClient;
}> = ({ controller, highlightMode = 'word', ttsEnabled = true, book }) => {
    const sentences = controller.sentences;
    const currentSentenceIndex = controller.currentSentenceIndex;
    const isPlaying = controller.isPlaying;
    const currentWordIndex = controller.currentWordIndex;
    const { textColor, highlightColor, fontSize, lineHeight, fontFamily } = useUserTheme();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

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
                backgroundColor: 'background.default',
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
                    cursor: (prevText || isPrevImage) ? 'pointer' : 'default',
                    ...(isPrevHeader && {
                        mx: -2,
                        px: 2,
                        py: 1.5,
                        borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                        backgroundColor: isDarkMode ? 'rgba(51, 51, 51, 0.6)' : 'rgba(211, 211, 211, 0.6)'
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
                        variant="caption"
                        sx={{
                            color: textColor,
                            textAlign: 'center',
                            opacity: 0.5,
                            fontStyle: 'italic',
                            display: 'block'
                        }}
                    >
                        [Previous Image]
                    </Typography>
                ) : (
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
                )}
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
                    ...(!isHeader && !isImage && {
                        py: 2,
                        px: 2,
                        mx: -2,
                        borderRadius: '12px',
                        ...(isDarkMode && {
                            backgroundColor: 'rgba(0, 0, 0, 0.6)'
                        })
                    }),
                    ...(isHeader && {
                        mx: -2,
                        px: 2,
                        py: 3,
                        backgroundColor: isDarkMode ? '#333333' : 'rgba(211, 211, 211, 0.3)',
                        borderTop: isDarkMode ? '2px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                        borderBottom: isDarkMode ? '2px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)'
                    }),
                    ...(isImage && {
                        my: 3,
                        textAlign: 'center'
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
                                                if (!ttsEnabled) return '';
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
                    </>
                )}
            </Box>

            {/* Next (smaller, subdued, under) */}
            <Box
                sx={{
                    minHeight: 44,
                    ...(isNextHeader && {
                        mx: -2,
                        px: 2,
                        py: 1.5,
                        borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                        backgroundColor: isDarkMode ? 'rgba(51, 51, 51, 0.6)' : 'rgba(211, 211, 211, 0.6)'
                    })
                }}
            >
                {isNextImage ? (
                    <Typography
                        variant="caption"
                        sx={{
                            color: textColor,
                            textAlign: 'center',
                            opacity: 0.5,
                            fontStyle: 'italic',
                            display: 'block'
                        }}
                    >
                        [Next Image]
                    </Typography>
                ) : (
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
                )}
            </Box>

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


