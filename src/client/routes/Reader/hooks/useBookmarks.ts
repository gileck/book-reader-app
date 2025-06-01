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
    currentChunkIndex: number
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
        if (!chapter) return;

        const currentBookmark = state.bookmarks.find(bookmark =>
            bookmark.chapterNumber === chapter.chapterNumber &&
            bookmark.chunkIndex === currentChunkIndex
        );
        updateState({ isBookmarked: !!currentBookmark });
    }, [state.bookmarks, chapter, currentChunkIndex, updateState]);

    const handleBookmark = useCallback(async () => {
        if (!chapter || !bookId) return;

        const textChunks = chapter.content.chunks.filter(chunk => chunk.type === 'text');
        const currentChunk = textChunks[currentChunkIndex];
        if (!currentChunk) return;

        const previewText = currentChunk.text.substring(0, 100) + (currentChunk.text.length > 100 ? '...' : '');

        try {
            const result = await toggleBookmark({
                bookId,
                chapterNumber: chapter.chapterNumber,
                chunkIndex: currentChunkIndex,
                previewText
            });

            if (result.data) {
                if (result.data.action === 'created' && result.data.bookmark) {
                    updateState({
                        bookmarks: [...state.bookmarks, result.data.bookmark],
                        isBookmarked: true
                    });
                } else if (result.data.action === 'deleted') {
                    updateState({
                        bookmarks: state.bookmarks.filter(bookmark =>
                            !(bookmark.chapterNumber === chapter.chapterNumber &&
                                bookmark.chunkIndex === currentChunkIndex)
                        ),
                        isBookmarked: false
                    });
                }
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    }, [chapter, bookId, currentChunkIndex, state.bookmarks, updateState]);

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
        isChunkBookmarked
    };
}; 