import React from 'react';
import { Box } from '@mui/material';
import { SimpleTextRenderer } from '../../../components/SimpleTextRenderer';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface ReaderContentProps {
    chapter: ChapterClient;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    currentChunkIndex: number;
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    isChunkBookmarked: (chunkIndex: number) => boolean;
}

export const ReaderContent: React.FC<ReaderContentProps> = ({
    chapter,
    scrollContainerRef,
    currentChunkIndex,
    getWordStyle,
    getSentenceStyle,
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
                getSentenceStyle={getSentenceStyle}
                handleWordClick={handleWordClick}
                isChunkBookmarked={isChunkBookmarked}
            />
        </Box>
    );
}; 