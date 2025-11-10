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

        console.log(`📝 Approval request for uploadId: ${params.uploadId}`);
        console.log(`   Errors to approve: ${params.errors.length}`);

        // Get upload record
        const upload = await getBookUpload(params.uploadId);

        if (!upload) {
            console.log(`❌ Upload ${params.uploadId} not found`);
            return { error: 'Upload not found' };
        }

        // Verify ownership
        if (upload.userId.toString() !== context.userId) {
            console.log(`❌ Forbidden: user ${context.userId} doesn't own upload ${params.uploadId}`);
            return { error: 'Forbidden' };
        }

        console.log(`   Current status: ${upload.status}`);
        console.log(`   Current step: ${upload.currentStep}`);

        // Verify status is awaiting-approval
        if (upload.status !== 'awaiting-approval') {
            console.log(`❌ Upload ${params.uploadId} is not awaiting approval (status: ${upload.status})`);
            return { error: 'Upload is not awaiting approval' };
        }

        // Update database with approved errors
        // This signals the parser to continue
        console.log(`✅ Approving errors for ${params.uploadId}, changing status to 'parsing'`);
        await updateBookUpload(params.uploadId, {
            skippedValidationErrors: [
                ...upload.skippedValidationErrors,
                ...params.errors
            ],
            status: 'parsing' // Signal parser to continue
        });

        console.log(`✅ Approval complete for ${params.uploadId}`);

        return {
            success: true,
            message: 'Errors approved, parser will continue'
        };
    } catch (error) {
        console.error('Approve errors error:', error);
        return { error: 'Failed to approve errors' };
    }
}

