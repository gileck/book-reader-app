// Client-facing DTOs for search functionality

export interface SearchCurrentChapterPayload {
    bookId: string;
    chapterNumber: number;
    query: string;
}

export interface SearchAllChaptersPayload {
    bookId: string;
    query: string;
}

export interface SearchResultItem {
    chunkIndex: number;
    text: string;
    type: 'text' | 'header';
    chapterNumber: number;
    chapterTitle: string;
}

export interface SearchCurrentChapterResponse {
    results: SearchResultItem[];
}

// For streaming API - individual SSE events
export interface SearchChapterEvent {
    type: 'chapter-start' | 'results' | 'complete' | 'error';
    chapterNumber?: number;
    chapterTitle?: string;
    results?: SearchResultItem[];
    totalChapters?: number;
    searchedChapters?: number;
    error?: string;
}

