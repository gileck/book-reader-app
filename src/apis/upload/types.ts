// Upload API Types

// API Handler Context
export interface ApiHandlerContext {
    userId?: string;
    getCookieValue: (name: string) => string | undefined;
    setCookie: (name: string, value: string, options: Record<string, unknown>) => void;
    clearCookie: (name: string, options: Record<string, unknown>) => void;
}

export interface ValidationError {
    message: string;
    step: string;
    errorCount?: number;
    chapterErrorSummary?: string[];
}

export interface UploadItem {
    uploadId: string;
    status: 'uploading' | 'parsing' | 'awaiting-approval' | 'success' | 'failed' | 'timeout';
    createdAt: Date;
    fileName?: string;
    currentStep?: string;
    currentStepNumber?: number;
    totalSteps?: number;
    progress?: number;
    error?: string;
    validationErrors?: ValidationError[];
    hasValidationErrors?: boolean;
}

// List Uploads
export type ListUploadsRequest = Record<string, never>; // Empty object

export interface ListUploadsResponse {
    uploads?: UploadItem[];
    error?: string;
}

// Get Upload Status
export interface GetUploadStatusRequest {
    uploadId: string;
}

export interface GetUploadStatusResponse {
    upload?: UploadItem;
    error?: string;
}

// Approve Errors
export interface ApproveErrorsRequest {
    uploadId: string;
    errors: Array<{
        step: string;
        chunkId: string;
    }>;
}

export interface ApproveErrorsResponse {
    success?: boolean;
    message?: string;
    error?: string;
}

// Finalize Upload
export interface FinalizeUploadRequest {
    uploadId: string;
}

export interface FinalizeUploadResponse {
    success?: boolean;
    bookId?: string;
    error?: string;
}

// Delete Upload
export interface DeleteUploadRequest {
    uploadId: string;
}

export interface DeleteUploadResponse {
    success?: boolean;
    error?: string;
}

// Get Metadata
export interface GetMetadataRequest {
    uploadId: string;
}

export interface ParserMetadata {
    title: string;
    author?: string;
    description?: string;
    language?: string;
    chapterCount?: number;
    totalWordCount?: number;
    totalSentences?: number;
    totalParagraphs?: number;
    totalImages?: number;
    totalLinks?: number;
    averageWordsPerChapter?: number;
    averageWordsPerParagraph?: number;
    coverImageUrl?: string; // Vercel Blob URL for cover image
    images?: Array<{
        name: string; // Image filename
        url: string;  // Full Vercel Blob URL
    }>;
    chapters: Array<{
        number: number;
        title: string;
    }>;
    parserOutputS3Key?: string; // For debugging - S3 key path
    parserOutputUrl?: string; // For debugging - signed URL to download raw JSON
}

export interface GetMetadataResponse {
    metadata?: ParserMetadata;
    error?: string;
}

