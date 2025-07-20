import React from 'react';
import { Box } from '@mui/material';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { EnhancedText } from '../EnhancedText';

interface TextChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getWordClassName: (chunkIndex: number, wordIndex: number) => string;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName: (chunkIndex: number) => string;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    handleSentenceClick: (chunkIndex: number) => void;
    handleLinkClick: (link: ChunkLink) => void;
}

export const TextChunk: React.FC<TextChunkProps> = ({
    chunk,
    chunkIndex,
    getWordStyle,
    getWordClassName,
    getSentenceStyle,
    getSentenceClassName,
    handleWordClick,
    handleSentenceClick,
    handleLinkClick
}) => {
    return (
        <Box
            sx={{
                mb: 2,
                lineHeight: 1.6,
                fontSize: '1rem'
            }}
            id={`text-chunk-${chunkIndex}`}
        >
            <EnhancedText
                chunk={chunk}
                chunkIndex={chunkIndex}
                onLinkClick={handleLinkClick}
                getWordStyle={getWordStyle}
                getWordClassName={getWordClassName}
                getSentenceStyle={getSentenceStyle}
                getSentenceClassName={getSentenceClassName}
                handleWordClick={handleWordClick}
                handleSentenceClick={handleSentenceClick}
            />
        </Box>
    );
}; 