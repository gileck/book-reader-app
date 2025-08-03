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

    // REMOVED: findTextChunkIndex - no longer needed!
    // We now use absolute chunk indexes directly, eliminating expensive conversion

    // Handle navigation to a specific link target (DRAMATICALLY SIMPLIFIED with Step 5.1)
    const handleLinkNavigation = useCallback(async (link: ChunkLink) => {

        try {
            // 🚀 FAST PATH: Direct chunk array index reference (Step 5.1)
            const targetChunkIndex = link.role === 'source' ? link.targetChunkIndex : link.sourceChunkIndex;
            if (targetChunkIndex !== undefined) {

                // Handle cross-chapter navigation if chapter number is provided
                if (link.chapterNumber !== undefined && link.chapterNumber !== currentChapterNumber) {
                    onNavigateToBookmark(link.chapterNumber, targetChunkIndex);
                } else {
                    // Same chapter - navigate directly using chunk array index
                    onNavigateToChunk(targetChunkIndex);
                }
                return;
            }

            // LEGACY PATH: v1 compatibility - Cross-chapter reference with specific chunk
            if (link.chapterNumber !== undefined && link.targetChunk !== undefined) {
                if (link.chapterNumber === currentChapterNumber) {
                    onNavigateToChunk(link.targetChunk);
                } else {
                    onNavigateToBookmark(link.chapterNumber, link.targetChunk);
                }
                return;
            }

            // SLOW FALLBACK: Page reference within current chapter
            if (link.targetPageNumber !== undefined) {
                const targetChunk = findChunkByPage(link.targetPageNumber);
                if (targetChunk) {
                    onNavigateToChunk(targetChunk.index);
                } else {
                    console.warn(`Page ${link.targetPageNumber} not found in current chapter`);
                }
                return;
            }

            // SLOW FALLBACK: Chapter reference without specific chunk
            if (link.chapterNumber !== undefined) {
                if (link.chapterNumber !== currentChapterNumber) {
                    onNavigateToChapter(link.chapterNumber);
                }
                return;
            }

            // SLOWEST FALLBACK: Text-based search
            if (link.targetText) {
                console.log('🔍 Text-based navigation (slowest):', link.targetText);
                const targetChunk = findChunkByText(link.targetText);
                if (targetChunk) {
                    onNavigateToChunk(targetChunk.index);
                } else {
                    console.warn(`Target text "${link.targetText}" not found in current chapter`);
                }
                return;
            }

            console.warn('⚠️ Unable to navigate - no valid target found:', link);

        } catch (error) {
            console.error('❌ Error navigating to link:', error);
        }
    }, [
        currentChapterNumber,
        findChunkByPage,
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
            onNavigateToChunk(targetChunk.index);
            return true;
        }
        return false;
    }, [findChunkByPage, onNavigateToChunk]);

    // Navigate to a specific chapter and optionally a chunk/page within it
    const navigateToChapterAndLocation = useCallback((
        chapterNumber: number,
        location?: { chunkIndex?: number; pageNumber?: number }
    ) => {
        if (chapterNumber === currentChapterNumber && location) {
            // Same chapter, just navigate to location
            if (location.chunkIndex !== undefined) {
                onNavigateToChunk(location.chunkIndex);
            } else if (location.pageNumber !== undefined) {
                navigateToPage(location.pageNumber);
            }
        } else {
            // Different chapter
            if (location?.chunkIndex !== undefined) {
                onNavigateToBookmark(chapterNumber, location.chunkIndex);
            } else {
                onNavigateToChapter(chapterNumber);
            }
        }
    }, [
        currentChapterNumber,
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
        findChunkByText
    };
}; 