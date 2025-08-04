import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import { ChunkRenderer } from './ChunkRenderer';
import { useEnhancedNavigation } from '../hooks/useEnhancedNavigation';
import { useParagraphGrouping, useFlatChunkIndex } from '../hooks/useParagraphGrouping';
import type { ChapterClient } from '../../../../apis/chapters/types';
import type { BookClient } from '../../../../apis/books/types';

interface ReaderContentProps {
    chapter: ChapterClient;
    book: BookClient;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    onNavigateToChapter: (chapterNumber: number) => void;
    onNavigateToChunk: (chunkIndex: number) => void;
    onNavigateToBookmark: (chapterNumber: number, chunkIndex: number) => void;
    currentChunkIndex: number;
    // Note: Word highlighting now handled outside React via DOM manipulation
    // Note: Sentence highlighting done directly in JSX - much simpler!
}

export const ReaderContent: React.FC<ReaderContentProps> = ({
    chapter,
    book,
    scrollContainerRef,
    onNavigateToChapter,
    onNavigateToChunk,
    onNavigateToBookmark,
    currentChunkIndex
}) => {
    // Navigate to chunk with parser v2 targeting
    const handleNavigateToChunk = useCallback((chunkIndex: number) => {
        console.log('🚀 ReaderContent: Navigating to chunk', chunkIndex);

        // Parser v2 scroll targeting
        setTimeout(() => {
            const selector = `[data-paragraph-index][data-chunk-index="${chunkIndex}"]`;
            const element = document.querySelector(selector);
            if (element) {
                console.log('✅ Found element with selector:', selector);
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            } else {
                console.log('❌ No element found for chunk', chunkIndex);
            }
        }, 100);
    }, [onNavigateToChunk]);

    // Enhanced navigation for link handling
    const { handleLinkNavigation } = useEnhancedNavigation({
        chapter,
        currentChapterNumber: chapter.chapterNumber,
        onNavigateToChapter,
        onNavigateToChunk: handleNavigateToChunk,
        onNavigateToBookmark
    });

    // Group chunks by paragraphIndex
    const paragraphGroups = useParagraphGrouping(chapter.content.chunks);
    const { getFlatChunkIndex } = useFlatChunkIndex(paragraphGroups);

    // Error handling for corrupted data
    if (paragraphGroups.length === 0) {
        return (
            <Box sx={{ mt: 4, p: 2, backgroundColor: 'error.light', borderRadius: 1 }} ref={scrollContainerRef}>
                <Box sx={{ color: 'error.contrastText' }}>
                    Error: Paragraph grouping failed. Missing or corrupted paragraphIndex data.
                </Box>
            </Box>
        );
    }

    // Render content using ChunkRenderer
    return (
        <Box sx={{ mt: 4 }} ref={scrollContainerRef}>
            <ChunkRenderer
                paragraphGroups={paragraphGroups}
                book={book}
                handleLinkClick={handleLinkNavigation}
                getFlatChunkIndex={getFlatChunkIndex}
                currentChunkIndex={currentChunkIndex}
            />
        </Box>
    );
};