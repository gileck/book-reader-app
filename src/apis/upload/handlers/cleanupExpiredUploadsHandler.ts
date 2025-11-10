import { getExpiredUploadsForUser } from '@/server/database/collections/bookUploads';
import { deleteFile, getFileAsString } from '@/server/s3/sdk';
import { list, del } from '@vercel/blob';
import { deleteBookUpload } from '@/server/database/collections/bookUploads';
import type { ApiHandlerContext, CleanupExpiredUploadsRequest, CleanupExpiredUploadsResponse } from '../types';

/**
 * Cleanup expired uploads for a user
 * Deletes S3 files (PDF, parser output), Vercel Blob images, and database records
 */
export async function cleanupExpiredUploadsHandler(
    _params: CleanupExpiredUploadsRequest,
    context: ApiHandlerContext
): Promise<CleanupExpiredUploadsResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized', deletedCount: 0 };
        }

        // Get all expired uploads for this user
        const expiredUploads = await getExpiredUploadsForUser(context.userId);

        if (expiredUploads.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        console.log(`🧹 Found ${expiredUploads.length} expired uploads for user ${context.userId}`);

        let deletedCount = 0;

        // Process each expired upload
        for (const upload of expiredUploads) {
            try {
                console.log(`🗑️  Cleaning up expired upload: ${upload._id}`);

                const deletePromises: Promise<void>[] = [];

                // Delete the PDF
                if (upload.pdfS3Key) {
                    deletePromises.push(
                        deleteFile(upload.pdfS3Key).catch(err => {
                            console.error(`Failed to delete PDF ${upload.pdfS3Key}:`, err);
                        })
                    );
                }

                // Delete the parser output
                if (upload.parserOutputS3Key) {
                    deletePromises.push(
                        deleteFile(upload.parserOutputS3Key).catch(err => {
                            console.error(`Failed to delete parser output ${upload.parserOutputS3Key}:`, err);
                        })
                    );
                }

                // Delete images from Vercel Blob
                if (upload.parserOutputS3Key) {
                    const parserOutputS3Key = upload.parserOutputS3Key;
                    deletePromises.push(
                        (async () => {
                            try {
                                // Get parser output to find imageBaseURL
                                const parserOutputJson = await getFileAsString(parserOutputS3Key);
                                const parserOutput = JSON.parse(parserOutputJson);

                                if (parserOutput?.finalOutput?.metadata?.imageBaseURL) {
                                    const imageBaseURL = parserOutput.finalOutput.metadata.imageBaseURL;
                                    // Extract book folder from imageBaseURL (e.g., "/BookTitle/images/" -> "books/BookTitle/")
                                    const bookFolder = imageBaseURL.replace(/^\//, '').replace(/\/images\/$/, '');
                                    const blobPrefix = `books/${bookFolder}`;

                                    console.log(`🔍 Looking for Vercel Blob images with prefix: ${blobPrefix}`);

                                    // List all blobs with this prefix
                                    const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
                                    if (!BLOB_READ_WRITE_TOKEN) {
                                        console.warn('⚠️  BLOB_READ_WRITE_TOKEN not set, skipping image deletion');
                                        return;
                                    }

                                    const { blobs } = await list({
                                        prefix: blobPrefix,
                                        token: BLOB_READ_WRITE_TOKEN
                                    });

                                    if (blobs.length > 0) {
                                        const blobUrls = blobs.map(blob => blob.url);
                                        console.log(`🗑️  Deleting ${blobUrls.length} images from Vercel Blob`);
                                        await del(blobUrls, { token: BLOB_READ_WRITE_TOKEN });
                                        console.log(`✅ Deleted ${blobUrls.length} images from Vercel Blob`);
                                    }
                                }
                            } catch (err) {
                                console.error('Failed to delete Vercel Blob images:', err);
                                // Don't throw - allow deletion to continue
                            }
                        })()
                    );
                }

                // Wait for all deletions to complete
                await Promise.all(deletePromises);

                // Delete the database record
                await deleteBookUpload(upload._id);

                console.log(`✅ Deleted expired upload ${upload._id}`);
                deletedCount++;
            } catch (error) {
                console.error(`Failed to delete upload ${upload._id}:`, error);
                // Continue with other uploads
            }
        }

        console.log(`🎉 Cleanup complete: ${deletedCount} expired uploads deleted`);

        return {
            success: true,
            deletedCount
        };
    } catch (error) {
        console.error('Cleanup expired uploads error:', error);
        return {
            error: 'Failed to cleanup expired uploads',
            deletedCount: 0
        };
    }
}

