import { useCallback } from 'react';
import { ChunkLink, ChapterClient, TextChunkClient } from '@/apis/chapters/types';

interface UseEnhancedNavigationProps {
    chapter: ChapterClient | null;
    currentChapterNumber: number;
    onNavigateToChapter: (chapterNumber: number) => void;
    onNavigateToChunk: (chunkIndex: number) => void;
    onNavigateToBookmark: (chapterNumber: number, chunkIndex: number) => void;
}

export const useEnhancedNavigation = ({
    chapter,
    currentChapterNumber,
    onNavigateToChapter,
    onNavigateToChunk,
    onNavigateToBookmark
}: UseEnhancedNavigationProps) => {

    // Find chunk by page number within current chapter
    const findChunkByPage = useCallback((pageNumber: number): { index: number; chunk: TextChunkClient } | null => {
        if (!chapter) return null;

        const chunkIndex = chapter.content.chunks.findIndex(chunk =>
            chunk.pageNumber === pageNumber
        );

        if (chunkIndex === -1) return null;

        return {
            index: chunkIndex,
            chunk: chapter.content.chunks[chunkIndex]
        };
    }, [chapter]);

    // Find text chunk index (for audio) from absolute chunk index
    const findTextChunkIndex = useCallback((absoluteChunkIndex: number): number => {
        if (!chapter) return 0;

        let textChunkIndex = 0;
        for (let i = 0; i < absoluteChunkIndex && i < chapter.content.chunks.length; i++) {
            if (chapter.content.chunks[i].type === 'text') {
                textChunkIndex++;
            }
        }

        return Math.max(0, textChunkIndex - 1); // Convert to 0-based index
    }, [chapter]);

    // Handle navigation to a specific link target
    const handleLinkNavigation = useCallback(async (link: ChunkLink) => {
        console.log('Navigating to link:', link);

        try {
            // Case 1: Cross-chapter reference with specific chunk
            if (link.chapterNumber !== undefined && link.targetChunk !== undefined) {
                if (link.chapterNumber === currentChapterNumber) {
                    // Same chapter - just navigate to chunk
                    const textChunkIndex = findTextChunkIndex(link.targetChunk);
                    onNavigateToChunk(textChunkIndex);
                } else {
                    // Different chapter - use bookmark navigation pattern
                    const textChunkIndex = findTextChunkIndex(link.targetChunk);
                    onNavigateToBookmark(link.chapterNumber, textChunkIndex);
                }
                return;
            }

            // Case 2: Page reference within current chapter
            if (link.targetPageNumber !== undefined) {
                const targetChunk = findChunkByPage(link.targetPageNumber);
                if (targetChunk) {
                    const textChunkIndex = findTextChunkIndex(targetChunk.index);
                    onNavigateToChunk(textChunkIndex);
                } else {
                    console.warn(`Page ${link.targetPageNumber} not found in current chapter`);
                    // Could implement cross-chapter page search here
                }
                return;
            }

            // Case 3: Chapter reference without specific chunk
            if (link.chapterNumber !== undefined) {
                if (link.chapterNumber !== currentChapterNumber) {
                    onNavigateToChapter(link.chapterNumber);
                }
                return;
            }

            // Case 4: Textual references (try to resolve)
            if (link.targetText) {
                const targetChunk = findChunkByText(link.targetText);
                if (targetChunk) {
                    const textChunkIndex = findTextChunkIndex(targetChunk.index);
                    onNavigateToChunk(textChunkIndex);
                } else {
                    console.warn(`Target text "${link.targetText}" not found in current chapter`);
                }
                return;
            }

            console.warn('Unable to navigate - link target not recognized:', link);

        } catch (error) {
            console.error('Error navigating to link:', error);
        }
    }, [
        currentChapterNumber,
        findChunkByPage,
        findTextChunkIndex,
        onNavigateToChapter,
        onNavigateToChunk,
        onNavigateToBookmark
    ]);

    // Find chunk by searching for text content
    const findChunkByText = useCallback((searchText: string): { index: number; chunk: TextChunkClient } | null => {
        if (!chapter || !searchText) return null;

        const normalizedSearch = searchText.toLowerCase().trim();

        const chunkIndex = chapter.content.chunks.findIndex(chunk =>
            chunk.text && chunk.text.toLowerCase().includes(normalizedSearch)
        );

        if (chunkIndex === -1) return null;

        return {
            index: chunkIndex,
            chunk: chapter.content.chunks[chunkIndex]
        };
    }, [chapter]);

    // Navigate to a specific page number (search across chapter)
    const navigateToPage = useCallback((pageNumber: number) => {
        const targetChunk = findChunkByPage(pageNumber);
        if (targetChunk) {
            const textChunkIndex = findTextChunkIndex(targetChunk.index);
            onNavigateToChunk(textChunkIndex);
            return true;
        }
        return false;
    }, [findChunkByPage, findTextChunkIndex, onNavigateToChunk]);

    // Navigate to a specific chapter and optionally a chunk/page within it
    const navigateToChapterAndLocation = useCallback((
        chapterNumber: number,
        location?: { chunkIndex?: number; pageNumber?: number }
    ) => {
        if (chapterNumber === currentChapterNumber && location) {
            // Same chapter, just navigate to location
            if (location.chunkIndex !== undefined) {
                const textChunkIndex = findTextChunkIndex(location.chunkIndex);
                onNavigateToChunk(textChunkIndex);
            } else if (location.pageNumber !== undefined) {
                navigateToPage(location.pageNumber);
            }
        } else {
            // Different chapter
            if (location?.chunkIndex !== undefined) {
                const textChunkIndex = findTextChunkIndex(location.chunkIndex);
                onNavigateToBookmark(chapterNumber, textChunkIndex);
            } else {
                onNavigateToChapter(chapterNumber);
            }
        }
    }, [
        currentChapterNumber,
        findTextChunkIndex,
        navigateToPage,
        onNavigateToChapter,
        onNavigateToChunk,
        onNavigateToBookmark
    ]);

    return {
        handleLinkNavigation,
        navigateToPage,
        navigateToChapterAndLocation,
        findChunkByPage,
        findChunkByText,
        findTextChunkIndex
    };
}; 