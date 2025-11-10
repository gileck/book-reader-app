import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { BookUpload, BookUploadCreate, BookUploadUpdate, BookUploadFilter, BookUploadStatus } from './types';

const getCollection = async (): Promise<Collection<BookUpload>> => {
    const db = await getDb();
    return db.collection('bookUploads');
};

export const createBookUpload = async (uploadData: BookUploadCreate & { _id?: ObjectId }): Promise<BookUpload> => {
    const collection = await getCollection();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    const upload: BookUpload = {
        _id: uploadData._id || new ObjectId(), // Use provided _id or generate new one
        ...uploadData,
        expiresAt,
        createdAt: now,
        updatedAt: now,
    };
    
    await collection.insertOne(upload);
    return upload;
};

export const getBookUpload = async (uploadId: string | ObjectId): Promise<BookUpload | null> => {
    const collection = await getCollection();
    const _id = typeof uploadId === 'string' ? new ObjectId(uploadId) : uploadId;
    
    return await collection.findOne({ _id });
};

export const getBookUploads = async (filter: BookUploadFilter = {}): Promise<BookUpload[]> => {
    const collection = await getCollection();
    return await collection.find(filter).sort({ createdAt: -1 }).toArray();
};

export const updateBookUpload = async (
    uploadId: string | ObjectId,
    update: BookUploadUpdate
): Promise<BookUpload | null> => {
    const collection = await getCollection();
    const _id = typeof uploadId === 'string' ? new ObjectId(uploadId) : uploadId;
    
    const result = await collection.findOneAndUpdate(
        { _id },
        {
            $set: {
                ...update,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );
    
    return result || null;
};

export const deleteBookUpload = async (uploadId: string | ObjectId): Promise<boolean> => {
    const collection = await getCollection();
    const _id = typeof uploadId === 'string' ? new ObjectId(uploadId) : uploadId;
    
    const result = await collection.deleteOne({ _id });
    return result.deletedCount > 0;
};

export const getRecentUploadsForUser = async (
    userId: string | ObjectId,
    options: {
        hoursAgo?: number;
        statuses?: BookUploadStatus[];
        limit?: number;
    } = {}
): Promise<BookUpload[]> => {
    const collection = await getCollection();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const {
        hoursAgo = 24,
        statuses = ['parsing', 'awaiting-approval', 'success', 'failed'] as BookUploadStatus[],
        limit = 10
    } = options;
    
    const timeAgo = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    const allUploads = await collection
        .find({
            userId: _userId,
            createdAt: { $gte: timeAgo },
            status: { $in: statuses }
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
    
    // Filter to keep only the most recent active upload (parsing/uploading)
    // Keep all completed/failed uploads
    const activeStatuses: BookUploadStatus[] = ['parsing', 'uploading'];
    const hasActiveUpload = allUploads.some(u => activeStatuses.includes(u.status));
    
    if (!hasActiveUpload) {
        return allUploads;
    }
    
    return allUploads.filter((upload, index) => {
        // Keep the first (most recent) active upload
        if (activeStatuses.includes(upload.status)) {
            const firstActiveIndex = allUploads.findIndex(u => activeStatuses.includes(u.status));
            return index === firstActiveIndex;
        }
        // Keep all non-active uploads (success, failed, awaiting-approval)
        return true;
    });
};

export const getExpiredUploads = async (): Promise<BookUpload[]> => {
    const collection = await getCollection();
    const now = new Date();
    
    return await collection
        .find({
            expiresAt: { $lt: now }
        })
        .toArray();
};

export const getExpiredUploadsForUser = async (userId: string | ObjectId): Promise<BookUpload[]> => {
    const collection = await getCollection();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const now = new Date();
    
    return await collection
        .find({
            userId: _userId,
            expiresAt: { $lt: now }
        })
        .toArray();
};

