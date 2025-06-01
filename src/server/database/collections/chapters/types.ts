import { ObjectId } from 'mongodb';

export interface TextChunk {
    index: number;
    text: string;
    wordCount: number;
    type: 'text' | 'image';
    imageUrl?: string;
    imageAlt?: string;
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