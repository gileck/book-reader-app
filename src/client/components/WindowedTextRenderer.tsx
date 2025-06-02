import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import { useUserTheme } from './UserThemeProvider';
import type { ChapterClient } from '../../apis/chapters/types';

interface WindowedTextRendererProps {
    chapter: ChapterClient;
    currentChunkIndex: number;
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    isChunkBookmarked: (chunkIndex: number) => boolean;
}

const ESTIMATED_CHUNK_HEIGHT = 40; // Estimated height per chunk
const BUFFER_SIZE = 10; // Number of chunks to buffer above/below visible area

export const WindowedTextRenderer: React.FC<WindowedTextRendererProps> = ({
    chapter,
    currentChunkIndex,
    getWordStyle,
    getSentenceStyle,
    handleWordClick,
    isChunkBookmarked
}) => {
    const { fontSize, lineHeight, fontFamily, textColor } = useUserTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
    const [actualChunkHeights, setActualChunkHeights] = useState<Map<number, number>>(new Map());

    // Calculate visible range based on scroll position
    const calculateVisibleRange = useCallback(() => {
        const container = containerRef.current?.parentElement;
        if (!container) return;

        const scrollTop = container.scrollTop;
        const viewportHeight = container.clientHeight;

        // Calculate start and end indices based on estimated heights
        let cumulativeHeight = 0;
        let startIndex = 0;
        let endIndex = 0;

        for (let i = 0; i < chapter.content.chunks.length; i++) {
            const chunkHeight = actualChunkHeights.get(i) || ESTIMATED_CHUNK_HEIGHT;

            if (cumulativeHeight + chunkHeight >= scrollTop && startIndex === 0) {
                startIndex = Math.max(0, i - BUFFER_SIZE);
            }

            if (cumulativeHeight <= scrollTop + viewportHeight + (BUFFER_SIZE * ESTIMATED_CHUNK_HEIGHT)) {
                endIndex = i;
            }

            cumulativeHeight += chunkHeight;
        }

        endIndex = Math.min(chapter.content.chunks.length, endIndex + BUFFER_SIZE);

        setVisibleRange(prev => {
            if (prev.start !== startIndex || prev.end !== endIndex) {
                console.log('📊 Visible range updated:', {
                    previous: prev,
                    new: { start: startIndex, end: endIndex },
                    totalChunks: chapter.content.chunks.length,
                    renderingChunks: endIndex - startIndex,
                    percentageRendered: (((endIndex - startIndex) / chapter.content.chunks.length) * 100).toFixed(1) + '%'
                });
                return { start: startIndex, end: endIndex };
            }
            return prev;
        });
    }, [chapter.content.chunks.length, actualChunkHeights]);

    // Update chunk heights when rendered
    const updateChunkHeight = useCallback((chunkIndex: number, element: HTMLDivElement) => {
        const height = element.getBoundingClientRect().height;
        setActualChunkHeights(prev => {
            const newMap = new Map(prev);
            newMap.set(chunkIndex, height);
            return newMap;
        });
    }, []);

    // Initial calculation and scroll listener
    useEffect(() => {
        const container = containerRef.current?.parentElement;
        if (!container) return;

        const handleScroll = () => calculateVisibleRange();

        // Initial calculation
        calculateVisibleRange();

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [calculateVisibleRange]);

    // Recalculate when chapter changes
    useEffect(() => {
        setVisibleRange({ start: 0, end: 20 });
        setActualChunkHeights(new Map());
        calculateVisibleRange();
    }, [chapter._id, calculateVisibleRange]);

    // Calculate total height for virtual scrolling
    const getTotalHeight = () => {
        let total = 0;
        for (let i = 0; i < chapter.content.chunks.length; i++) {
            total += actualChunkHeights.get(i) || ESTIMATED_CHUNK_HEIGHT;
        }
        return total;
    };

    // Calculate offset for chunks before visible range
    const getOffsetHeight = () => {
        let offset = 0;
        for (let i = 0; i < visibleRange.start; i++) {
            offset += actualChunkHeights.get(i) || ESTIMATED_CHUNK_HEIGHT;
        }
        return offset;
    };

    // Scroll to current chunk when currentChunkIndex changes
    useEffect(() => {
        if (currentChunkIndex >= visibleRange.start && currentChunkIndex <= visibleRange.end) {
            const currentChunkRef = chunkRefs.current.get(currentChunkIndex);
            if (currentChunkRef) {
                currentChunkRef.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        } else {
            // Current chunk is outside visible range, need to update range
            const start = Math.max(0, currentChunkIndex - 10);
            const end = Math.min(chapter.content.chunks.length, currentChunkIndex + 10);
            setVisibleRange({ start, end });
        }
    }, [currentChunkIndex, visibleRange.start, visibleRange.end, chapter.content.chunks.length]);

    const visibleChunks = chapter.content.chunks.slice(visibleRange.start, visibleRange.end);

    return (
        <Box ref={containerRef} sx={{ position: 'relative', height: getTotalHeight() }}>
            {/* Spacer for chunks before visible range */}
            <Box sx={{ height: getOffsetHeight() }} />

            {/* Visible chunks */}
            <Box>
                {visibleChunks.map((chunk, relativeIndex) => {
                    const absoluteIndex = visibleRange.start + relativeIndex;
                    const previousChunk = relativeIndex > 0 ? visibleChunks[relativeIndex - 1] : null;
                    const showPageNumber = chunk.pageNumber &&
                        chunk.pageNumber !== previousChunk?.pageNumber &&
                        chunk.type === 'text';

                    return (
                        <React.Fragment key={absoluteIndex}>
                            {/* Page Number Separator */}
                            {showPageNumber && (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        my: 4,
                                        gap: 2
                                    }}
                                >
                                    <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: 'text.secondary',
                                            fontWeight: 'medium',
                                            px: 2,
                                            py: 1,
                                            backgroundColor: 'background.paper',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: '16px',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        Page {chunk.pageNumber}
                                    </Typography>
                                    <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                                </Box>
                            )}

                            <Box
                                ref={(el: HTMLDivElement | null) => {
                                    if (el) {
                                        chunkRefs.current.set(absoluteIndex, el);
                                        // Measure and update height
                                        const resizeObserver = new ResizeObserver(() => {
                                            updateChunkHeight(absoluteIndex, el);
                                        });
                                        resizeObserver.observe(el);
                                        return () => resizeObserver.disconnect();
                                    } else {
                                        chunkRefs.current.delete(absoluteIndex);
                                    }
                                }}
                                sx={{
                                    mb: 0.5,
                                    position: 'relative'
                                }}
                            >
                                {chunk.type === 'text' ? (
                                    <>
                                        {isChunkBookmarked(absoluteIndex) && (
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    left: -30,
                                                    top: 0,
                                                    color: '#1976d2',
                                                    fontSize: '1.2rem'
                                                }}
                                            >
                                                🔖
                                            </Box>
                                        )}
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                lineHeight: lineHeight,
                                                fontSize: `${fontSize}rem`,
                                                fontFamily: fontFamily,
                                                color: textColor,
                                                wordSpacing: 'normal',
                                                ...getSentenceStyle(absoluteIndex)
                                            }}
                                        >
                                            {chunk.text.split(' ').filter(word => word.length > 0).map((word, wordIndex, words) => (
                                                <React.Fragment key={wordIndex}>
                                                    <span
                                                        data-chunk-index={absoluteIndex}
                                                        data-word-index={wordIndex}
                                                        style={getWordStyle(absoluteIndex, wordIndex)}
                                                        onDoubleClick={() => handleWordClick(absoluteIndex, wordIndex)}
                                                    >
                                                        {word}
                                                    </span>
                                                    {wordIndex < words.length - 1 && ' '}
                                                </React.Fragment>
                                            ))}
                                        </Typography>
                                    </>
                                ) : chunk.type === 'image' ? (
                                    <Box textAlign="center" my={2}>
                                        <Image
                                            src={chunk.imageUrl || ''}
                                            alt={chunk.imageAlt || 'Chapter image'}
                                            width={800}
                                            height={400}
                                            style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }}
                                        />
                                        {chunk.imageAlt && (
                                            <Typography variant="caption" display="block" mt={1}>
                                                {chunk.imageAlt}
                                            </Typography>
                                        )}
                                    </Box>
                                ) : null}
                            </Box>
                        </React.Fragment>
                    );
                })}
            </Box>

            {/* Spacer for chunks after visible range */}
            <Box sx={{
                height: getTotalHeight() - getOffsetHeight() - visibleChunks.reduce((acc, _, i) =>
                    acc + (actualChunkHeights.get(visibleRange.start + i) || ESTIMATED_CHUNK_HEIGHT), 0)
            }} />
        </Box>
    );
}; 