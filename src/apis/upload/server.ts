// Server-side implementations - re-export API names from index
export * from './index';

import type {
    ApiHandlerContext,
    ListUploadsRequest,
    ListUploadsResponse,
    GetUploadStatusRequest,
    GetUploadStatusResponse,
    ApproveErrorsRequest,
    ApproveErrorsResponse,
    FinalizeUploadRequest,
    FinalizeUploadResponse,
    DeleteUploadRequest,
    DeleteUploadResponse,
    GetMetadataRequest,
    GetMetadataResponse
} from './types';

import { listUploadsHandler } from './handlers/listUploadsHandler';
import { getUploadStatusHandler } from './handlers/getUploadStatusHandler';
import { approveErrorsHandler } from './handlers/approveErrorsHandler';
import { finalizeUploadHandler } from './handlers/finalizeUploadHandler';
import { deleteUploadHandler } from './handlers/deleteUploadHandler';
import { getMetadataHandler } from './handlers/getMetadataHandler';

export async function listUploads(
    params: ListUploadsRequest,
    context: ApiHandlerContext
): Promise<ListUploadsResponse> {
    return listUploadsHandler(params, context);
}

export async function getUploadStatus(
    params: GetUploadStatusRequest,
    context: ApiHandlerContext
): Promise<GetUploadStatusResponse> {
    return getUploadStatusHandler(params, context);
}

export async function approveErrors(
    params: ApproveErrorsRequest,
    context: ApiHandlerContext
): Promise<ApproveErrorsResponse> {
    return approveErrorsHandler(params, context);
}

export async function finalizeUpload(
    params: FinalizeUploadRequest,
    context: ApiHandlerContext
): Promise<FinalizeUploadResponse> {
    return finalizeUploadHandler(params, context);
}

export async function deleteUpload(
    params: DeleteUploadRequest,
    context: ApiHandlerContext
): Promise<DeleteUploadResponse> {
    return deleteUploadHandler(params, context);
}

export async function getMetadata(
    params: GetMetadataRequest,
    context: ApiHandlerContext
): Promise<GetMetadataResponse> {
    return getMetadataHandler(params, context);
}

