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
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
    const [isScrolling, setIsScrolling] = useState(false);
    const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const WINDOW_SIZE = 25; // Number of chunks to render above/below current chunk

    // Update visible range around current chunk
    useEffect(() => {
        const start = Math.max(0, currentChunkIndex - WINDOW_SIZE);
        const end = Math.min(chapter.content.chunks.length, currentChunkIndex + WINDOW_SIZE + 1);
        setVisibleRange({ start, end });
    }, [currentChunkIndex, chapter.content.chunks.length]);

    // Reset initial scroll flag when chapter changes
    useEffect(() => {
        setHasInitialScrolled(false);
    }, [chapter._id]);

    // Initial scroll to current chunk when component first loads
    useEffect(() => {
        if (!hasInitialScrolled && chunkRefs.current.size > 0) {
            const currentChunkRef = chunkRefs.current.get(currentChunkIndex);
            if (currentChunkRef) {
                // Use setTimeout to ensure DOM is fully rendered
                setTimeout(() => {
                    currentChunkRef.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    setHasInitialScrolled(true);
                }, 100);
            }
        }
    }, [currentChunkIndex, hasInitialScrolled]);

    // Scroll to current chunk when currentChunkIndex changes (during playback)
    useEffect(() => {
        const currentChunkRef = chunkRefs.current.get(currentChunkIndex);
        if (currentChunkRef && !isScrolling && hasInitialScrolled) {
            currentChunkRef.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentChunkIndex, isScrolling, hasInitialScrolled]);

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
            {visibleChunks.map((chunk, relativeIndex) => {
                const absoluteIndex = visibleRange.start + relativeIndex;
                return (
                    <Box
                        key={absoluteIndex}
                        ref={(el: HTMLDivElement | null) => {
                            if (el) {
                                chunkRefs.current.set(absoluteIndex, el);
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
                );
            })}
        </Box>
    );
}; 