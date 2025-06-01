import { SearchBooksPayload, SearchBooksResponse, BookClient } from '../types';
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
    payload: SearchBooksPayload
): Promise<SearchBooksResponse> {
    const limit = payload.limit || 20;

    const searchResults = await books.searchBooks(payload.searchTerm, limit);

    return {
        books: searchResults.map(convertBookToClient)
    };
} 