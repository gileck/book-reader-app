import { findChapterByBookAndNumber } from '../../../server/database/collections/chapters';
import type { SearchCurrentChapterPayload, SearchCurrentChapterResponse, SearchResultItem } from '../types';

export async function process(
    params: SearchCurrentChapterPayload
): Promise<SearchCurrentChapterResponse> {
    try {
        const { bookId, chapterNumber, query } = params;

        if (!bookId) {
            throw new Error('Book ID is required');
        }

        if (!query || !query.trim()) {
            throw new Error('Search query is required');
        }

        if (chapterNumber === null || chapterNumber === undefined) {
            throw new Error('Chapter number is required');
        }

        // Fetch the chapter
        const chapter = await findChapterByBookAndNumber(bookId, chapterNumber);

        if (!chapter) {
            throw new Error(`Chapter ${chapterNumber} not found`);
        }

        // Search chunks in this chapter
        const lowerQuery = query.toLowerCase();
        const results: SearchResultItem[] = [];

        for (const chunk of chapter.content.chunks) {
            // Only search text and header chunks
            if ((chunk.type === 'text' || chunk.type === 'header') &&
                chunk.text.toLowerCase().includes(lowerQuery)) {
                
                results.push({
                    chunkIndex: chunk.index,
                    text: chunk.text,
                    type: chunk.type,
                    chapterNumber: chapter.chapterNumber,
                    chapterTitle: chapter.title
                });
            }
        }

        return {
            results
        };
    } catch (error) {
        console.error('Search current chapter error:', error);
        throw error;
    }
}

