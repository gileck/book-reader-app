import { findChapterByBookAndNumber } from '../../../server/database/collections/chapters';
import type { GetChapterByBookAndNumberPayload, GetChapterResponse } from '../types';

export async function process(
    params: GetChapterByBookAndNumberPayload
): Promise<GetChapterResponse> {
    try {
        const { bookId, chapterNumber } = params;

        if (!bookId) {
            throw new Error('Book ID is required');
        }

        // Handle null/undefined chapterNumber - default to chapter 1
        let finalChapterNumber = chapterNumber;
        if (chapterNumber === null || chapterNumber === undefined) {
            console.warn('Received null/undefined chapterNumber, defaulting to 1', {
                bookId,
                originalChapterNumber: chapterNumber
            });
            finalChapterNumber = 1;
        }

        const chapter = await findChapterByBookAndNumber(bookId, finalChapterNumber);

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