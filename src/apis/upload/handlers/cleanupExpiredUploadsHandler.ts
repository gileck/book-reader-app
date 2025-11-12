import { getExpiredUploadsForUser, getRecentUploadsForUser } from '@/server/database/collections/bookUploads';
import { deleteFile } from '@/server/s3/sdk';
import { del } from '@vercel/blob';
import { deleteBookUpload } from '@/server/database/collections/bookUploads';
import type { ApiHandlerContext, CleanupExpiredUploadsRequest, CleanupExpiredUploadsResponse } from '../types';
import type { BookUpload } from '@/server/database/collections/bookUploads/types';

/**
 * Cleanup expired uploads and old failed uploads for a user
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

        // Also get failed uploads older than 1 hour (no need to keep them for 24 hours)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentFailed = await getRecentUploadsForUser(context.userId, {
            hoursAgo: 24,
            statuses: ['failed'],
            limit: 50
        });
        const oldFailedUploads = recentFailed.filter(upload => 
            upload.createdAt < oneHourAgo
        );

        // Combine expired and old failed uploads, removing duplicates
        const uploadIdsSet = new Set<string>();
        const uploadsToDelete: BookUpload[] = [];
        
        for (const upload of [...expiredUploads, ...oldFailedUploads]) {
            const uploadId = upload._id.toString();
            if (!uploadIdsSet.has(uploadId)) {
                uploadIdsSet.add(uploadId);
                uploadsToDelete.push(upload);
            }
        }

        if (uploadsToDelete.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        console.log(`🧹 Found ${uploadsToDelete.length} uploads to clean up for user ${context.userId}`);
        console.log(`   - ${expiredUploads.length} expired uploads`);
        console.log(`   - ${oldFailedUploads.length} old failed uploads (>1 hour)`);

        let deletedCount = 0;

        // Process each upload to delete
        for (const upload of uploadsToDelete) {
            try {
                console.log(`🗑️  Cleaning up upload: ${upload._id} (status: ${upload.status})`);

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

                // Delete images from Vercel Blob using stored URLs from database
                if (upload.images && upload.images.length > 0) {
                    const imagesToDelete = upload.images; // Capture for closure
                    deletePromises.push(
                        (async () => {
                            try {
                                const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
                                if (!BLOB_READ_WRITE_TOKEN) {
                                    console.warn('⚠️  BLOB_READ_WRITE_TOKEN not set, skipping image deletion');
                                    return;
                                }

                                const blobUrls = imagesToDelete.map(img => img.url);
                                console.log(`🗑️  Deleting ${blobUrls.length} images from Vercel Blob`);
                                await del(blobUrls, { token: BLOB_READ_WRITE_TOKEN });
                                console.log(`✅ Deleted ${blobUrls.length} images from Vercel Blob`);
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

                console.log(`✅ Deleted upload ${upload._id}`);
                deletedCount++;
            } catch (error) {
                console.error(`Failed to delete upload ${upload._id}:`, error);
                // Continue with other uploads
            }
        }

        console.log(`🎉 Cleanup complete: ${deletedCount} uploads deleted`);

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

