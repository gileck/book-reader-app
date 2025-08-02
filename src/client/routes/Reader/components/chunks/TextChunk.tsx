import React from 'react';
import { Box } from '@mui/material';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { EnhancedText } from '../EnhancedText';

interface TextChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    handleLinkClick: (link: ChunkLink) => void;
}

export const TextChunk: React.FC<TextChunkProps> = ({
    chunk,
    chunkIndex,
    handleLinkClick
}) => {
    return (
        <Box
            sx={{
                lineHeight: 1.6,
                fontSize: '1rem'
            }}
            id={`text-chunk-${chunkIndex}`}
            data-chunk-index={chunkIndex}
        >
            <EnhancedText
                chunk={chunk}
                onLinkClick={handleLinkClick}
            />
        </Box>
    );
}; 