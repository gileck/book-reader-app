import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { ReadingLog, ReadingLogCreate } from './types';
import { findBookById } from '../books';
import { findChapterByBookAndNumber } from '../chapters';

const getCollection = async (): Promise<Collection<ReadingLog>> => {
    const db = await getDb();
    return db.collection('readingLogs');
};

export const createReadingLog = async (logData: ReadingLogCreate): Promise<ReadingLog> => {
    const collection = await getCollection();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.insertOne(logData as any);

    const createdLog = await collection.findOne({ _id: result.insertedId });
    if (!createdLog) {
        throw new Error('Failed to create reading log');
    }
    return createdLog;
};

export const findReadingLogsByUser = async (
    userId: ObjectId | string,
    limit?: number,
    offset?: number
): Promise<ReadingLog[]> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    let query = collection.find({ userId: userObjectId }).sort({ timestamp: -1 });

    if (offset) {
        query = query.skip(offset);
    }

    if (limit) {
        query = query.limit(limit);
    }

    return query.toArray();
};

export const groupLogsIntoSessions = async (
    userId: ObjectId | string,
    sessionGapMinutes: number = 5
): Promise<{
    sessionId: string;
    bookId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    totalLines: number;
    logs: ReadingLog[];
}[]> => {
    const logs = await findReadingLogsByUser(userId);

    if (logs.length === 0) {
        return [];
    }

    const sessions: {
        sessionId: string;
        bookId: string;
        bookTitle: string;
        chapterNumber: number;
        chapterTitle: string;
        startTime: Date;
        endTime: Date;
        duration: number;
        totalLines: number;
        logs: ReadingLog[];
    }[] = [];

    let currentSession: ReadingLog[] = [];

    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];

        if (currentSession.length === 0) {
            // Start new session
            currentSession = [log];
        } else {
            const lastLog = currentSession[currentSession.length - 1];
            const timeDiff = Math.abs(lastLog.timestamp.getTime() - log.timestamp.getTime()) / (1000 * 60);

            if (timeDiff <= sessionGapMinutes) {
                // Continue current session
                currentSession.push(log);
            } else {
                // Finish current session and start new one
                if (currentSession.length > 0) {
                    const session = await createSessionFromLogs(currentSession);
                    if (session) {
                        sessions.push(session);
                    }
                }
                currentSession = [log];
            }
        }
    }

    // Don't forget the last session
    if (currentSession.length > 0) {
        const session = await createSessionFromLogs(currentSession);
        if (session) {
            sessions.push(session);
        }
    }

    return sessions;
};

const createSessionFromLogs = async (logs: ReadingLog[]): Promise<{
    sessionId: string;
    bookId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    totalLines: number;
    logs: ReadingLog[];
} | null> => {
    if (logs.length === 0) return null;

    const firstLog = logs[logs.length - 1]; // logs are sorted newest first
    const lastLog = logs[0];

    try {
        // Get book info
        const book = await findBookById(firstLog.bookId);
        if (!book) return null;

        // Get chapter info
        const chapter = await findChapterByBookAndNumber(firstLog.bookId, firstLog.chapterNumber);
        if (!chapter) return null;

        const startTime = firstLog.timestamp;
        const endTime = lastLog.timestamp;
        const duration = Math.abs(endTime.getTime() - startTime.getTime()) / (1000 * 60); // in minutes

        return {
            sessionId: `${firstLog.userId.toString()}-${startTime.getTime()}`,
            bookId: firstLog.bookId.toString(),
            bookTitle: book.title,
            chapterNumber: firstLog.chapterNumber,
            chapterTitle: chapter.title,
            startTime,
            endTime,
            duration,
            totalLines: logs.length,
            logs
        };
    } catch (error) {
        console.error('Error creating session from logs:', error);
        return null;
    }
}; 