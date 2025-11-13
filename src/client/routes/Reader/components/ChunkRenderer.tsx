import React from 'react';
import { Box, Divider } from '@mui/material';
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
    chunkSpacing?: number;
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
    bionicReadingEnabled = false,
    chunkSpacing = 0.5
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
                        chunkSpacing={chunkSpacing}
                    />
                );
        }
    };

    return (
        <>
            {paragraphGroups.map((group, groupIndex) => {
                const nextGroup = paragraphGroups[groupIndex + 1];
                const isParagraph = !group.isStandalone;
                const nextIsParagraph = nextGroup && !nextGroup.isStandalone;
                const showDivider = isParagraph && nextIsParagraph;
                
                // Add double spacing (blank line) between consecutive paragraphs
                // Single spacing for other cases (after headers/images, or before standalone elements)
                // Using 1.5em to represent approximately one blank line (scales with font-size)
                const marginBottom = showDivider
                    ? { mb: '1em' } // Less margin since divider provides visual separation
                    : { mb: 2 }; // Normal spacing
                
                return (
                    <React.Fragment key={groupIndex}>
                        <Box sx={marginBottom}>
                            {group.chunks.map((chunk, chunkIndexInGroup) =>
                                renderChunk(chunk, groupIndex, chunkIndexInGroup)
                            )}
                        </Box>
                        {showDivider && (
                            <Divider sx={{ 
                                my: '1em',
                                opacity: 0.3,
                                borderColor: 'var(--reader-text-color, currentColor)'
                            }} />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};