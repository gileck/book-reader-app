
import { ApiHandlerContext } from '@/apis/types';
import { UpdateBookPayload, UpdateBookResponse, BookClient } from '../types';
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
        imageBaseURL: book.imageBaseURL,
        createdAt: book.createdAt.toISOString(),
        updatedAt: book.updatedAt.toISOString(),
        isPublic: book.isPublic,
        uploadedBy: book.uploadedBy?.toString()
    };
}

export async function process(
    payload: UpdateBookPayload & { bookId: string },
    context: ApiHandlerContext
): Promise<UpdateBookResponse> {
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    // Check if book exists and user owns it
    const existingBook = await books.findBookById(payload.bookId);
    if (!existingBook) {
        throw new Error('Book not found');
    }

    // if (existingBook.uploadedBy?.toString() !== context.userId) {
    //     throw new Error('Access denied - you can only update your own books');
    // }

    const updateData = {
        ...payload,
        updatedAt: new Date()
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (updateData as any).bookId;

    const updatedBook = await books.updateBook(payload.bookId, updateData);

    if (!updatedBook) {
        return { book: null };
    }

    return {
        book: convertBookToClient(updatedBook)
    };
} 