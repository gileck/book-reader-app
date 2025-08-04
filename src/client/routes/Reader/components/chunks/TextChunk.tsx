import React from 'react';
import { Box } from '@mui/material';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { EnhancedText } from '../EnhancedText';

interface TextChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    currentChunkIndex: number;
    handleLinkClick: (link: ChunkLink) => void;

}

export const TextChunk: React.FC<TextChunkProps> = ({
    chunk,
    chunkIndex,
    currentChunkIndex,
    handleLinkClick
}) => {
    return (
        <Box
            sx={{
                lineHeight: 1.6,
                fontSize: '1rem'
            }}
            className={currentChunkIndex === chunkIndex ? 'current-sentence' : ''}
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