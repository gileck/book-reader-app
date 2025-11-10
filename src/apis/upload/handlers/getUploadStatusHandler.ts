import { getBookUpload } from '@/server/database/collections/bookUploads';
import type { ApiHandlerContext, GetUploadStatusRequest, GetUploadStatusResponse } from '../types';

export async function getUploadStatusHandler(
    params: GetUploadStatusRequest,
    context: ApiHandlerContext
): Promise<GetUploadStatusResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        const upload = await getBookUpload(params.uploadId);

        if (!upload) {
            return { error: 'Upload not found' };
        }

        // Verify ownership
        if (upload.userId.toString() !== context.userId) {
            return { error: 'Forbidden' };
        }

        return {
            upload: {
                uploadId: upload._id.toString(),
                status: upload.status,
                createdAt: upload.createdAt,
                expiresAt: upload.expiresAt,
                fileName: upload.fileName,
                currentStep: upload.currentStep,
                currentStepNumber: upload.currentStepNumber,
                totalSteps: upload.totalSteps,
                progress: upload.progress,
                validationErrors: upload.validationErrors,
                error: upload.error?.message,
                hasValidationErrors: upload.status === 'awaiting-approval'
            }
        };
    } catch (error) {
        console.error('Get upload status error:', error);
        return { error: 'Failed to get upload status' };
    }
}

