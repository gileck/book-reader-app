import { getBookUpload, updateBookUpload } from '@/server/database/collections/bookUploads';
import type { ApiHandlerContext, ApproveErrorsRequest, ApproveErrorsResponse } from '../types';

export async function approveErrorsHandler(
    params: ApproveErrorsRequest,
    context: ApiHandlerContext
): Promise<ApproveErrorsResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!Array.isArray(params.errors)) {
            return { error: 'Errors must be an array' };
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

        // Verify status is awaiting-approval
        if (upload.status !== 'awaiting-approval') {
            return { error: 'Upload is not awaiting approval' };
        }

        // Update database with approved errors
        // This signals the parser to continue
        await updateBookUpload(params.uploadId, {
            skippedValidationErrors: [
                ...upload.skippedValidationErrors,
                ...params.errors
            ],
            status: 'parsing' // Signal parser to continue
        });

        return {
            success: true,
            message: 'Errors approved, parser will continue'
        };
    } catch (error) {
        console.error('Approve errors error:', error);
        return { error: 'Failed to approve errors' };
    }
}

