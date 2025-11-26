/**
 * Vercel Blob SDK - Abstraction layer for Vercel Blob storage
 * 
 * This SDK provides a unified interface for interacting with Vercel Blob storage,
 * similar to the S3 SDK pattern. It encapsulates all Vercel Blob operations and
 * configuration in one place.
 * 
 * Store Configuration:
 * - Store Name: book-reader-app-blob
 * - Store ID: store_aDSRs5mRJ2rQyAzd
 * - Base URL: https://adsrs5mrj2rqyazd.public.blob.vercel-storage.com
 */

import { put, del, list, head } from '@vercel/blob';

// Store configuration
export const VERCEL_BLOB_STORE_ID = 'store_aDSRs5mRJ2rQyAzd';
export const VERCEL_BLOB_BASE_URL = 'https://adsrs5mrj2rqyazd.public.blob.vercel-storage.com';

// Types
export interface BlobFile {
    key: string;           // The pathname/key of the blob
    url: string;           // Full public URL
    size: number;          // Size in bytes
    uploadedAt: Date;      // Upload timestamp
}

export interface BlobUploadParams {
    key: string;           // The blob key/pathname
    content: Buffer | string | ArrayBuffer | Blob;
    contentType?: string;  // MIME type
    allowOverwrite?: boolean; // Default true
}

export interface BlobListParams {
    prefix?: string;       // Filter by prefix
    cursor?: string;       // Pagination cursor
    limit?: number;        // Max items to return (default 1000)
}

export interface BlobListResult {
    blobs: BlobFile[];
    cursor?: string;
    hasMore: boolean;
}

export interface BlobStats {
    totalFiles: number;
    totalSize: number;
}

/**
 * Get the Vercel Blob read-write token from environment
 */
function getToken(): string {
    const token = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    if (!token) {
        throw new Error('VERCEL_BLOB_READ_WRITE_TOKEN environment variable is not set');
    }
    return token;
}

/**
 * Check if the SDK is configured (token exists)
 */
export function isConfigured(): boolean {
    return !!process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
}

/**
 * Upload a file to Vercel Blob
 * 
 * @param params Upload parameters
 * @returns The full URL of the uploaded blob
 * 
 * @example
 * const url = await uploadFile({
 *     key: 'books/MyBook/images/cover.jpg',
 *     content: imageBuffer,
 *     contentType: 'image/jpeg'
 * });
 */
export async function uploadFile(params: BlobUploadParams): Promise<string> {
    const token = getToken();
    
    const blob = await put(params.key, params.content, {
        access: 'public',
        contentType: params.contentType || 'application/octet-stream',
        token,
        addRandomSuffix: false,
        allowOverwrite: params.allowOverwrite ?? true
    });

    return blob.url;
}

/**
 * Upload a file and return full blob metadata
 * 
 * @param params Upload parameters
 * @returns Blob metadata including URL, size, etc.
 */
export async function uploadFileWithMetadata(params: BlobUploadParams): Promise<BlobFile> {
    const token = getToken();
    
    const blob = await put(params.key, params.content, {
        access: 'public',
        contentType: params.contentType || 'application/octet-stream',
        token,
        addRandomSuffix: false,
        allowOverwrite: params.allowOverwrite ?? true
    });

    // Get full metadata including size using head
    const metadata = await head(blob.url, { token });

    return {
        key: blob.pathname,
        url: blob.url,
        size: metadata.size,
        uploadedAt: metadata.uploadedAt
    };
}

/**
 * Delete a file from Vercel Blob by URL
 * 
 * @param url The full URL of the blob to delete
 * 
 * @example
 * await deleteFile('https://adsrs5mrj2rqyazd.public.blob.vercel-storage.com/books/MyBook/cover.jpg');
 */
export async function deleteFile(url: string): Promise<void> {
    const token = getToken();
    await del(url, { token });
}

/**
 * Delete multiple files from Vercel Blob by URLs
 * 
 * @param urls Array of full URLs to delete
 * 
 * @example
 * await deleteFiles([
 *     'https://adsrs5mrj2rqyazd.public.blob.vercel-storage.com/books/MyBook/img1.jpg',
 *     'https://adsrs5mrj2rqyazd.public.blob.vercel-storage.com/books/MyBook/img2.jpg'
 * ]);
 */
export async function deleteFiles(urls: string[]): Promise<void> {
    if (urls.length === 0) return;
    const token = getToken();
    await del(urls, { token });
}

/**
 * List files in Vercel Blob storage
 * 
 * @param params List parameters
 * @returns List result with blobs and pagination info
 * 
 * @example
 * const result = await listFiles({ prefix: 'books/MyBook/' });
 * for (const blob of result.blobs) {
 *     console.log(blob.url, blob.size);
 * }
 */
export async function listFiles(params: BlobListParams = {}): Promise<BlobListResult> {
    const token = getToken();
    
    const result = await list({
        token,
        prefix: params.prefix,
        cursor: params.cursor,
        limit: params.limit || 1000
    });

    return {
        blobs: result.blobs.map(blob => ({
            key: blob.pathname,
            url: blob.url,
            size: blob.size,
            uploadedAt: new Date(blob.uploadedAt)
        })),
        cursor: result.cursor,
        hasMore: result.hasMore
    };
}

/**
 * List ALL files matching a prefix (handles pagination automatically)
 * 
 * @param prefix Optional prefix to filter files
 * @returns All matching blobs
 */
export async function listAllFiles(prefix?: string): Promise<BlobFile[]> {
    const allBlobs: BlobFile[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await listFiles({ prefix, cursor, limit: 1000 });
        allBlobs.push(...result.blobs);
        cursor = result.cursor;
    } while (cursor);
    
    return allBlobs;
}

/**
 * Get metadata for a specific blob by URL
 * 
 * @param url The full URL of the blob
 * @returns Blob metadata or null if not found
 */
export async function getFileMetadata(url: string): Promise<BlobFile | null> {
    try {
        const token = getToken();
        const blob = await head(url, { token });
        
        return {
            key: blob.pathname,
            url: blob.url,
            size: blob.size,
            uploadedAt: new Date(blob.uploadedAt)
        };
    } catch {
        return null;
    }
}

/**
 * Get storage statistics
 * 
 * @param prefix Optional prefix to filter
 * @returns Total files and size
 */
export async function getStorageStats(prefix?: string): Promise<BlobStats> {
    const allBlobs = await listAllFiles(prefix);
    
    return {
        totalFiles: allBlobs.length,
        totalSize: allBlobs.reduce((sum, blob) => sum + blob.size, 0)
    };
}

/**
 * Check if a blob exists by URL
 * 
 * @param url The full URL to check
 * @returns true if exists, false otherwise
 */
export async function exists(url: string): Promise<boolean> {
    const metadata = await getFileMetadata(url);
    return metadata !== null;
}

/**
 * Get the base URL for the Vercel Blob store
 */
export function getBaseUrl(): string {
    return VERCEL_BLOB_BASE_URL;
}

/**
 * Build a full URL from a blob key/path
 * 
 * @param key The blob key/pathname
 * @returns Full public URL
 */
export function buildUrl(key: string): string {
    // Remove leading slash if present
    const cleanKey = key.startsWith('/') ? key.slice(1) : key;
    return `${VERCEL_BLOB_BASE_URL}/${cleanKey}`;
}

/**
 * Extract the key/pathname from a full Vercel Blob URL
 * 
 * @param url Full Vercel Blob URL
 * @returns The key/pathname portion
 */
export function extractKey(url: string): string {
    if (url.startsWith(VERCEL_BLOB_BASE_URL)) {
        return url.slice(VERCEL_BLOB_BASE_URL.length + 1);
    }
    // Handle old store URL format
    const match = url.match(/https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/(.+)/);
    return match ? match[1] : url;
}

/**
 * Get content type based on file extension
 */
export function getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const types: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'json': 'application/json',
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript'
    };
    return types[ext || ''] || 'application/octet-stream';
}

