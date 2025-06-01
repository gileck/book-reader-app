import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { Bookmark, BookmarkCreate, BookmarkUpdate } from './types';

const getCollection = async (): Promise<Collection<Bookmark>> => {
    const db = await getDb();
    return db.collection('bookmarks');
};

export const createBookmark = async (bookmarkData: BookmarkCreate): Promise<Bookmark> => {
    const collection = await getCollection();

    // Check if bookmark already exists at this position
    const existing = await collection.findOne({
        userId: bookmarkData.userId,
        bookId: bookmarkData.bookId,
        chapterNumber: bookmarkData.chapterNumber,
        chunkIndex: bookmarkData.chunkIndex
    });

    if (existing) {
        throw new Error('Bookmark already exists at this position');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.insertOne(bookmarkData as any);

    const createdBookmark = await collection.findOne({ _id: result.insertedId });
    if (!createdBookmark) {
        throw new Error('Failed to create bookmark');
    }
    return createdBookmark;
};

export const findBookmarkById = async (id: ObjectId | string): Promise<Bookmark | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await collection.findOne({ _id: objectId });
};

export const findBookmarksByUser = async (userId: ObjectId | string): Promise<Bookmark[]> => {
    const collection = await getCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await collection.find({ userId: objectId }).sort({ createdAt: -1 }).toArray();
};

export const findBookmarksByUserAndBook = async (
    userId: ObjectId | string,
    bookId: ObjectId | string
): Promise<Bookmark[]> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const bookObjectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    return await collection.find({
        userId: userObjectId,
        bookId: bookObjectId
    }).sort({ chapterNumber: 1, chunkIndex: 1 }).toArray();
};

export const findBookmarkAtPosition = async (
    userId: ObjectId | string,
    bookId: ObjectId | string,
    chapterNumber: number,
    chunkIndex: number
): Promise<Bookmark | null> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const bookObjectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    return await collection.findOne({
        userId: userObjectId,
        bookId: bookObjectId,
        chapterNumber,
        chunkIndex
    });
};

export const updateBookmark = async (id: ObjectId | string, update: BookmarkUpdate): Promise<Bookmark | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

export const deleteBookmark = async (id: ObjectId | string): Promise<boolean> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount === 1;
};

export const deleteBookmarkAtPosition = async (
    userId: ObjectId | string,
    bookId: ObjectId | string,
    chapterNumber: number,
    chunkIndex: number
): Promise<boolean> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const bookObjectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    const result = await collection.deleteOne({
        userId: userObjectId,
        bookId: bookObjectId,
        chapterNumber,
        chunkIndex
    });

    return result.deletedCount === 1;
};

export const deleteBookmarksByBook = async (bookId: ObjectId | string): Promise<number> => {
    const collection = await getCollection();
    const objectId = typeof bookId === 'string' ? new ObjectId(bookId) : bookId;

    const result = await collection.deleteMany({ bookId: objectId });
    return result.deletedCount;
}; 