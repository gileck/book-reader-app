import { ObjectId } from 'mongodb';

export interface Book {
    _id: ObjectId;
    title: string;
    author?: string;
    description?: string;
    coverImage?: string;
    totalChapters: number;
    totalWords: number;
    language: string;
    imageBaseURL?: string;
    createdAt: Date;
    updatedAt: Date;
    isPublic: boolean;
    uploadedBy?: ObjectId;
    chapterStartNumber: number;
}

export type BookCreate = Omit<Book, '_id'>;

export type BookUpdate = Partial<Omit<Book, '_id' | 'createdAt'>> & {
    updatedAt: Date;
};

export interface BookFilter {
    _id?: ObjectId;
    title?: string | RegExp;
    author?: string | RegExp;
    isPublic?: boolean;
    uploadedBy?: ObjectId;
} 