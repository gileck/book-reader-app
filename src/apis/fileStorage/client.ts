// File Storage API Client
import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
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
    return apiClient.call(LIST_S3_FILES, params);
}

/**
 * List files from Vercel Blob storage
 */
export async function listVercelFiles(
    params: ListVercelFilesParams = {}
): Promise<CacheResult<ListVercelFilesResponse>> {
    return apiClient.call(LIST_VERCEL_FILES, params);
}

/**
 * Delete a file from S3 storage
 */
export async function deleteS3File(
    params: DeleteS3FileParams
): Promise<CacheResult<DeleteS3FileResponse>> {
    return apiClient.call(DELETE_S3_FILE, params, {
        disableCache: true
    });
}

/**
 * Delete a file from Vercel Blob storage
 */
export async function deleteVercelFile(
    params: DeleteVercelFileParams
): Promise<CacheResult<DeleteVercelFileResponse>> {
    return apiClient.call(DELETE_VERCEL_FILE, params, {
        disableCache: true
    });
}

/**
 * Get storage statistics
 */
export async function getStorageStats(
    params: GetStorageStatsParams
): Promise<CacheResult<GetStorageStatsResponse>> {
    return apiClient.call(GET_STORAGE_STATS, params);
}

