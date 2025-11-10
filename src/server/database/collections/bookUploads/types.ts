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

