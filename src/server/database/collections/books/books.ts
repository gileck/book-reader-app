import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { Book, BookCreate, BookUpdate, BookFilter } from './types';

const getCollection = async (): Promise<Collection<Book>> => {
    const db = await getDb();
    return db.collection('books');
};

export const createBook = async (bookData: BookCreate): Promise<Book> => {
    const collection = await getCollection();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.insertOne(bookData as any);

    const createdBook = await collection.findOne({ _id: result.insertedId });
    if (!createdBook) {
        throw new Error('Failed to create book');
    }
    return createdBook;
};

export const findBookById = async (id: ObjectId | string): Promise<Book | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await collection.findOne({ _id: objectId });
};

export const findBooks = async (filter: BookFilter = {}, limit = 50): Promise<Book[]> => {
    const collection = await getCollection();
    return await collection.find(filter).limit(limit).toArray();
};

export const findPublicBooks = async (limit = 50): Promise<Book[]> => {
    const collection = await getCollection();
    return await collection.find({ isPublic: true }).limit(limit).toArray();
};

export const findBooksByUser = async (userId: ObjectId | string): Promise<Book[]> => {
    const collection = await getCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await collection.find({ uploadedBy: objectId }).toArray();
};

export const updateBook = async (id: ObjectId | string, update: BookUpdate): Promise<Book | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

export const deleteBook = async (id: ObjectId | string): Promise<boolean> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount === 1;
};

export const searchBooks = async (searchTerm: string, limit = 20): Promise<Book[]> => {
    const collection = await getCollection();
    return await collection.find({
        $and: [
            { isPublic: true },
            {
                $or: [
                    { title: { $regex: searchTerm, $options: 'i' } },
                    { author: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ]
            }
        ]
    }).limit(limit).toArray();
}; 