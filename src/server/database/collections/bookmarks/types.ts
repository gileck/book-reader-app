import { ObjectId } from 'mongodb';

export interface Bookmark {
    _id: ObjectId;
    userId: ObjectId;
    bookId: ObjectId;
    chapterNumber: number;
    chunkIndex: number;
    customName?: string;
    previewText: string;
    createdAt: Date;
    updatedAt: Date;
}

export type BookmarkCreate = Omit<Bookmark, '_id'>;

export type BookmarkUpdate = Partial<Omit<Bookmark, '_id' | 'userId' | 'bookId' | 'createdAt'>> & {
    updatedAt: Date;
};

export interface BookmarkFilter {
    _id?: ObjectId;
    userId?: ObjectId;
    bookId?: ObjectId;
    chapterNumber?: number;
    chunkIndex?: number;
} 