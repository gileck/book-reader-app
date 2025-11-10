// File Storage API Types

export interface StorageFile {
    key: string;
    size: number;
    lastModified: Date;
    url?: string;
    isFolder?: boolean;
    fileCount?: number;
}

export interface StorageStats {
    totalFiles: number;
    totalSize: number;
    totalFolders: number;
}

// List S3 Files
export interface ListS3FilesParams {
    prefix?: string;
}

export interface ListS3FilesResponse {
    files: StorageFile[];
    stats: StorageStats;
}

// List Vercel Files
export interface ListVercelFilesParams {
    cursor?: string;
    limit?: number;
}

export interface ListVercelFilesResponse {
    files: StorageFile[];
    stats: StorageStats;
    cursor?: string;
    hasMore: boolean;
}

// Delete S3 File
export interface DeleteS3FileParams {
    key: string;
}

export interface DeleteS3FileResponse {
    success: boolean;
}

// Delete Vercel File
export interface DeleteVercelFileParams {
    url: string;
}

export interface DeleteVercelFileResponse {
    success: boolean;
}

// Get Storage Stats
export interface GetStorageStatsParams {
    storage: 's3' | 'vercel';
}

export interface GetStorageStatsResponse {
    stats: StorageStats;
}

