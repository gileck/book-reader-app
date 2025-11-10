// File Storage API Server Handlers
import { ApiHandlerContext } from '../types';
import {
    LIST_S3_FILES,
    LIST_VERCEL_FILES,
    DELETE_S3_FILE,
    DELETE_VERCEL_FILE,
    GET_STORAGE_STATS
} from './index';
import {
    ListS3FilesParams,
    ListS3FilesResponse,
    ListVercelFilesParams,
    ListVercelFilesResponse,
    DeleteS3FileParams,
    DeleteS3FileResponse,
    DeleteVercelFileParams,
    DeleteVercelFileResponse,
    GetStorageStatsParams,
    GetStorageStatsResponse,
    StorageStats
} from './types';
import { listFiles as listS3FilesSDK, deleteFile as deleteS3FileSDK } from '../../server/s3/sdk';
import { list as listVercelBlobs, del as deleteVercelBlob } from '@vercel/blob';

/**
 * List files from S3 storage
 */
export async function listS3Files(
    params: ListS3FilesParams,
    context: ApiHandlerContext
): Promise<ListS3FilesResponse> {
    // Only allow authenticated users
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    const files = await listS3FilesSDK(params.prefix);

    // Calculate stats
    const stats: StorageStats = {
        totalFiles: files.filter(f => !f.isFolder).length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        totalFolders: files.filter(f => f.isFolder).length
    };

    return { files, stats };
}

/**
 * List files from Vercel Blob storage
 */
export async function listVercelFiles(
    params: ListVercelFilesParams,
    context: ApiHandlerContext
): Promise<ListVercelFilesResponse> {
    // Only allow authenticated users
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
    if (!BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }

    const result = await listVercelBlobs({
        token: BLOB_READ_WRITE_TOKEN,
        cursor: params.cursor,
        limit: params.limit || 1000
    });

    const files = result.blobs.map(blob => ({
        key: blob.pathname,
        size: blob.size,
        lastModified: new Date(blob.uploadedAt),
        url: blob.url,
        isFolder: false
    }));

    // Calculate stats
    const stats: StorageStats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        totalFolders: 0
    };

    return {
        files,
        stats,
        cursor: result.cursor,
        hasMore: result.hasMore
    };
}

/**
 * Delete a file from S3 storage
 */
export async function deleteS3File(
    params: DeleteS3FileParams,
    context: ApiHandlerContext
): Promise<DeleteS3FileResponse> {
    // Only allow authenticated users
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    await deleteS3FileSDK(params.key);

    return { success: true };
}

/**
 * Delete a file from Vercel Blob storage
 */
export async function deleteVercelFile(
    params: DeleteVercelFileParams,
    context: ApiHandlerContext
): Promise<DeleteVercelFileResponse> {
    // Only allow authenticated users
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
    if (!BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }

    await deleteVercelBlob(params.url, {
        token: BLOB_READ_WRITE_TOKEN
    });

    return { success: true };
}

/**
 * Get storage statistics
 */
export async function getStorageStats(
    params: GetStorageStatsParams,
    context: ApiHandlerContext
): Promise<GetStorageStatsResponse> {
    // Only allow authenticated users
    if (!context.userId) {
        throw new Error('Authentication required');
    }

    if (params.storage === 's3') {
        const files = await listS3FilesSDK();
        const stats: StorageStats = {
            totalFiles: files.filter(f => !f.isFolder).length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            totalFolders: files.filter(f => f.isFolder).length
        };
        return { stats };
    } else {
        const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
        if (!BLOB_READ_WRITE_TOKEN) {
            throw new Error('BLOB_READ_WRITE_TOKEN not configured');
        }

        const result = await listVercelBlobs({
            token: BLOB_READ_WRITE_TOKEN,
            limit: 1000
        });

        const stats: StorageStats = {
            totalFiles: result.blobs.length,
            totalSize: result.blobs.reduce((sum, blob) => sum + blob.size, 0),
            totalFolders: 0
        };

        return { stats };
    }
}

// Export handlers map
export const fileStorageApiHandlers = {
    [LIST_S3_FILES]: { process: listS3Files },
    [LIST_VERCEL_FILES]: { process: listVercelFiles },
    [DELETE_S3_FILE]: { process: deleteS3File },
    [DELETE_VERCEL_FILE]: { process: deleteVercelFile },
    [GET_STORAGE_STATS]: { process: getStorageStats }
};

