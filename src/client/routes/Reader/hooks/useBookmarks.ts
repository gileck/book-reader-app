import { useState, useEffect, useCallback } from 'react';
import { toggleBookmark, getBookmarksByBook } from '../../../../apis/bookmarks/client';
import type { BookmarkClient } from '../../../../apis/bookmarks/types';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface BookmarksState {
    bookmarks: BookmarkClient[];
    isBookmarked: boolean;
}

const getDefaultBookmarksState = (): BookmarksState => ({
    bookmarks: [],
    isBookmarked: false
});

export const useBookmarks = (
    bookId: string | undefined,
    chapter: ChapterClient | null,
    currentChunkIndex: number | null
) => {
    const [state, setState] = useState(getDefaultBookmarksState());

    const updateState = useCallback((partialState: Partial<BookmarksState>) => {
        setState(prev => ({ ...prev, ...partialState }));
    }, []);

    // Load bookmarks on mount
    useEffect(() => {
        const loadBookmarks = async () => {
            if (!bookId) return;

            try {
                const bookmarksResult = await getBookmarksByBook({ bookId });
                if (bookmarksResult.data?.bookmarks) {
                    updateState({ bookmarks: bookmarksResult.data.bookmarks });
                }
            } catch (error) {
                console.error('Error loading bookmarks:', error);
            }
        };

        loadBookmarks();
    }, [bookId, updateState]);

    // Check if current position is bookmarked
    useEffect(() => {
        if (!chapter || currentChunkIndex === null) {
            updateState({ isBookmarked: false });
            return;
        }

        const currentBookmark = state.bookmarks.find(bookmark =>
            bookmark.chapterNumber === chapter.chapterNumber &&
            bookmark.chunkIndex === currentChunkIndex
        );
        updateState({ isBookmarked: !!currentBookmark });
    }, [state.bookmarks, chapter, currentChunkIndex, updateState]);

    // Helper function to calculate sentence index within paragraph for Parser v2
    const calculateSentenceIndexInParagraph = useCallback((chunkIndex: number): number | undefined => {
        if (!chapter) return undefined;

        const textChunks = chapter.content.chunks.filter(chunk => chunk.type === 'text');
        const currentChunk = textChunks[chunkIndex];
        if (!currentChunk || currentChunk.paragraphIndex === undefined) return undefined;

        // Count sentences in the same paragraph that come before this chunk
        let sentenceIndex = 0;
        for (let i = 0; i < chunkIndex; i++) {
            const chunk = textChunks[i];
            if (chunk.paragraphIndex === currentChunk.paragraphIndex) {
                sentenceIndex++;
            }
        }

        return sentenceIndex;
    }, [chapter]);

    /**
     * Toggle bookmark at a specific chunk index
     * 
     * This function takes the chunk index as a parameter to avoid stale closure issues
     * when called from setTimeout or async callbacks.
     * 
     * @param chunkIndex - The chunk index to bookmark (required to avoid stale closure)
     */
    const handleBookmarkAtIndex = useCallback(async (chunkIndex: number) => {
        if (!chapter || !bookId) return;

        const textChunks = chapter.content.chunks.filter(chunk => chunk.type === 'text');
        const targetChunk = textChunks[chunkIndex];
        if (!targetChunk) return;

        const previewText = targetChunk.text.substring(0, 100) + (targetChunk.text.length > 100 ? '...' : '');

        // Enhanced bookmark creation with paragraph context (Parser v2)
        const paragraphIndex = targetChunk.paragraphIndex;
        const sentenceIndex = calculateSentenceIndexInParagraph(chunkIndex);

        try {
            const result = await toggleBookmark({
                bookId,
                chapterNumber: chapter.chapterNumber,
                chunkIndex: chunkIndex,
                paragraphIndex,
                sentenceIndex,
                previewText
            });

            if (result.data) {
                if (result.data.action === 'created' && result.data.bookmark) {
                    updateState({
                        bookmarks: [...state.bookmarks, result.data.bookmark],
                        isBookmarked: chunkIndex === currentChunkIndex
                    });
                } else if (result.data.action === 'deleted') {
                    updateState({
                        bookmarks: state.bookmarks.filter(bookmark =>
                            !(bookmark.chapterNumber === chapter.chapterNumber &&
                                bookmark.chunkIndex === chunkIndex)
                        ),
                        isBookmarked: chunkIndex === currentChunkIndex ? false : state.isBookmarked
                    });
                }
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    }, [chapter, bookId, currentChunkIndex, state.bookmarks, state.isBookmarked, updateState, calculateSentenceIndexInParagraph]);

    /**
     * Toggle bookmark at the current chunk index
     * 
     * Note: For use in setTimeout/async callbacks, prefer handleBookmarkAtIndex()
     * to avoid stale closure issues.
     */
    const handleBookmark = useCallback(async () => {
        if (currentChunkIndex === null) return;
        return handleBookmarkAtIndex(currentChunkIndex);
    }, [currentChunkIndex, handleBookmarkAtIndex]);

    const isChunkBookmarked = useCallback((chunkIndex: number) => {
        if (!chapter) return false;
        return state.bookmarks.some(bookmark =>
            bookmark.chapterNumber === chapter.chapterNumber &&
            bookmark.chunkIndex === chunkIndex
        );
    }, [chapter, state.bookmarks]);

    return {
        bookmarks: state.bookmarks,
        isBookmarked: state.isBookmarked,
        handleBookmark,
        handleBookmarkAtIndex,
        isChunkBookmarked
    };
}; 