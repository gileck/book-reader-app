import React from 'react';
import { Box } from '@mui/material';
import { SimpleTextRenderer } from '../../../components/SimpleTextRenderer';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface ReaderContentProps {
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

export const ReaderContent: React.FC<ReaderContentProps> = ({
    chapter,
    scrollContainerRef,
    currentChunkIndex,
    getWordStyle,
    getWordClassName,
    getSentenceStyle,
    getSentenceClassName,
    handleWordClick,
    isChunkBookmarked
}) => {
    return (
        <Box sx={{ mt: 4 }}>
            <SimpleTextRenderer
                chapter={chapter}
                scrollContainerRef={scrollContainerRef}
                currentChunkIndex={currentChunkIndex}
                getWordStyle={getWordStyle}
                getWordClassName={getWordClassName}
                getSentenceStyle={getSentenceStyle}
                getSentenceClassName={getSentenceClassName}
                handleWordClick={handleWordClick}
                isChunkBookmarked={isChunkBookmarked}
            />
        </Box>
    );
}; 