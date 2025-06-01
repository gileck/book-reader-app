// Client-facing DTOs
export interface BookmarkClient {
    _id: string;
    userId: string;
    bookId: string;
    chapterNumber: number;
    chunkIndex: number;
    customName?: string;
    previewText: string;
    createdAt: string;
    updatedAt: string;
}

// Request payloads
export interface CreateBookmarkPayload {
    bookId: string;
    chapterNumber: number;
    chunkIndex: number;
    customName?: string;
    previewText: string;
}

export interface GetBookmarksByBookPayload {
    bookId: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetUserBookmarksPayload {
    // No additional params - uses userId from context
}

export interface UpdateBookmarkPayload {
    customName?: string;
}

export interface DeleteBookmarkPayload {
    bookmarkId: string;
}

export interface ToggleBookmarkPayload {
    bookId: string;
    chapterNumber: number;
    chunkIndex: number;
    customName?: string;
    previewText: string;
}

// Response payloads
export interface CreateBookmarkResponse {
    bookmark: BookmarkClient;
}

export interface GetBookmarksByBookResponse {
    bookmarks: BookmarkClient[];
}

export interface GetUserBookmarksResponse {
    bookmarks: BookmarkClient[];
}

export interface UpdateBookmarkResponse {
    bookmark: BookmarkClient | null;
}

export interface DeleteBookmarkResponse {
    success: boolean;
}

export interface ToggleBookmarkResponse {
    bookmark: BookmarkClient | null;
    action: 'created' | 'deleted';
} 