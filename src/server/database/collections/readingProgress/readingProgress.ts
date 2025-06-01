import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { ReadingProgress, ReadingProgressCreate, ReadingProgressUpdate, ReadingSession } from './types';
import { findBookById } from '../books';
import { findChaptersByBook } from '../chapters';

const getCollection = async (): Promise<Collection<ReadingProgress>> => {
    const db = await getDb();
    return db.collection('readingProgress');
};

export const createReadingProgress = async (progressData: ReadingProgressCreate): Promise<ReadingProgress> => {
    const collection = await getCollection();

    // Check if progress already exists for this user-book combination
    const existing = await collection.findOne({
        userId: progressData.userId,
        bookId: progressData.bookId
    });

    if (existing) {
        throw new Error('Reading progress already exists for this user-book combination');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.insertOne(progressData as any);

    const createdProgress = await collection.findOne({ _id: result.insertedId });
    if (!createdProgress) {
        throw new Error('Failed to create reading progress');
    }
    return createdProgress;
};

export const findReadingProgressById = async (id: ObjectId | string): Promise<ReadingProgress | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await collection.findOne({ _id: objectId });
};

export const findReadingProgressByUserAndBook = async (
    userId: ObjectId | string,
    bookId: ObjectId | string
): Promise<ReadingProgress | null> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const bookObjectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    return await collection.findOne({
        userId: userObjectId,
        bookId: bookObjectId
    });
};

export const findReadingProgressByUser = async (userId: ObjectId | string): Promise<ReadingProgress[]> => {
    const collection = await getCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await collection.find({ userId: objectId }).sort({ lastReadAt: -1 }).toArray();
};

export const updateReadingProgress = async (
    id: ObjectId | string,
    update: ReadingProgressUpdate
): Promise<ReadingProgress | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

export const updateReadingPosition = async (
    userId: ObjectId | string,
    bookId: ObjectId | string,
    currentChapter: number,
    currentChunk: number,
    wordsRead?: number,
    sessionTimeMinutes?: number
): Promise<ReadingProgress | null> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const bookObjectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
        currentChapter,
        currentChunk,
        lastReadAt: new Date(),
        updatedAt: new Date()
    };

    if (wordsRead !== undefined) {
        update.$inc = { totalWordsRead: wordsRead };
    }

    // Add session time tracking
    if (sessionTimeMinutes !== undefined && sessionTimeMinutes > 0) {
        update.$inc = update.$inc || {};
        update.$inc.totalReadingTimeMinutes = sessionTimeMinutes;
    }

    const result = await collection.findOneAndUpdate(
        { userId: userObjectId, bookId: bookObjectId },
        { $set: update },
        { returnDocument: 'after', upsert: true }
    );

    return result || null;
};

export const addReadingSession = async (
    userId: ObjectId | string,
    bookId: ObjectId | string,
    session: ReadingSession
): Promise<ReadingProgress | null> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const bookObjectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    const result = await collection.findOneAndUpdate(
        { userId: userObjectId, bookId: bookObjectId },
        {
            $push: { sessionHistory: session },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    return result || null;
};

export const deleteReadingProgress = async (id: ObjectId | string): Promise<boolean> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount === 1;
};

export const deleteReadingProgressByBook = async (bookId: ObjectId | string): Promise<number> => {
    const collection = await getCollection();
    const objectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    const result = await collection.deleteMany({ bookId: objectId });
    return result.deletedCount;
};

/**
 * Calculate book-wide progress based on current reading position
 */
export const calculateBookProgress = async (
    bookId: ObjectId | string,
    currentChapter: number,
    currentChunk: number
): Promise<{ bookProgress: number; chapterProgress: number; chaptersCompleted: number }> => {
    try {
        const bookObjectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

        // Get all chapters for this book
        const chapters = await findChaptersByBook(bookObjectId);
        if (chapters.length === 0) {
            return { bookProgress: 0, chapterProgress: 0, chaptersCompleted: 0 };
        }

        // Find current chapter
        const currentChapterData = chapters.find(ch => ch.chapterNumber === currentChapter);
        if (!currentChapterData) {
            return { bookProgress: 0, chapterProgress: 0, chaptersCompleted: 0 };
        }

        // Calculate chapter progress
        const totalChunksInChapter = currentChapterData.content.chunks.length;
        const chapterProgress = totalChunksInChapter > 0
            ? Math.round((currentChunk / totalChunksInChapter) * 100)
            : 0;

        // Calculate total words read so far
        let totalWordsRead = 0;

        // Add words from completed chapters
        for (const chapter of chapters) {
            if (chapter.chapterNumber < currentChapter) {
                totalWordsRead += chapter.wordCount;
            } else if (chapter.chapterNumber === currentChapter) {
                // Add words from completed chunks in current chapter
                for (let i = 0; i < currentChunk && i < chapter.content.chunks.length; i++) {
                    totalWordsRead += chapter.content.chunks[i].wordCount;
                }
            }
        }

        // Calculate total words in book
        const totalWordsInBook = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

        // Calculate book progress
        const bookProgress = totalWordsInBook > 0
            ? Math.round((totalWordsRead / totalWordsInBook) * 100)
            : 0;

        // Count completed chapters
        const chaptersCompleted = chapters.filter(ch => ch.chapterNumber < currentChapter).length;

        return { bookProgress, chapterProgress, chaptersCompleted };
    } catch (error) {
        console.error('Error calculating book progress:', error);
        return { bookProgress: 0, chapterProgress: 0, chaptersCompleted: 0 };
    }
};

/**
 * Get comprehensive reading statistics for a user and book
 */
export const getReadingStats = async (
    userId: ObjectId | string,
    bookId: ObjectId | string
): Promise<{
    bookProgress: number;
    chapterProgress: number;
    totalReadingTime: number;
    currentSessionTime: number;
    sessionsCount: number;
    chaptersCompleted: number;
    totalChapters: number;
    estimatedTimeRemaining: number;
} | null> => {
    try {
        const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
        const bookObjectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

        // Get reading progress
        const progress = await findReadingProgressByUserAndBook(userObjectId, bookObjectId);

        // Get book and chapter data
        const book = await findBookById(bookObjectId);
        if (!book) return null;

        // Calculate progress
        const { bookProgress, chapterProgress, chaptersCompleted } = await calculateBookProgress(
            bookObjectId,
            progress?.currentChapter || 1,
            progress?.currentChunk || 0
        );

        // Calculate session statistics
        const totalReadingTime = progress?.totalReadingTimeMinutes || 0;
        const sessionsCount = progress?.sessionHistory?.length || 0;

        // Estimate current session time (rough calculation based on last activity)
        const currentSessionTime = progress?.lastReadAt ?
            Math.max(0, Math.min(60, (Date.now() - progress.lastReadAt.getTime()) / (1000 * 60))) : 0;

        // Estimate time remaining (if we have reading time data)
        let estimatedTimeRemaining = 0;
        if (totalReadingTime > 0 && bookProgress > 0 && bookProgress < 100) {
            const avgTimePerPercent = totalReadingTime / bookProgress;
            estimatedTimeRemaining = Math.round(avgTimePerPercent * (100 - bookProgress));
        }

        return {
            bookProgress,
            chapterProgress,
            totalReadingTime,
            currentSessionTime,
            sessionsCount,
            chaptersCompleted,
            totalChapters: book.totalChapters,
            estimatedTimeRemaining
        };
    } catch (error) {
        console.error('Error getting reading stats:', error);
        return null;
    }
}; 