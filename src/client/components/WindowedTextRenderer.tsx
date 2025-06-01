import React, { useEffect, useState, useRef, useCallback } from 'react';
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

export const WindowedTextRenderer: React.FC<WindowedTextRendererProps> = ({
    chapter,
    currentChunkIndex,
    getWordStyle,
    getSentenceStyle,
    handleWordClick,
    isChunkBookmarked
}) => {
    const { fontSize, lineHeight, fontFamily, textColor } = useUserTheme();
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
    const [isScrolling, setIsScrolling] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const topTriggerRef = useRef<HTMLDivElement>(null);
    const bottomTriggerRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const WINDOW_SIZE = 10; // Number of chunks to render above/below visible area
    const CHUNK_HEIGHT_ESTIMATE = 150; // Estimated height per chunk for virtual positioning

    // Initialize visible range around current chunk
    useEffect(() => {
        const start = Math.max(0, currentChunkIndex - WINDOW_SIZE);
        const end = Math.min(chapter.content.chunks.length, currentChunkIndex + WINDOW_SIZE * 2);
        setVisibleRange({ start, end });
    }, [currentChunkIndex, chapter.content.chunks.length]);

    // Scroll to current chunk when index changes
    useEffect(() => {
        const currentChunkRef = chunkRefs.current.get(currentChunkIndex);
        if (currentChunkRef && !isScrolling) {
            currentChunkRef.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentChunkIndex]);

    // Intersection Observer for dynamic loading
    useEffect(() => {
        if (!topTriggerRef.current || !bottomTriggerRef.current) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (entry.target === topTriggerRef.current) {
                            // Expand upward
                            setVisibleRange(prev => ({
                                start: Math.max(0, prev.start - WINDOW_SIZE),
                                end: prev.end
                            }));
                        } else if (entry.target === bottomTriggerRef.current) {
                            // Expand downward
                            setVisibleRange(prev => ({
                                start: prev.start,
                                end: Math.min(chapter.content.chunks.length, prev.end + WINDOW_SIZE)
                            }));
                        }
                    }
                });
            },
            {
                root: containerRef.current,
                rootMargin: '100px',
                threshold: 0.1
            }
        );

        if (topTriggerRef.current) {
            observerRef.current.observe(topTriggerRef.current);
        }
        if (bottomTriggerRef.current) {
            observerRef.current.observe(bottomTriggerRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [chapter.content.chunks.length]);

    // Handle scroll events
    const handleScroll = useCallback(() => {
        setIsScrolling(true);

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            setIsScrolling(false);
        }, 150);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    const renderChunk = (chunk: ChapterClient['content']['chunks'][0], index: number) => (
        <Box
            key={index}
            ref={(el: HTMLDivElement | null) => {
                if (el) {
                    chunkRefs.current.set(index, el);
                } else {
                    chunkRefs.current.delete(index);
                }
            }}
            sx={{
                mb: 0.5,
                position: 'relative'
            }}
        >
            {chunk.type === 'text' ? (
                <>
                    {isChunkBookmarked(index) && (
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
                            ...getSentenceStyle(index)
                        }}
                    >
                        {chunk.text.split(' ').map((word, wordIndex, words) => (
                            <React.Fragment key={wordIndex}>
                                <span
                                    data-chunk-index={index}
                                    data-word-index={wordIndex}
                                    style={getWordStyle(index, wordIndex)}
                                    onDoubleClick={() => handleWordClick(index, wordIndex)}
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
    );

    const visibleChunks = chapter.content.chunks.slice(visibleRange.start, visibleRange.end);

    return (
        <Box
            ref={containerRef}
            sx={{
                height: '100%',
                overflow: 'auto',
                position: 'relative'
            }}
        >
            {/* Virtual spacer for content above visible range */}
            {visibleRange.start > 0 && (
                <Box sx={{ height: visibleRange.start * CHUNK_HEIGHT_ESTIMATE }} />
            )}

            {/* Top trigger for loading content above */}
            {visibleRange.start > 0 && (
                <Box
                    ref={topTriggerRef}
                    sx={{
                        height: 1,
                        position: 'absolute',
                        top: visibleRange.start * CHUNK_HEIGHT_ESTIMATE,
                        width: '100%'
                    }}
                />
            )}

            {/* Visible content */}
            <Box sx={{ position: 'relative' }}>
                {visibleChunks.map((chunk, relativeIndex) => {
                    const absoluteIndex = visibleRange.start + relativeIndex;
                    return renderChunk(chunk, absoluteIndex);
                })}
            </Box>

            {/* Bottom trigger for loading content below */}
            {visibleRange.end < chapter.content.chunks.length && (
                <Box
                    ref={bottomTriggerRef}
                    sx={{
                        height: 1,
                        position: 'absolute',
                        bottom: (chapter.content.chunks.length - visibleRange.end) * CHUNK_HEIGHT_ESTIMATE,
                        width: '100%'
                    }}
                />
            )}

            {/* Virtual spacer for content below visible range */}
            {visibleRange.end < chapter.content.chunks.length && (
                <Box sx={{ height: (chapter.content.chunks.length - visibleRange.end) * CHUNK_HEIGHT_ESTIMATE }} />
            )}
        </Box>
    );
}; 