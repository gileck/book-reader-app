// Client-facing DTOs
export interface TextChunkClient {
    index: number;
    text: string;
    wordCount: number;
    type: 'text' | 'image';
    imageUrl?: string;
    imageAlt?: string;
}

export interface ChapterContentClient {
    chunks: TextChunkClient[];
}

export interface ChapterClient {
    _id: string;
    bookId: string;
    chapterNumber: number;
    title: string;
    content: ChapterContentClient;
    wordCount: number;
    createdAt: string;
    updatedAt: string;
}

// Request payloads
export interface CreateChapterPayload {
    bookId: string;
    chapterNumber: number;
    title: string;
    content: ChapterContentClient;
    wordCount: number;
}

export interface GetChapterPayload {
    chapterId: string;
}

export interface GetChapterByBookAndNumberPayload {
    bookId: string;
    chapterNumber: number;
}

export interface GetChaptersByBookPayload {
    bookId: string;
}

export interface UpdateChapterPayload {
    title?: string;
    content?: ChapterContentClient;
    wordCount?: number;
}

export interface DeleteChapterPayload {
    chapterId: string;
}

// Response payloads
export interface CreateChapterResponse {
    chapter: ChapterClient;
}

export interface GetChapterResponse {
    chapter: ChapterClient | null;
}

export interface GetChaptersByBookResponse {
    chapters: ChapterClient[];
}

export interface UpdateChapterResponse {
    chapter: ChapterClient | null;
}

export interface DeleteChapterResponse {
    success: boolean;
} 