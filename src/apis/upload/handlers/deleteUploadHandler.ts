import { getBookUpload, deleteBookUpload } from '@/server/database/collections/bookUploads';
import { deleteFile, listFiles } from '@/server/s3/sdk';
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

        // Delete all images in the upload folder
        try {
            const imagesPrefix = `users/${context.userId}/uploads/${params.uploadId}/images/`;
            console.log(`🗑️  Deleting images from: ${imagesPrefix}`);
            
            const imageFiles = await listFiles(imagesPrefix);
            
            if (imageFiles.length > 0) {
                console.log(`   Found ${imageFiles.length} images to delete`);
                
                // Delete each image
                const imageDeletePromises = imageFiles.map(file =>
                    deleteFile(file.key).catch(err => {
                        console.error(`Failed to delete image ${file.key}:`, err);
                    })
                );
                
                deletePromises.push(...imageDeletePromises);
            } else {
                console.log(`   No images found in ${imagesPrefix}`);
            }
        } catch (err) {
            console.error(`Failed to list/delete images:`, err);
            // Continue with deletion even if image cleanup fails
        }

        // Wait for all S3 deletions to complete (or fail gracefully)
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

