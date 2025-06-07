import { ObjectId } from 'mongodb';
import { ApiHandlerContext } from '@/apis/types';
import { CreateBookPayload, CreateBookResponse, BookClient } from '../types';
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
    payload: CreateBookPayload,
    context: ApiHandlerContext
): Promise<CreateBookResponse> {
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    const now = new Date();
    const bookData = {
        ...payload,
        uploadedBy: new ObjectId(context.userId),
        createdAt: now,
        updatedAt: now
    };

    const book = await books.createBook(bookData);

    return {
        book: convertBookToClient(book)
    };
} 