import { getBookUpload, deleteBookUpload } from '@/server/database/collections/bookUploads';
import { deleteFile } from '@/server/s3/sdk';
import * as vercelBlobSDK from '@/server/vercel-blob/sdk';
import type { ApiHandlerContext, DeleteUploadRequest, DeleteUploadResponse } from '../types';

export async function deleteUploadHandler(
    params: DeleteUploadRequest,
    context: ApiHandlerContext
): Promise<DeleteUploadResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        // Get upload record
        const upload = await getBookUpload(params.uploadId);

        if (!upload) {
            return { error: 'Upload not found' };
        }

        // Verify ownership
        if (upload.userId.toString() !== context.userId) {
            return { error: 'Forbidden' };
        }

        // Delete S3 files (don't fail if they don't exist)
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
                        if (!vercelBlobSDK.isConfigured()) {
                            console.warn('⚠️  Vercel Blob not configured, skipping image deletion');
                            return;
                        }
                        
                        const blobUrls = imagesToDelete.map(img => img.url);
                        console.log(`🗑️  Deleting ${blobUrls.length} images from Vercel Blob`);
                        await vercelBlobSDK.deleteFiles(blobUrls);
                        console.log(`✅ Deleted ${blobUrls.length} images from Vercel Blob`);
                    } catch (err) {
                        console.error('Failed to delete Vercel Blob images:', err);
                        // Don't throw - allow deletion to continue even if image cleanup fails
                    }
                })()
            );
        }

        // Wait for all deletions to complete (or fail gracefully)
        await Promise.all(deletePromises);

        // Delete the database record
        await deleteBookUpload(params.uploadId);

        console.log(`✅ Deleted upload ${params.uploadId} and associated S3 files`);

        return { success: true };
    } catch (error) {
        console.error('Delete upload error:', error);
        return { error: 'Failed to delete upload' };
    }
}

