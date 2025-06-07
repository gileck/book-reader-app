

// Client-facing DTOs (database types converted for client consumption)
export interface BookClient {
    _id: string;
    title: string;
    author?: string;
    description?: string;
    coverImage?: string;
    totalChapters: number;
    totalWords: number;
    language: string;
    imageBaseURL?: string;
    createdAt: string;
    updatedAt: string;
    isPublic: boolean;
    uploadedBy?: string;
}

// Request payloads
export interface CreateBookPayload {
    title: string;
    author?: string;
    description?: string;
    coverImage?: string;
    totalChapters: number;
    totalWords: number;
    language: string;
    isPublic: boolean;
}

export interface UpdateBookPayload {
    title?: string;
    author?: string;
    description?: string;
    coverImage?: string;
    totalChapters?: number;
    totalWords?: number;
    language?: string;
    isPublic?: boolean;
}

export interface GetBookPayload {
    bookId: string;
}

export interface GetBooksPayload {
    limit?: number;
    uploadedByUser?: boolean;
    publicOnly?: boolean;
}

export interface SearchBooksPayload {
    searchTerm: string;
    limit?: number;
}

export interface DeleteBookPayload {
    bookId: string;
}

// Response payloads
export interface CreateBookResponse {
    book: BookClient;
}

export interface GetBookResponse {
    book: BookClient | null;
}

export interface GetBooksResponse {
    books: BookClient[];
}

export interface UpdateBookResponse {
    book: BookClient | null;
}

export interface SearchBooksResponse {
    books: BookClient[];
}

export interface DeleteBookResponse {
    success: boolean;
} 