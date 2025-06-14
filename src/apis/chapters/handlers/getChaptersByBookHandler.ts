import { findChaptersByBook } from '../../../server/database/collections/chapters';
import type { GetChaptersByBookPayload, GetChaptersByBookResponse } from '../types';

export async function process(
    params: GetChaptersByBookPayload
): Promise<GetChaptersByBookResponse> {
    try {
        const { bookId } = params;

        if (!bookId) {
            throw new Error('Book ID is required');
        }

        const chapters = await findChaptersByBook(bookId);

        return {
            chapters: chapters.map(chapter => ({
                _id: chapter._id.toString(),
                bookId: chapter.bookId.toString(),
                chapterNumber: chapter.chapterNumber,
                title: chapter.title,
                content: chapter.content,
                wordCount: chapter.wordCount,
                createdAt: chapter.createdAt.toISOString(),
                updatedAt: chapter.updatedAt.toISOString()
            }))
        };
    } catch (error) {
        console.error('Get chapters by book error:', error);
        throw error;
    }
} 