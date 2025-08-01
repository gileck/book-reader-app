import React from 'react';
import { Box } from '@mui/material';
import { HeaderChunk } from './chunks/HeaderChunk';
import { ImageChunk } from './chunks/ImageChunk';
import { TextChunk } from './chunks/TextChunk';
import { EnhancedText } from './EnhancedText';
import { ParagraphGroup } from '../hooks/useParagraphGrouping';
import type { TextChunkClient } from '../../../../apis/chapters/types';
import type { BookClient } from '../../../../apis/books/types';

interface ChunkRendererProps {
    paragraphGroups: ParagraphGroup[];
    book: BookClient;
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getWordClassName: (chunkIndex: number, wordIndex: number) => string;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName: (chunkIndex: number) => string;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    handleSentenceClick: (chunkIndex: number) => void;
    handleLinkClick: (link: import('../../../../apis/chapters/types').ChunkLink) => void;
    getFlatChunkIndex: (groupIndex: number, chunkIndexInGroup: number) => number;
}

export const ChunkRenderer: React.FC<ChunkRendererProps> = ({
    paragraphGroups,
    book,
    getWordStyle,
    getWordClassName,
    getSentenceStyle,
    getSentenceClassName,
    handleWordClick,
    handleSentenceClick,
    handleLinkClick,
    getFlatChunkIndex
}) => {

    const renderSingleChunk = (chunk: TextChunkClient, groupIndex: number, chunkIndexInGroup: number = 0) => {
        const flatChunkIndex = getFlatChunkIndex(groupIndex, chunkIndexInGroup);

        switch (chunk.type) {
            case 'header':
                return (
                    <HeaderChunk
                        key={`${groupIndex}-${chunkIndexInGroup}`}
                        chunk={chunk}
                        chunkIndex={flatChunkIndex}
                        level={2}
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
                    <Box
                        key={`${groupIndex}-${chunkIndexInGroup}`}
                        sx={{
                            mb: 0, // No margin for individual sentences
                            lineHeight: 1.6,
                            fontSize: '1rem'
                        }}
                        id={`text-chunk-${flatChunkIndex}`}
                    >
                        <EnhancedText
                            chunk={chunk}
                            chunkIndex={flatChunkIndex}
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
        }
    };

    const renderParagraphGroup = (group: ParagraphGroup, groupIndex: number) => {
        if (group.isStandalone) {
            // Render header or image as standalone
            return renderSingleChunk(group.chunks[0], groupIndex);
        } else {
            // Render paragraph (group of sentences)
            return (
                <Box
                    key={groupIndex}
                    className="paragraph-group"
                    data-paragraph-index={group.paragraphIndex}
                    sx={{
                        mb: 2, // Margin between paragraphs
                        '&:last-child': {
                            mb: 0
                        }
                    }}
                >
                    {group.chunks.map((chunk, chunkIndex) => {
                        const flatChunkIndex = getFlatChunkIndex(groupIndex, chunkIndex);
                        return (
                            <Box
                                key={`${groupIndex}-${chunkIndex}`}
                                component="span"
                                data-paragraph-index={group.paragraphIndex}
                                data-chunk-index={flatChunkIndex}
                                sx={{
                                    display: 'inline',
                                    lineHeight: 1.6,
                                    fontSize: '1rem'
                                }}
                                id={`text-chunk-${flatChunkIndex}`}
                            >
                                <EnhancedText
                                    chunk={chunk}
                                    chunkIndex={flatChunkIndex}
                                    onLinkClick={handleLinkClick}
                                    getWordStyle={getWordStyle}
                                    getWordClassName={getWordClassName}
                                    getSentenceStyle={getSentenceStyle}
                                    getSentenceClassName={getSentenceClassName}
                                    handleWordClick={handleWordClick}
                                    handleSentenceClick={handleSentenceClick}
                                />
                                {chunkIndex < group.chunks.length - 1 && ' '}
                            </Box>
                        );
                    })}
                </Box>
            );
        }
    };

    return (
        <>
            {paragraphGroups.map(renderParagraphGroup)}
        </>
    );
}; 