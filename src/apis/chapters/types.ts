// Client-facing DTOs
export interface ChunkLink {
    text: string;                    // Link text as it appears in content
    targetPageNumber?: number;       // PDF page number target
    targetText?: string;             // Target content context
    linkId: string;                  // Unique link identifier
    role: 'source' | 'target';       // Link role in relationship

    // Step 5.1 direct chunk array indexes for fast navigation
    targetChunkIndex?: number;       // Direct array index to target chunk (e.g., 15, 23)
    sourceChunkIndex?: number;       // Direct array index to source chunk (e.g., 8, 12)

    // LEGACY: Deprecated fields (still supported for v1 compatibility)
    targetChunk?: number;            // Target chunk index (if resolved) - same as targetChunkIndex
    chapterNumber?: number;          // Target chapter (if cross-chapter link)
}

export interface TextChunkClient {
    index: number;                   // Array position (0, 1, 2, 3...) - used for everything
    text: string;
    wordCount: number;
    type: 'text' | 'image' | 'header';
    pageNumber?: number;
    sentenceCount?: number;          // New field for parser v2
    paragraphIndex?: number;         // New field for parser v2 - groups sentences into paragraphs
    imageName?: string;
    imageAlt?: string;
    links?: ChunkLink[];             // New field for advanced link detection (parser v2)
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