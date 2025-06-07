import { ObjectId } from 'mongodb';

export interface ReadingLog {
    _id: ObjectId;
    userId: ObjectId;
    bookId: ObjectId;
    chapterNumber: number;
    chunkIndex: number;
    chunkText: string;
    timestamp: Date;
}

export type ReadingLogCreate = Omit<ReadingLog, '_id'>;

export interface ReadingLogFilter {
    _id?: ObjectId;
    userId?: ObjectId;
    bookId?: ObjectId;
    chapterNumber?: number;
    timestamp?: {
        $gte?: Date;
        $lte?: Date;
    };
} 