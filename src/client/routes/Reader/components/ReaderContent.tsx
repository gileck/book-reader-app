import React from 'react';
import { Box } from '@mui/material';
import { WindowedTextRenderer } from '../../../components/WindowedTextRenderer';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface ReaderContentProps {
    chapter: ChapterClient;
    currentChunkIndex: number;
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    isChunkBookmarked: (chunkIndex: number) => boolean;
}

export const ReaderContent: React.FC<ReaderContentProps> = ({
    chapter,
    currentChunkIndex,
    getWordStyle,
    getSentenceStyle,
    handleWordClick,
    isChunkBookmarked
}) => {
    return (
        <Box sx={{ mt: 4 }}>
            <WindowedTextRenderer
                chapter={chapter}
                currentChunkIndex={currentChunkIndex}
                getWordStyle={getWordStyle}
                getSentenceStyle={getSentenceStyle}
                handleWordClick={handleWordClick}
                isChunkBookmarked={isChunkBookmarked}
            />
        </Box>
    );
}; 