import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { Chapter, ChapterCreate, ChapterUpdate } from './types';

const getCollection = async (): Promise<Collection<Chapter>> => {
    const db = await getDb();
    return db.collection('chapters');
};

export const createChapter = async (chapterData: ChapterCreate): Promise<Chapter> => {
    const collection = await getCollection();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.insertOne(chapterData as any);

    const createdChapter = await collection.findOne({ _id: result.insertedId });
    if (!createdChapter) {
        throw new Error('Failed to create chapter');
    }
    return createdChapter;
};

export const findChapterById = async (id: ObjectId | string): Promise<Chapter | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await collection.findOne({ _id: objectId });
};

export const findChaptersByBook = async (bookId: ObjectId | string): Promise<Chapter[]> => {
    const collection = await getCollection();
    const objectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;
    return await collection.find({ bookId: objectId }).sort({ chapterNumber: 1 }).toArray();
};

export const findChapterByBookAndNumber = async (
    bookId: ObjectId | string,
    chapterNumber: number
): Promise<Chapter | null> => {
    const collection = await getCollection();
    const objectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;
    return await collection.findOne({ bookId: objectId, chapterNumber });
};

export const updateChapter = async (id: ObjectId | string, update: ChapterUpdate): Promise<Chapter | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

export const deleteChapter = async (id: ObjectId | string): Promise<boolean> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount === 1;
};

export const deleteChaptersByBook = async (bookId: ObjectId | string): Promise<number> => {
    const collection = await getCollection();
    const objectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    const result = await collection.deleteMany({ bookId: objectId });
    return result.deletedCount;
};

export const getChapterCount = async (bookId: ObjectId | string): Promise<number> => {
    const collection = await getCollection();
    const objectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;
    return await collection.countDocuments({ bookId: objectId });
}; 