import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import { useUserTheme } from './UserThemeProvider';
import type { ChapterClient } from '../../apis/chapters/types';

interface SimpleTextRendererProps {
    chapter: ChapterClient;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    currentChunkIndex: number;
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getWordClassName: (chunkIndex: number, wordIndex: number) => string;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName: (chunkIndex: number) => string;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    isChunkBookmarked: (chunkIndex: number) => boolean;
}

export const SimpleTextRenderer: React.FC<SimpleTextRendererProps> = ({
    chapter,
    currentChunkIndex,
    getWordStyle,
    getWordClassName,
    getSentenceStyle,
    getSentenceClassName,
    handleWordClick,
    isChunkBookmarked
}) => {
    const { fontSize, lineHeight, fontFamily, textColor } = useUserTheme();
    const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const previousChunkIndex = useRef<number>(currentChunkIndex);

    // Auto-scroll to current chunk only when chunk index changes
    useEffect(() => {
        if (previousChunkIndex.current !== currentChunkIndex) {
            const currentChunkRef = chunkRefs.current.get(currentChunkIndex);
            if (currentChunkRef) {
                currentChunkRef.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
            previousChunkIndex.current = currentChunkIndex;
        }
    }, [currentChunkIndex]);

    return (
        <Box>
            {chapter.content.chunks.map((chunk, index) => {
                const previousChunk = index > 0 ? chapter.content.chunks[index - 1] : null;
                const showPageNumber = chunk.pageNumber &&
                    chunk.pageNumber !== previousChunk?.pageNumber &&
                    chunk.type === 'text';

                return (
                    <React.Fragment key={index}>
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
                                    chunkRefs.current.set(index, el);
                                } else {
                                    chunkRefs.current.delete(index);
                                }
                            }}
                            data-chunk-index={index}
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
                                        className={getSentenceClassName(index)}
                                        sx={{
                                            lineHeight: lineHeight,
                                            fontSize: `${fontSize}rem`,
                                            fontFamily: fontFamily,
                                            color: textColor,
                                            wordSpacing: 'normal',
                                            ...getSentenceStyle(index)
                                        }}
                                    >
                                        {chunk.text.split(' ').filter(word => word.length > 0).map((word, wordIndex, words) => (
                                            <React.Fragment key={wordIndex}>
                                                <span
                                                    data-chunk-index={index}
                                                    data-word-index={wordIndex}
                                                    className={getWordClassName(index, wordIndex)}
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
                    </React.Fragment>
                );
            })}
        </Box>
    );
}; 