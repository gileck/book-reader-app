import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { ChunkRenderer } from './ChunkRenderer';
import { useEnhancedNavigation } from '../hooks/useEnhancedNavigation';
import { useParagraphGrouping } from '../hooks/useParagraphGrouping';
import type { SentenceChunk, ParagraphGroupMeta } from '../types';
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
    // Optional sentence-level data (Phase 4)
    sentences?: SentenceChunk[];
    paragraphGroups?: ParagraphGroupMeta[];
    // Theme settings - applied only to reader content
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;
    highlightColor: string;
    sentenceHighlightColor: string;
    ttsEnabled?: boolean;
    bionicReadingEnabled?: boolean;
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
    currentChunkIndex,
    fontSize,
    lineHeight,
    fontFamily,
    textColor,
    highlightColor,
    sentenceHighlightColor,
    ttsEnabled = true,
    bionicReadingEnabled = false
}) => {
    const readerContentRef = useRef<HTMLDivElement>(null);
    const [cssVarsApplied, setCssVarsApplied] = useState(false);

    // Set CSS variables on the reader content container only
    useEffect(() => {
        setCssVarsApplied(false); // Reset first
        const container = readerContentRef.current;
        if (container) {
            // Apply CSS variables
            container.style.setProperty('--reader-font-size', `${fontSize}rem`);
            container.style.setProperty('--reader-line-height', lineHeight.toString());
            container.style.setProperty('--reader-font-family', fontFamily);
            container.style.setProperty('--reader-text-color', textColor);
            container.style.setProperty('--word-highlight-color', highlightColor);
            container.style.setProperty('--sentence-highlight-color', sentenceHighlightColor);

            // Use requestAnimationFrame to ensure CSS variables are applied before showing content
            requestAnimationFrame(() => {
                setTimeout(() => {
                    setCssVarsApplied(true);
                }, 300);
            });
        }
    }, [fontSize, lineHeight, fontFamily, textColor, highlightColor, sentenceHighlightColor]);
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

    // Render content using ChunkRenderer - wait for CSS vars to be applied
    return (
        <Box
            ref={readerContentRef}
            sx={{
                mt: 4,
                // Apply theme settings directly to the reader content container
                fontSize: 'var(--reader-font-size, 1rem)',
                lineHeight: 'var(--reader-line-height, 1.5)',
                fontFamily: 'var(--reader-font-family, Inter, system-ui, sans-serif)',
                color: 'var(--reader-text-color, inherit)',
                // Hide content until CSS variables are applied to prevent flicker
                opacity: cssVarsApplied ? 1 : 0,
                transition: 'opacity 0.1s ease-in-out'
            }}
        >
            <ChunkRenderer
                paragraphGroups={paragraphGroups}
                book={book}
                handleLinkClick={handleLinkNavigation}
                currentChunkIndex={currentChunkIndex}
                onChunkDoubleClick={onNavigateToChunk}
                ttsEnabled={ttsEnabled}
                bionicReadingEnabled={bionicReadingEnabled}
            />
        </Box>
    );
};