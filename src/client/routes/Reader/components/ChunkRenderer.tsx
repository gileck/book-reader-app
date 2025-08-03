import React from 'react';
import { Box } from '@mui/material';
import { HeaderChunk } from './chunks/HeaderChunk';
import { ImageChunk } from './chunks/ImageChunk';
import { TextChunk } from './chunks/TextChunk';
import type { TextChunkClient, ChunkLink } from '../../../../apis/chapters/types';
import type { BookClient } from '../../../../apis/books/types';
import type { ParagraphGroup } from '../hooks/useParagraphGrouping';

interface ChunkRendererProps {
    paragraphGroups: ParagraphGroup[];
    book: BookClient;
    handleLinkClick: (link: ChunkLink) => void;
    getFlatChunkIndex: (groupIndex: number, chunkIndexInGroup: number) => number;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName: (chunkIndex: number) => string;
    currentChunkIndex: number;
    // Note: Word highlighting now handled outside React via DOM manipulation
}

export const ChunkRenderer: React.FC<ChunkRendererProps> = ({
    paragraphGroups,
    book,
    handleLinkClick,
    getFlatChunkIndex,
    getSentenceStyle,
    getSentenceClassName,
}) => {
    const renderChunk = (chunk: TextChunkClient, groupIndex: number, chunkIndexInGroup: number) => {
        const flatChunkIndex = getFlatChunkIndex(groupIndex, chunkIndexInGroup);

        switch (chunk.type) {
            case 'header':
                return (
                    <HeaderChunk
                        key={`${groupIndex}-${chunkIndexInGroup}`}
                        chunk={chunk}
                        chunkIndex={flatChunkIndex}
                    />
                );

            case 'image':
                return (
                    <ImageChunk
                        key={`${groupIndex}-${chunkIndexInGroup}`}
                        chunk={chunk}
                        book={book}
                        chunkIndex={flatChunkIndex}
                    />
                );

            case 'text':
            default:
                return (
                    <TextChunk
                        key={`${groupIndex}-${chunkIndexInGroup}`}
                        chunk={chunk}
                        chunkIndex={flatChunkIndex}
                        handleLinkClick={handleLinkClick}
                        getSentenceStyle={getSentenceStyle}
                        getSentenceClassName={getSentenceClassName}
                    />
                );
        }
    };

    return (
        <>
            {paragraphGroups.map((group, groupIndex) => (
                <Box key={groupIndex} sx={{ mb: 2 }}>
                    {group.chunks.map((chunk, chunkIndexInGroup) =>
                        renderChunk(chunk, groupIndex, chunkIndexInGroup)
                    )}
                </Box>
            ))}
        </>
    );
};