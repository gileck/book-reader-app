import { useEffect, useCallback } from 'react';
import type { ChapterClient } from '../../../../apis/chapters/types';

export const useScrollHandling = (
    loading: boolean,
    chapter: ChapterClient | null,
    currentChunkIndex: number
) => {
    // Handle scrolling to current chunk
    const handleScrollToCurrentChunk = useCallback(() => {
        const scrollFunction = (window as Window & { scrollToCurrentChunk?: () => void }).scrollToCurrentChunk;
        if (scrollFunction) {
            scrollFunction();
        }
    }, []);

    // Handle scrolling to chunk when loaded from URL parameters
    useEffect(() => {
        if (!loading && chapter && currentChunkIndex > 0) {
            // Small delay to ensure the component has rendered and scrolling function is available
            const timeoutId = setTimeout(() => {
                handleScrollToCurrentChunk();
            }, 500);

            return () => clearTimeout(timeoutId);
        }
    }, [loading, chapter, currentChunkIndex, handleScrollToCurrentChunk]);

    return {
        handleScrollToCurrentChunk
    };
};