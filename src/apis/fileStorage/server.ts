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
    StorageFile,
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
        prefix: params.prefix,
        cursor: params.cursor,
        limit: params.limit || 1000
    });

    // Group files by folders (similar to S3 CommonPrefixes)
    const currentPrefix = params.prefix || '';
    const filesMap = new Map<string, StorageFile>();
    const foldersMap = new Map<string, { size: number; count: number }>();

    for (const blob of result.blobs) {
        const relativePath = blob.pathname.replace(currentPrefix, '');
        
        // Skip if empty path
        if (!relativePath) continue;

        const parts = relativePath.split('/');

        // If it's a file at current level (no more slashes)
        if (parts.length === 1) {
            filesMap.set(blob.pathname, {
                key: blob.pathname,
                size: blob.size,
                lastModified: new Date(blob.uploadedAt),
                url: blob.url,
                isFolder: false
            });
        } else {
            // It's in a subfolder
            const folderName = parts[0];
            const folderKey = currentPrefix + folderName + '/';
            
            const existing = foldersMap.get(folderKey) || { size: 0, count: 0 };
            foldersMap.set(folderKey, {
                size: existing.size + blob.size,
                count: existing.count + 1
            });
        }
    }

    // Combine folders and files
    const files: StorageFile[] = [];

    // Add folders first
    for (const [folderKey, stats] of foldersMap.entries()) {
        files.push({
            key: folderKey,
            size: stats.size,
            lastModified: new Date(),
            isFolder: true,
            fileCount: stats.count
        });
    }

    // Add files
    files.push(...Array.from(filesMap.values()));

    // Calculate stats
    const totalStats: StorageStats = {
        totalFiles: filesMap.size,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        totalFolders: foldersMap.size
    };

    return {
        files,
        stats: totalStats,
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

