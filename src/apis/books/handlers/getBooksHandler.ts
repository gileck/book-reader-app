
import { ApiHandlerContext } from '@/apis/types';
import { GetBooksPayload, GetBooksResponse, BookClient } from '../types';
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
    payload: GetBooksPayload,
    context: ApiHandlerContext
): Promise<GetBooksResponse> {
    const limit = payload.limit || 50;

    let bookList;

    if (payload.uploadedByUser && context.userId) {
        // Get books uploaded by current user
        bookList = await books.findBooksByUser(context.userId);
    } else if (payload.publicOnly) {
        // Get only public books
        bookList = await books.findPublicBooks(limit);
    } else {
        // Get all accessible books (public + user's own)
        if (context.userId) {
            const publicBooks = await books.findPublicBooks(limit);
            const userBooks = await books.findBooksByUser(context.userId);

            // Combine and deduplicate
            const bookMap = new Map();
            [...publicBooks, ...userBooks].forEach(book => {
                bookMap.set(book._id.toString(), book);
            });
            bookList = Array.from(bookMap.values()).slice(0, limit);
        } else {
            bookList = await books.findPublicBooks(limit);
        }
    }

    return {
        books: bookList.map(convertBookToClient)
    };
} 