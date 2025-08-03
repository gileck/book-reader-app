import { useEffect, useCallback } from 'react';
import type { ChapterClient } from '../../../../apis/chapters/types';

export const useScrollHandling = (
    loading: boolean,
    chapter: ChapterClient | null,
    currentChunkIndex: number
) => {
    // Enhanced scroll-to-sentence with paragraph context for Parser v2
    const scrollToSentenceChunk = useCallback((chunkIndex: number, paragraphIndex?: number) => {

        // Try paragraph-aware targeting first (Parser v2)
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

        // Fallback to chunk index targeting (Parser v1 & v2 compatibility)
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

        // Fallback to legacy text-chunk ID targeting
        const legacySelector = `#text-chunk-${chunkIndex}`;
        const legacyElement = document.querySelector(legacySelector);
        if (legacyElement) {
            legacyElement.scrollIntoView({
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
        // Try enhanced sentence-level scrolling first
        const paragraphIndex = getCurrentParagraphIndex(currentChunkIndex);
        const scrolled = scrollToSentenceChunk(currentChunkIndex, paragraphIndex);

        if (!scrolled) {
            // Ultimate fallback to legacy global scroll function
            const scrollFunction = (window as Window & { scrollToCurrentChunk?: () => void }).scrollToCurrentChunk;
            if (scrollFunction) {
                scrollFunction();
            }
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

    // Handle scrolling to chunk when loaded from URL parameters
    useEffect(() => {
        if (!loading && chapter && currentChunkIndex > 0) {
            // Small delay to ensure the component has rendered and DOM elements are available
            const timeoutId = setTimeout(() => {
                handleScrollToCurrentChunk();
            }, 500);

            return () => clearTimeout(timeoutId);
        }
    }, [loading, chapter, currentChunkIndex, handleScrollToCurrentChunk]);

    return {
        handleScrollToCurrentChunk,
        scrollToChunk,
        scrollToParagraph,
        scrollToSentenceChunk
    };
};