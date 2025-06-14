import { findChapterByBookAndNumber } from '../../../server/database/collections/chapters';
import type { GetChapterByBookAndNumberPayload, GetChapterResponse } from '../types';

export async function process(
    params: GetChapterByBookAndNumberPayload
): Promise<GetChapterResponse> {
    try {
        const { bookId, chapterNumber } = params;

        if (!bookId || chapterNumber === undefined) {
            throw new Error('Book ID and chapter number are required');
        }

        const chapter = await findChapterByBookAndNumber(bookId, chapterNumber);

        return {
            chapter: chapter ? {
                _id: chapter._id.toString(),
                bookId: chapter.bookId.toString(),
                chapterNumber: chapter.chapterNumber,
                title: chapter.title,
                content: chapter.content,
                wordCount: chapter.wordCount,
                createdAt: chapter.createdAt.toISOString(),
                updatedAt: chapter.updatedAt.toISOString()
            } : null
        };
    } catch (error) {
        console.error('Get chapter by number error:', error);
        throw error;
    }
} 