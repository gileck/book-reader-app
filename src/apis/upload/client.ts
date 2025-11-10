// Client-side API calls - import API names from index (NEVER from server.ts)
import {
    LIST_UPLOADS,
    GET_UPLOAD_STATUS,
    APPROVE_ERRORS,
    FINALIZE_UPLOAD,
    DELETE_UPLOAD,
    GET_METADATA
} from './index';

import apiClient from '@/client/utils/apiClient';
import type {
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

export function listUploads(params: ListUploadsRequest = {}) {
    return apiClient.call<ListUploadsResponse, ListUploadsRequest>(LIST_UPLOADS, params);
}

export function getUploadStatus(params: GetUploadStatusRequest) {
    return apiClient.call<GetUploadStatusResponse, GetUploadStatusRequest>(GET_UPLOAD_STATUS, params);
}

export function approveErrors(params: ApproveErrorsRequest) {
    return apiClient.call<ApproveErrorsResponse, ApproveErrorsRequest>(APPROVE_ERRORS, params);
}

export function finalizeUpload(params: FinalizeUploadRequest) {
    return apiClient.call<FinalizeUploadResponse, FinalizeUploadRequest>(FINALIZE_UPLOAD, params);
}

export function deleteUpload(params: DeleteUploadRequest) {
    return apiClient.call<DeleteUploadResponse, DeleteUploadRequest>(DELETE_UPLOAD, params);
}

export function getMetadata(params: GetMetadataRequest) {
    return apiClient.call<GetMetadataResponse, GetMetadataRequest>(GET_METADATA, params);
}

