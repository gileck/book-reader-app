import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { UserSettings, UserSettingsCreate, UserSettingsUpdate, DEFAULT_USER_SETTINGS } from './types';

const getCollection = async (): Promise<Collection<UserSettings>> => {
    const db = await getDb();
    return db.collection('userSettings');
};

export const createUserSettings = async (userId: ObjectId | string): Promise<UserSettings> => {
    const collection = await getCollection();
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Check if settings already exist for this user
    const existing = await collection.findOne({ userId: userObjectId });
    if (existing) {
        return existing;
    }

    const now = new Date();
    const settingsData: UserSettingsCreate = {
        userId: userObjectId,
        ...DEFAULT_USER_SETTINGS,
        createdAt: now,
        updatedAt: now
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.insertOne(settingsData as any);

    const createdSettings = await collection.findOne({ _id: result.insertedId });
    if (!createdSettings) {
        throw new Error('Failed to create user settings');
    }
    return createdSettings;
};

export const findUserSettings = async (userId: ObjectId | string): Promise<UserSettings | null> => {
    const collection = await getCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await collection.findOne({ userId: objectId });
};

export const findOrCreateUserSettings = async (userId: ObjectId | string): Promise<UserSettings> => {
    const existing = await findUserSettings(userId);
    if (existing) {
        return existing;
    }

    return await createUserSettings(userId);
};

export const updateUserSettings = async (
    userId: ObjectId | string,
    update: Partial<Omit<UserSettings, '_id' | 'userId' | 'createdAt'>>
): Promise<UserSettings | null> => {
    const collection = await getCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const updateData: UserSettingsUpdate = {
        ...update,
        updatedAt: new Date()
    };

    const result = await collection.findOneAndUpdate(
        { userId: objectId },
        { $set: updateData },
        { returnDocument: 'after' }
    );

    return result || null;
};

export const updateAudioSettings = async (
    userId: ObjectId | string,
    audioSettings: {
        playbackSpeed?: number;
        voiceId?: string;
        wordTimingOffset?: number;
    }
): Promise<UserSettings | null> => {
    return await updateUserSettings(userId, audioSettings);
};

export const updateVisualSettings = async (
    userId: ObjectId | string,
    visualSettings: {
        theme?: 'light' | 'dark';
        highlightColor?: string;
        sentenceHighlightColor?: string;
        fontSize?: number;
        lineHeight?: number;
    }
): Promise<UserSettings | null> => {
    return await updateUserSettings(userId, visualSettings);
};

export const updateReadingPreferences = async (
    userId: ObjectId | string,
    preferences: {
        autoAdvance?: boolean;
        chunkSize?: number;
    }
): Promise<UserSettings | null> => {
    return await updateUserSettings(userId, preferences);
};

export const deleteUserSettings = async (userId: ObjectId | string): Promise<boolean> => {
    const collection = await getCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.deleteOne({ userId: objectId });
    return result.deletedCount === 1;
};

export const resetUserSettings = async (userId: ObjectId | string): Promise<UserSettings | null> => {
    const collection = await getCollection();
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const resetData: UserSettingsUpdate = {
        ...DEFAULT_USER_SETTINGS,
        updatedAt: new Date()
    };

    const result = await collection.findOneAndUpdate(
        { userId: objectId },
        { $set: resetData },
        { returnDocument: 'after' }
    );

    return result || null;
}; 