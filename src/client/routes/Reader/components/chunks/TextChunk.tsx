import React from 'react';
import { Box } from '@mui/material';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { EnhancedText } from '../EnhancedText';

interface TextChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    handleLinkClick: (link: ChunkLink) => void;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName: (chunkIndex: number) => string;
    // Note: Word highlighting now handled outside React via DOM manipulation
}

export const TextChunk: React.FC<TextChunkProps> = ({
    chunk,
    chunkIndex,
    handleLinkClick,
    getSentenceStyle,
    getSentenceClassName
}) => {
    return (
        <Box
            sx={{
                lineHeight: 1.6,
                fontSize: '1rem',
                ...getSentenceStyle(chunkIndex)
            }}
            className={getSentenceClassName(chunkIndex)}
            id={`text-chunk-${chunkIndex}`}
            data-chunk-index={chunkIndex}
            data-paragraph-index={chunk.paragraphIndex}
        >
            <EnhancedText
                chunk={chunk}
                chunkIndex={chunkIndex}
                onLinkClick={handleLinkClick}
            />
        </Box>
    );
}; 