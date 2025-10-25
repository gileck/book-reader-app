import { useCallback } from 'react';
import type { ChapterClient } from '../../../../apis/chapters/types';

export const useScrollHandling = (
    loading: boolean,
    chapter: ChapterClient | null,
    currentChunkIndex: number | null
) => {
    // Enhanced scroll-to-sentence with paragraph context
    const scrollToSentenceChunk = useCallback((chunkIndex: number, paragraphIndex?: number) => {
        // Try paragraph-aware targeting
        if (paragraphIndex !== undefined) {
            const selector = `[data-paragraph-index="${paragraphIndex}"][data-chunk-index="${chunkIndex}"]`;
            const sentenceElement = document.querySelector(selector);
            if (sentenceElement) {
                sentenceElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
                return true;
            }
        }

        // Fallback to chunk index targeting
        const fallbackSelector = `[data-chunk-index="${chunkIndex}"]`;
        const fallbackElement = document.querySelector(fallbackSelector);
        if (fallbackElement) {
            fallbackElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
            return true;
        }

        return false;
    }, []);

    // Get paragraph index for current chunk to enable enhanced targeting
    const getCurrentParagraphIndex = useCallback((chunkIndex: number): number | undefined => {
        if (!chapter) return undefined;

        const currentChunk = chapter.content.chunks[chunkIndex];
        return currentChunk?.paragraphIndex;
    }, [chapter]);

    // Handle scrolling to current chunk with enhanced precision
    const handleScrollToCurrentChunk = useCallback(() => {
        if (currentChunkIndex === null) return;

        // Try enhanced sentence-level scrolling first
        const paragraphIndex = getCurrentParagraphIndex(currentChunkIndex);
        const scrolled = scrollToSentenceChunk(currentChunkIndex, paragraphIndex);

        if (!scrolled) {
            console.warn(`Could not scroll to current chunk ${currentChunkIndex}. Element not found.`);
        }
    }, [currentChunkIndex, getCurrentParagraphIndex, scrollToSentenceChunk]);

    // Navigate to specific chunk by index (for bookmark navigation, etc.)
    const scrollToChunk = useCallback((chunkIndex: number) => {
        const paragraphIndex = getCurrentParagraphIndex(chunkIndex);
        const scrolled = scrollToSentenceChunk(chunkIndex, paragraphIndex);

        if (!scrolled) {
            console.warn(`Could not scroll to chunk ${chunkIndex}. Element not found.`);
        }
    }, [getCurrentParagraphIndex, scrollToSentenceChunk]);

    // Navigate to specific paragraph (useful for paragraph-level navigation)
    const scrollToParagraph = useCallback((paragraphIndex: number) => {
        const paragraphElement = document.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
        if (paragraphElement) {
            paragraphElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
            return true;
        }
        return false;
    }, []);

    return {
        handleScrollToCurrentChunk,
        scrollToChunk,
        scrollToParagraph,
        scrollToSentenceChunk
    };
};