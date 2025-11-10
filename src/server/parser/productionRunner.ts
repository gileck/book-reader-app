import { NextApiResponse } from 'next/types';
import { getBookUpload, updateBookUpload } from '../database/collections/bookUploads';
import { uploadFile } from '../s3/sdk';
import { put } from '@vercel/blob';
import * as fs from 'fs';
import * as path from 'path';

// Import parser (CommonJS module)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const parser = require('../../../book-parser/parser/parser');

/**
 * Upload a file to Vercel Blob
 */
async function uploadFileToBlob(key: string, content: Buffer, contentType: string): Promise<string> {
    const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
    }

    const blob = await put(key, content, {
        access: 'public',
        contentType: contentType || 'application/octet-stream',
        token: BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true // Allow overwriting existing blobs
    });

    return blob.url;
}

/**
 * Get content type based on file extension
 */
function getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return types[ext] || 'application/octet-stream';
}

// TypeScript types for parser output
interface ParserMetadata {
    title?: string;
    author?: string;
    description?: string;
    language?: string;
    imageBaseURL?: string;
    chapterStartNumber?: number;
}

interface ParserChapter {
    chapterNumber: number;
    title: string;
    content: unknown;
    wordCount?: number;
    chunks?: unknown[];
}

interface ParserFinalOutput {
    metadata: ParserMetadata;
    chapters: ParserChapter[];
}

interface ParserOutput {
    success: boolean;
    outputDir: string;
    finalOutput: ParserFinalOutput;
    validationResults?: unknown;
    totalDuration?: number;
}

/**
 * Wait for user approval of validation errors
 * Polls the database with exponential backoff
 */
async function waitForApproval(uploadId: string, timeoutSeconds: number = 300): Promise<boolean> {
    const startTime = Date.now();
    const timeout = timeoutSeconds * 1000;
    let backoffDelay = 2000; // Start with 2 seconds
    let pollCount = 0;

    console.log(`⏳ Waiting for approval of uploadId ${uploadId} (timeout: ${timeoutSeconds}s)`);

    while (Date.now() - startTime < timeout) {
        pollCount++;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        // Poll database
        const upload = await getBookUpload(uploadId);
        
        if (!upload) {
            console.log(`❌ Upload ${uploadId} not found (poll #${pollCount})`);
            return false; // Upload deleted or doesn't exist
        }

        console.log(`📊 Poll #${pollCount} (${elapsedSeconds}s elapsed): status=${upload.status}`);

        // Check if status changed back to 'parsing' (approval signal)
        if (upload.status === 'parsing') {
            console.log(`✅ Approval detected for ${uploadId} after ${elapsedSeconds}s (${pollCount} polls)`);
            return true;
        }

        // Check if explicitly failed/cancelled
        if (upload.status === 'failed') {
            console.log(`❌ Upload ${uploadId} marked as failed during wait`);
            return false;
        }

        // Wait with exponential backoff (2s, 4s, 8s, 16s, 16s...)
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        backoffDelay = Math.min(backoffDelay * 2, 16000); // Cap at 16 seconds
    }

    // Timeout
    console.log(`⏱️ Approval timeout for ${uploadId} after ${pollCount} polls (${timeoutSeconds}s)`);
    return false;
}

/**
 * Send SSE event to client
 */
function sendSSE(res: NextApiResponse, data: Record<string, unknown>): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Flush the response to ensure immediate delivery
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (res as any).flush === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res as any).flush();
    }
}

/**
 * Run parser with SSE progress streaming and DB integration
 * 
 * @param uploadId - Upload ID from database
 * @param userId - User ID
 * @param pdfPath - Local path to PDF file
 * @param outputPath - Local path for parser output
 * @param res - Next.js API response object for SSE
 */
export async function runParserWithSSE(
    uploadId: string,
    userId: string,
    pdfPath: string,
    outputPath: string,
    res: NextApiResponse
): Promise<void> {
    // Send initial event with uploadId
    sendSSE(res, {
        type: 'start',
        uploadId,
        message: 'Starting parser...'
    });

    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
        try {
            sendSSE(res, { type: 'heartbeat' });
        } catch {
            // Connection might be closed
            clearInterval(heartbeatInterval);
        }
    }, 15000); // Every 15 seconds

    try {
        // Skip errors provider - loads from database, filtered by step
        const skipErrorsProvider = async (stepName: string) => {
            const upload = await getBookUpload(uploadId);
            // Filter errors to only return those for the current step
            return (upload?.skippedValidationErrors || []).filter(err => err.step === stepName);
        };

        // Validation error handler - pause and wait for user approval
        const onValidationError = async (stepName: string, errorDetails: {
            step: string;
            errorCount: number;
            validationOutput: string;
            chapterErrorSummary?: string[] | null;
        }) => {
            console.log(`❌ onValidationError called: ${stepName} - ${errorDetails.errorCount} errors`);
            
            // Parse errors from validation output to send to client
            const errorLines = errorDetails.validationOutput.split('\n');
            const errors = [];
            
            for (const line of errorLines) {
                const match = line.match(/^\s*\d+\.\s+(.*)/);
                if (match) {
                    errors.push({
                        message: match[1],
                        step: stepName
                    });
                }
            }

            // Send validation error event to client
            sendSSE(res, {
                type: 'validation-error',
                uploadId, // Include uploadId in event
                step: stepName,
                errorCount: errorDetails.errorCount,
                errors: errors.slice(0, 10), // Send first 10 errors to avoid overwhelming client
                chapterErrorSummary: errorDetails.chapterErrorSummary
            });

            // Update DB status to awaiting-approval with full validation errors
            await updateBookUpload(uploadId, {
                status: 'awaiting-approval',
                currentStep: stepName,
                validationErrors: errors.map(err => ({
                    step: err.step,
                    message: err.message,
                    errorCount: errorDetails.errorCount,
                    chapterErrorSummary: errorDetails.chapterErrorSummary || undefined
                }))
            });

            console.log(`⏳ Waiting for user approval for ${stepName}...`);

            // Wait for user approval (5 minutes timeout)
            const approved = await waitForApproval(uploadId, 300);

            if (approved) {
                console.log(`✓ User approved errors for ${stepName}`);
                // Send resume event
                sendSSE(res, {
                    type: 'step-resume',
                    uploadId, // Include uploadId in event
                    step: stepName,
                    message: 'Continuing with approved errors...'
                });
                return true; // Continue parsing
            }

            console.log(`✗ User did not approve errors for ${stepName} (timeout or rejection)`);
            
            // Update status to 'failed' since approval timed out
            await updateBookUpload(uploadId, {
                status: 'failed',
                error: {
                    message: `Validation error approval timed out for ${stepName}`,
                    timestamp: new Date()
                }
            });
            
            // Not approved or timed out
            sendSSE(res, {
                type: 'error',
                uploadId, // Include uploadId in event
                message: 'Validation error approval timed out or was rejected'
            });
            return false; // Abort parsing
        };

        // Step start handler
        const onStepStart = async (stepName: string, stepNumber: number, totalSteps: number) => {
            console.log(`🎬 onStepStart called: ${stepName} (${stepNumber}/${totalSteps})`);
            
            // Reserve 15% for post-parser steps (image upload: 5%, S3 save: 5%, finalization: 5%)
            // So parser steps go from 0% to 85%
            const progress = Math.round((stepNumber / totalSteps) * 85);
            
            sendSSE(res, {
                type: 'step-start',
                uploadId, // Include uploadId in event
                step: stepName,
                stepNumber,
                totalSteps,
                progress,
                message: `Starting ${stepName}...`
            });

            await updateBookUpload(uploadId, {
                currentStep: stepName,
                currentStepNumber: stepNumber,
                totalSteps,
                progress,
                status: 'parsing'
            });
        };

        // Step progress handler
        const onStepProgress = async (stepName: string, percentage: number) => {
            console.log(`📈 onStepProgress called: ${stepName} - ${percentage}%`);
            
            sendSSE(res, {
                type: 'step-progress',
                uploadId, // Include uploadId in event
                step: stepName,
                progress: percentage
            });
        };

        // Step complete handler
        const onStepComplete = async (stepName: string) => {
            console.log(`✅ onStepComplete called: ${stepName}`);
            
            sendSSE(res, {
                type: 'step-complete',
                uploadId, // Include uploadId in event
                step: stepName,
                message: `${stepName} completed`
            });
        };

        // Run parser
        console.log(`🚀 Starting parser.parseBook for uploadId: ${uploadId}`);
        console.log(`   PDF path: ${pdfPath}`);
        console.log(`   Output path: ${outputPath}`);
        console.log(`   Options:`, { validate: true, debug: false, useCache: false });
        
        const result = await parser.parseBook(pdfPath, outputPath, {
            validate: true,
            debug: false,
            useCache: false, // Don't use cache in production
            skipErrorsProvider,
            onValidationError,
            onStepStart,
            onStepProgress,
            onStepComplete
        }) as ParserOutput;

        console.log(`✅ Parser completed successfully for uploadId: ${uploadId}`);

        // Notify user: Uploading images (parser finished at 85%, now continue to 90%)
        sendSSE(res, {
            type: 'finalizing',
            uploadId, // Include uploadId in event
            message: 'Uploading images...',
            progress: 87
        });

        await updateBookUpload(uploadId, {
            currentStep: 'Uploading images...',
            progress: 87,
            status: 'parsing'
        });

        // Upload images to Vercel Blob if they exist
        const imagesDir = path.join(result.outputDir, 'images');
        let imageBaseURL = '';
        
        if (fs.existsSync(imagesDir)) {
            console.log(`📸 Uploading images from: ${imagesDir}`);
            const imageFiles = fs.readdirSync(imagesDir).filter(file => 
                /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
            );
            
            // Sort image files by filename (numerically) to ensure deterministic cover selection
            // This matches the logic in upload-book.js
            imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            
            if (imageFiles.length > 0) {
                console.log(`   Found ${imageFiles.length} images to upload to Vercel Blob`);
                
                // Get book title from parser output for folder naming
                const bookTitle = result.finalOutput?.metadata?.title || 'Unknown-Book';
                const bookFolderName = bookTitle.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
                const blobPrefix = `books/${bookFolderName}/images/`;
                
                // Upload each image to Vercel Blob
                const uploadPromises = imageFiles.map(async (filename) => {
                    const filePath = path.join(imagesDir, filename);
                    const fileContent = fs.readFileSync(filePath);
                    const contentType = getContentType(filename);
                    const blobKey = `${blobPrefix}${filename}`;
                    
                    console.log(`   📤 Uploading to Vercel Blob: ${filename}`);
                    
                    await uploadFileToBlob(blobKey, fileContent, contentType);
                    
                    console.log(`   ✓ Uploaded: ${filename}`);
                });
                
                await Promise.all(uploadPromises);
                
                // Set imageBaseURL as relative path (Vercel Blob format)
                imageBaseURL = `/${bookFolderName}/images/`;
                console.log(`✅ Uploaded ${imageFiles.length} images to Vercel Blob`);
                console.log(`   Image base URL: ${imageBaseURL}`);
            } else {
                console.log(`   No image files found in ${imagesDir}`);
            }
        } else {
            console.log(`   No images directory found at ${imagesDir}`);
        }

            // Notify user: Saving parser output (continue from 87% to 93%)
            sendSSE(res, {
                type: 'finalizing',
                uploadId, // Include uploadId in event
                message: 'Saving parser output...',
                progress: 93
            });

            await updateBookUpload(uploadId, {
                currentStep: 'Saving parser output...',
                progress: 93,
                status: 'parsing'
            });

        // Save parser output to S3 with imageBaseURL
        console.log(`💾 Saving parser output to S3 for uploadId: ${uploadId}`);
        
        // Add imageBaseURL to metadata if images were uploaded
        if (imageBaseURL && result.finalOutput?.metadata) {
            result.finalOutput.metadata.imageBaseURL = imageBaseURL;
        }
        
        const outputJson = JSON.stringify(result, null, 2);
        console.log(`📏 Parser output JSON size: ${(outputJson.length / 1024).toFixed(2)} KB`);
        
        const fileName = `users/${userId}/parser-output/${uploadId}/output.json`;
        console.log(`📤 Uploading to S3 with fileName: ${fileName}`);
        
        const s3Key = await uploadFile({
            content: outputJson,
            fileName: fileName,
            contentType: 'application/json',
            autoDelete: true // Tag for S3 lifecycle auto-deletion
        });
        console.log(`✅ Parser output saved to S3: ${s3Key}`);
        console.log(`🔍 S3 key will be stored in database: ${s3Key}`);

        // Notify user: Finalizing
        sendSSE(res, {
            type: 'finalizing',
            uploadId, // Include uploadId in event
            message: 'Finalizing upload...',
            progress: 98
        });

        await updateBookUpload(uploadId, {
            currentStep: 'Finalizing upload...',
            progress: 97,
            status: 'parsing'
        });

        // Update database with S3 key and success status (100% complete!)
        console.log(`📝 Updating database with success status for uploadId: ${uploadId}`);
        await updateBookUpload(uploadId, {
            parserOutputS3Key: s3Key,
            currentStep: 'Complete',
            progress: 100,
            status: 'success'
        });

        console.log(`🎉 Upload ${uploadId} completed successfully!`);

        // Send completion event
        sendSSE(res, {
            type: 'complete',
            uploadId,
            s3Key,
            message: 'Parser completed successfully'
        });

        // Clear heartbeat interval
        clearInterval(heartbeatInterval);

    } catch (error) {
        // Clear heartbeat interval
        clearInterval(heartbeatInterval);

        // Check if this upload already has validation errors saved
        const existingUpload = await getBookUpload(uploadId);
        const hasValidationErrors = existingUpload?.validationErrors && existingUpload.validationErrors.length > 0;

        // Check if this is a validation error (user needs to approve)
        const isValidationError = error instanceof Error && error.message.includes('validation failed');
        
        // If validation errors exist and this is a validation failure, keep status as awaiting-approval
        // Otherwise, mark as failed
        const newStatus = (hasValidationErrors && isValidationError) ? 'awaiting-approval' : 'failed';

        console.log(`❌ Parser error for uploadId ${uploadId}:`, {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            hasValidationErrors,
            isValidationError,
            newStatus
        });

        // Update database with error, preserving validation errors and status
        await updateBookUpload(uploadId, {
            status: newStatus,
            error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                timestamp: new Date()
            },
            // Preserve validation errors if they exist
            ...(hasValidationErrors ? { validationErrors: existingUpload.validationErrors } : {})
        });

        // Send error event (no stack in production)
        sendSSE(res, {
            type: 'error',
            uploadId, // Include uploadId in event
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
        });

        throw error;
    }
}

