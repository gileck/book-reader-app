import React, { useCallback } from 'react';
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
    onNavigateToChapter: (chapterNumber: number) => void;
    onNavigateToChunk: (chunkIndex: number) => void;
    onNavigateToBookmark: (chapterNumber: number, chunkIndex: number) => void;
}

export const ReaderContent: React.FC<ReaderContentProps> = ({
    chapter,
    book,
    scrollContainerRef,
    onNavigateToChapter,
    onNavigateToChunk,
    onNavigateToBookmark
}) => {
    // Wrap onNavigateToChunk to add manual scrolling
    const handleNavigateToChunk = useCallback((chunkIndex: number) => {
        console.log('🚀 ReaderContent: Navigating to chunk', chunkIndex, typeof chunkIndex === 'string' ? '(chunk ID)' : '(array index)');
        // onNavigateToChunk(chunkIndex);

        // Manual scroll fallback - try multiple selectors
        setTimeout(() => {
            console.log('🔍 Manual scroll attempt for chunk', chunkIndex);

            // Try different selectors - support both chunk ID and array index
            const selectors = [
                `#text-chunk-${chunkIndex}`,           // Primary: text chunk with chunk ID
                `#header-chunk-${chunkIndex}`,         // Primary: header chunk with chunk ID  
                `#image-chunk-${chunkIndex}`,          // Primary: image chunk with chunk ID
                `[data-chunk-id="${chunkIndex}"]`,     // Secondary: direct chunk ID lookup  
                `[data-chunk-index="${chunkIndex}"]`,  // Legacy: array index
                `[data-paragraph-index][data-chunk-index="${chunkIndex}"]` // Legacy with paragraph
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    console.log('✅ Found element with selector:', selector);
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                    return;
                }
            }

            console.log('❌ No element found for chunk', chunkIndex);
        }, 100);
    }, [onNavigateToChunk]);

    // Enhanced navigation for v2 link handling
    const { handleLinkNavigation } = useEnhancedNavigation({
        chapter,
        currentChapterNumber: chapter.chapterNumber,
        onNavigateToChapter,
        onNavigateToChunk: handleNavigateToChunk,
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
                    handleLinkClick={handleLinkNavigation}
                    getFlatChunkIndex={getFlatChunkIndex}
                />
            </Box>
        );
    }

    // Fallback to legacy rendering for Parser v1 books
    return renderLegacyChunks();
}; 