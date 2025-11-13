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
    currentChunkIndex: number;
    onChunkDoubleClick?: (chunkIndex: number) => void;
    ttsEnabled?: boolean;
    bionicReadingEnabled?: boolean;
    // Note: Word highlighting now handled outside React via DOM manipulation
    // Note: Sentence highlighting done directly in JSX - much simpler!
}

export const ChunkRenderer: React.FC<ChunkRendererProps> = ({
    paragraphGroups,
    book,
    handleLinkClick,
    currentChunkIndex,
    onChunkDoubleClick,
    ttsEnabled = true,
    bionicReadingEnabled = false
}) => {
    const renderChunk = (chunk: TextChunkClient, groupIndex: number, chunkIndexInGroup: number) => {
        switch (chunk.type) {
            case 'header':
                return (
                    <HeaderChunk
                        key={`${groupIndex}-${chunkIndexInGroup}`}
                        chunk={chunk}
                        chunkIndex={chunk.index}
                        currentChunkIndex={currentChunkIndex}
                        ttsEnabled={ttsEnabled}
                    />
                );

            case 'image':
                return (
                    <ImageChunk
                        key={`${groupIndex}-${chunkIndexInGroup}`}
                        chunk={chunk}
                        book={book}
                        chunkIndex={chunk.index}
                    />
                );

            case 'text':
            default:
                return (
                    <TextChunk
                        key={`${groupIndex}-${chunkIndexInGroup}`}
                        chunk={chunk}
                        chunkIndex={chunk.index}
                        currentChunkIndex={currentChunkIndex}
                        handleLinkClick={handleLinkClick}
                        onChunkDoubleClick={onChunkDoubleClick}
                        ttsEnabled={ttsEnabled}
                        bionicReadingEnabled={bionicReadingEnabled}
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