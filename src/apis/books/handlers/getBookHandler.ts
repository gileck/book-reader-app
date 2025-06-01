
import { ApiHandlerContext } from '@/apis/types';
import { GetBookPayload, GetBookResponse, BookClient } from '../types';
import { books } from '@/server/database/collections';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertBookToClient(book: any): BookClient {
    return {
        _id: book._id.toString(),
        title: book.title,
        author: book.author,
        description: book.description,
        coverImage: book.coverImage,
        totalChapters: book.totalChapters,
        totalWords: book.totalWords,
        language: book.language,
        createdAt: book.createdAt.toISOString(),
        updatedAt: book.updatedAt.toISOString(),
        isPublic: book.isPublic,
        uploadedBy: book.uploadedBy?.toString()
    };
}

export async function process(
    payload: GetBookPayload,
    context: ApiHandlerContext
): Promise<GetBookResponse> {
    const book = await books.findBookById(payload.bookId);

    if (!book) {
        return { book: null };
    }

    // Check if user can access this book
    if (!book.isPublic && book.uploadedBy?.toString() !== context.userId) {
        throw new Error('Access denied');
    }

    return {
        book: convertBookToClient(book)
    };
} 