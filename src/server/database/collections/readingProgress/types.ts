import { ObjectId } from 'mongodb';

export interface ReadingSession {
    startTime: Date;
    endTime: Date;
    chaptersRead: number[];
    wordsRead: number;
}

export interface ReadingProgress {
    _id: ObjectId;
    userId: ObjectId;
    bookId: ObjectId;
    currentChapter: number;
    currentChunk: number;
    totalChaptersRead: number;
    totalWordsRead: number;
    totalReadingTimeMinutes?: number; // Total reading time in minutes
    lastReadAt: Date;
    createdAt: Date;
    updatedAt: Date;
    sessionHistory: ReadingSession[];
}

export type ReadingProgressCreate = Omit<ReadingProgress, '_id' | 'createdAt' | 'updatedAt'> & {
    createdAt: Date;
    updatedAt: Date;
};

export type ReadingProgressUpdate = Partial<Omit<ReadingProgress, '_id' | 'userId' | 'bookId' | 'createdAt'>> & {
    updatedAt: Date;
};

export interface ReadingProgressFilter {
    _id?: ObjectId;
    userId?: ObjectId;
    bookId?: ObjectId;
} 