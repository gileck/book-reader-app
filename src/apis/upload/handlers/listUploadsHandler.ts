import { getRecentUploadsForUser } from '@/server/database/collections/bookUploads';
import type { ApiHandlerContext, ListUploadsRequest, ListUploadsResponse } from '../types';

export async function listUploadsHandler(
    _params: ListUploadsRequest,
    context: ApiHandlerContext
): Promise<ListUploadsResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        // Get recent uploads using database layer
        const uploads = await getRecentUploadsForUser(context.userId, {
            hoursAgo: 24,
            statuses: ['parsing', 'awaiting-approval', 'success', 'failed'],
            limit: 10
        });

        return {
            uploads: uploads.map((upload) => ({
                uploadId: upload._id.toString(),
                status: upload.status,
                createdAt: upload.createdAt,
                fileName: upload.fileName,
                currentStep: upload.currentStep,
                currentStepNumber: upload.currentStepNumber,
                totalSteps: upload.totalSteps,
                progress: upload.progress,
                validationErrors: upload.validationErrors,
                error: upload.error?.message,
                hasValidationErrors: upload.status === 'awaiting-approval'
            }))
        };
    } catch (error) {
        console.error('List uploads error:', error);
        return { error: 'Failed to load uploads' };
    }
}

