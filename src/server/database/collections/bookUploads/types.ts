import { ObjectId } from 'mongodb';

export type BookUploadStatus = 'uploading' | 'parsing' | 'awaiting-approval' | 'success' | 'failed' | 'timeout';

export interface SkippedValidationError {
    step: string;
    chunkId: string;
}

export interface ValidationError {
    step: string;
    message: string;
    errorCount?: number;
    chapterErrorSummary?: string[];
}

export interface UploadedImage {
    name: string; // Filename (e.g., "image-001-1.jpg")
    url: string; // Full Vercel Blob URL
    size: number; // Size in bytes
    blobKey: string; // Blob key for deletion (e.g., "books/BookTitle/images/image-001-1.jpg")
}

export interface BookUpload {
    _id: ObjectId;
    userId: ObjectId;
    pdfS3Key: string;
    fileName?: string; // Original PDF filename or URL
    status: BookUploadStatus;
    parserOutputS3Key?: string;
    skippedValidationErrors: SkippedValidationError[];
    validationErrors?: ValidationError[]; // Store actual validation errors for recovery
    currentStep?: string;
    currentStepNumber?: number;
    totalSteps?: number;
    progress?: number; // 0-100
    error?: {
        message: string;
        stack?: string;
        timestamp: Date;
    };
    bookId?: ObjectId;
    images?: UploadedImage[]; // Store uploaded image URLs to avoid list() operations
    imageBaseURL?: string; // Relative path for image base URL (e.g., "/BookTitle/images/")
    expiresAt: Date; // Automatic deletion time (24 hours from creation)
    createdAt: Date;
    updatedAt: Date;
}

export type BookUploadCreate = Omit<BookUpload, '_id' | 'createdAt' | 'updatedAt' | 'expiresAt'>;

export type BookUploadUpdate = Partial<Omit<BookUpload, '_id' | 'userId' | 'createdAt'>>;

export interface BookUploadFilter {
    _id?: ObjectId;
    userId?: ObjectId;
    status?: BookUploadStatus;
}

