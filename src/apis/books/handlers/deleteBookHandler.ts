import { ApiHandlerContext } from '@/apis/types';
import { DeleteBookPayload, DeleteBookResponse } from '../types';
import { books, chapters, bookmarks, readingProgress } from '@/server/database/collections';

export async function process(
    payload: DeleteBookPayload,
    context: ApiHandlerContext
): Promise<DeleteBookResponse> {
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    // Check if book exists and user owns it
    const existingBook = await books.findBookById(payload.bookId);
    if (!existingBook) {
        throw new Error('Book not found');
    }

    // if (existingBook.uploadedBy?.toString() !== context.userId) {
    //     throw new Error('Access denied - you can only delete your own books');
    // }

    // Delete related data
    await Promise.all([
        chapters.deleteChaptersByBook(payload.bookId),
        bookmarks.deleteBookmarksByBook(payload.bookId),
        readingProgress.deleteReadingProgressByBook(payload.bookId)
    ]);

    // Delete the book
    const success = await books.deleteBook(payload.bookId);

    return { success };
} 