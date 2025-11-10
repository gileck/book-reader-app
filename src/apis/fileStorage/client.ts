// File Storage API Client
import { CacheResult } from '../../client/api-client/types';
import { makeApiCall } from '../../client/api-client/makeApiCall';
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
    GetStorageStatsResponse
} from './types';

/**
 * List files from S3 storage
 */
export async function listS3Files(
    params: ListS3FilesParams = {}
): Promise<CacheResult<ListS3FilesResponse>> {
    return makeApiCall<ListS3FilesResponse>(LIST_S3_FILES, params);
}

/**
 * List files from Vercel Blob storage
 */
export async function listVercelFiles(
    params: ListVercelFilesParams = {}
): Promise<CacheResult<ListVercelFilesResponse>> {
    return makeApiCall<ListVercelFilesResponse>(LIST_VERCEL_FILES, params);
}

/**
 * Delete a file from S3 storage
 */
export async function deleteS3File(
    params: DeleteS3FileParams
): Promise<CacheResult<DeleteS3FileResponse>> {
    return makeApiCall<DeleteS3FileResponse>(DELETE_S3_FILE, params, {
        skipCache: true
    });
}

/**
 * Delete a file from Vercel Blob storage
 */
export async function deleteVercelFile(
    params: DeleteVercelFileParams
): Promise<CacheResult<DeleteVercelFileResponse>> {
    return makeApiCall<DeleteVercelFileResponse>(DELETE_VERCEL_FILE, params, {
        skipCache: true
    });
}

/**
 * Get storage statistics
 */
export async function getStorageStats(
    params: GetStorageStatsParams
): Promise<CacheResult<GetStorageStatsResponse>> {
    return makeApiCall<GetStorageStatsResponse>(GET_STORAGE_STATS, params);
}

