import React from 'react';
import { Box } from '@mui/material';
import { HeaderChunk } from './chunks/HeaderChunk';
import { ImageChunk } from './chunks/ImageChunk';
import { TextChunk } from './chunks/TextChunk';
import { ChunkRenderer } from './ChunkRenderer';
import { useEnhancedNavigation } from '../hooks/useEnhancedNavigation';
import { useParagraphGrouping, useFlatChunkIndex } from '../hooks/useParagraphGrouping';
import type { ChapterClient, TextChunkClient } from '../../../../apis/chapters/types';
import type { BookClient } from '../../../../apis/books/types';

interface ReaderContentProps {
    chapter: ChapterClient;
    book: BookClient;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getWordClassName: (chunkIndex: number, wordIndex: number) => string;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName: (chunkIndex: number) => string;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    handleSentenceClick: (chunkIndex: number) => void;
    onNavigateToChapter: (chapterNumber: number) => void;
    onNavigateToChunk: (chunkIndex: number) => void;
    onNavigateToBookmark: (chapterNumber: number, chunkIndex: number) => void;
}

export const ReaderContent: React.FC<ReaderContentProps> = ({
    chapter,
    book,
    scrollContainerRef,
    getWordStyle,
    getWordClassName,
    getSentenceStyle,
    getSentenceClassName,
    handleWordClick,
    handleSentenceClick,
    onNavigateToChapter,
    onNavigateToChunk,
    onNavigateToBookmark
}) => {
    // Enhanced navigation for v2 link handling
    const { handleLinkNavigation } = useEnhancedNavigation({
        chapter,
        currentChapterNumber: chapter.chapterNumber,
        onNavigateToChapter,
        onNavigateToChunk,
        onNavigateToBookmark
    });

    // Group chunks by paragraphIndex for Parser v2 books
    const paragraphGroups = useParagraphGrouping(chapter.content.chunks);
    const { getFlatChunkIndex } = useFlatChunkIndex(paragraphGroups);

    // Determine if this is a Parser v2 book based on the presence of paragraphIndex
    const isParserV2 = chapter.content.chunks.some(chunk =>
        chunk.type === 'text' && chunk.paragraphIndex !== undefined
    );

    // Fallback: Legacy rendering for Parser v1 books or books without paragraphIndex
    const renderLegacyChunks = () => {
        const renderChunk = (chunk: TextChunkClient, index: number) => {
            const chunkType = chunk.type;

            switch (chunkType) {
                case 'header':
                    return (
                        <HeaderChunk
                            key={index}
                            chunk={chunk}
                            chunkIndex={index}
                            level={2} // Could be determined by content analysis
                        />
                    );

                case 'image':
                    return (
                        <ImageChunk
                            key={index}
                            chunk={chunk}
                            book={book}
                            chunkIndex={index}
                        />
                    );

                case 'text':
                default:
                    return (
                        <TextChunk
                            key={index}
                            chunk={chunk}
                            chunkIndex={index}
                            getWordStyle={getWordStyle}
                            getWordClassName={getWordClassName}
                            getSentenceStyle={getSentenceStyle}
                            getSentenceClassName={getSentenceClassName}
                            handleWordClick={handleWordClick}
                            handleSentenceClick={handleSentenceClick}
                            handleLinkClick={handleLinkNavigation}
                        />
                    );
            }
        };

        return (
            <Box sx={{ mt: 4 }} ref={scrollContainerRef}>
                {chapter.content.chunks.map(renderChunk)}
            </Box>
        );
    };

    // Error handling for corrupted v2 data
    if (isParserV2 && paragraphGroups.length === 0) {
        return (
            <Box sx={{ mt: 4, p: 2, backgroundColor: 'error.light', borderRadius: 1 }} ref={scrollContainerRef}>
                <Box sx={{ color: 'error.contrastText' }}>
                    Error: Parser v2 data detected but paragraph grouping failed.
                    Missing or corrupted paragraphIndex data.
                </Box>
            </Box>
        );
    }

    // Use new ChunkRenderer for Parser v2 books
    if (isParserV2) {
        return (
            <Box sx={{ mt: 4 }} ref={scrollContainerRef}>
                <ChunkRenderer
                    paragraphGroups={paragraphGroups}
                    book={book}
                    getWordStyle={getWordStyle}
                    getWordClassName={getWordClassName}
                    getSentenceStyle={getSentenceStyle}
                    getSentenceClassName={getSentenceClassName}
                    handleWordClick={handleWordClick}
                    handleSentenceClick={handleSentenceClick}
                    handleLinkClick={handleLinkNavigation}
                    getFlatChunkIndex={getFlatChunkIndex}
                />
            </Box>
        );
    }

    // Fallback to legacy rendering for Parser v1 books
    return renderLegacyChunks();
}; 