import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { PromptPreset, PromptPresetCreate, PromptPresetUpdate } from './types';

const getCollection = async (): Promise<Collection<PromptPreset>> => {
    const db = await getDb();
    return db.collection('promptPresets');
};

export const createPromptPreset = async (data: PromptPresetCreate): Promise<PromptPreset> => {
    const collection = await getCollection();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.insertOne(data as any);
    const created = await collection.findOne({ _id: result.insertedId });
    if (!created) throw new Error('Failed to create prompt preset');
    return created;
};

export const findPromptPresetsByUser = async (userId: ObjectId | string): Promise<PromptPreset[]> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await collection.find({ userId: userObjectId }).sort({ updatedAt: -1 }).toArray();
};

export const updatePromptPreset = async (id: ObjectId | string, update: PromptPresetUpdate): Promise<PromptPreset | null> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: update },
        { returnDocument: 'after' }
    );
    return result || null;
};

export const deletePromptPreset = async (id: ObjectId | string): Promise<boolean> => {
    const collection = await getCollection();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount === 1;
};


