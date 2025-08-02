import { ObjectId } from 'mongodb';

// Updated to match client-side ChunkLink interface for parser v2 compatibility
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

export interface TextChunk {
    index: number;                   // Array position (0, 1, 2, 3...) - used for everything
    text: string;                    // Client field (mapped from 'content')
    content?: string;                // Database field name  
    wordCount: number;
    type: 'text' | 'image' | 'header';
    pageNumber?: number;
    sentenceCount?: number;          // New field for parser v2
    paragraphIndex?: number;         // New field for parser v2 - groups sentences into paragraphs
    imageName?: string;
    imageAlt?: string;
    links?: ChunkLink[];             // Updated to use ChunkLink interface
}

export interface ChapterContent {
    chunks: TextChunk[];
}

export interface Chapter {
    _id: ObjectId;
    bookId: ObjectId;
    chapterNumber: number;
    title: string;
    content: ChapterContent;
    wordCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export type ChapterCreate = Omit<Chapter, '_id'>;

export type ChapterUpdate = Partial<Omit<Chapter, '_id' | 'bookId' | 'chapterNumber' | 'createdAt'>> & {
    updatedAt: Date;
};

export interface ChapterFilter {
    _id?: ObjectId;
    bookId?: ObjectId;
    chapterNumber?: number;
} 