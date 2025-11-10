import { getBookUpload, deleteBookUpload } from '@/server/database/collections/bookUploads';
import { deleteFile, getFileAsString } from '@/server/s3/sdk';
import { list, del } from '@vercel/blob';
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

        // Delete images from Vercel Blob
        if (upload.parserOutputS3Key) {
            const parserOutputS3Key = upload.parserOutputS3Key; // Capture for closure
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
                            } else {
                                console.log(`📸 No images found in Vercel Blob for prefix: ${blobPrefix}`);
                            }
                        }
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

