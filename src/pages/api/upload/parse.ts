/* eslint-disable restrict-api-routes/no-direct-api-routes */
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import { createBookUpload, updateBookUpload } from '@/server/database/collections/bookUploads';
import { uploadFile } from '@/server/s3/sdk';
import { runParserWithSSE } from '@/server/parser/productionRunner';
import { getUserFromRequest } from '@/server/auth';

// Rate limiting map: userId -> { count, resetTime }
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_UPLOADS_PER_HOUR = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
        // Reset or create new entry
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (userLimit.count >= MAX_UPLOADS_PER_HOUR) {
        return false; // Rate limit exceeded
    }

    userLimit.count++;
    return true;
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb' // Allow large PDF uploads
        },
        responseLimit: false // Disable response buffering for SSE
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Flush headers immediately to start the stream
    res.flushHeaders();

    let uploadId: string | null = null;
    let user: { _id: string } | null = null;

    try {
        // Get authenticated user
        user = await getUserFromRequest(req);
        if (!user) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized' })}\n\n`);
            return res.end();
        }

        // Check rate limit
        if (!checkRateLimit(user._id)) {
            res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                message: `Rate limit exceeded. Maximum ${MAX_UPLOADS_PER_HOUR} uploads per hour.` 
            })}\n\n`);
            return res.end();
        }

        const { pdfBase64, pdfUrl } = req.body;

        // Validate input - either pdfBase64 or pdfUrl must be provided
        if (!pdfBase64 && !pdfUrl) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'PDF data or URL is required' })}\n\n`);
            return res.end();
        }

        // Send upload start event
        res.write(`data: ${JSON.stringify({ type: 'upload', progress: 0, message: pdfUrl ? 'Downloading PDF...' : 'Starting upload...' })}\n\n`);

        // Create upload ID as ObjectId (will be used for DB _id)
        const uploadObjectId = new ObjectId();
        uploadId = uploadObjectId.toString();
        
        // Create database record FIRST (with minimal data)
        await createBookUpload({
            _id: uploadObjectId,
            userId: new ObjectId(user._id),
            pdfS3Key: '', // Will update later
            status: 'uploading',
            skippedValidationErrors: [],
            fileName: req.body.fileName || pdfUrl || 'Unknown'
        });
        
        // NOW send uploadId so client can fetch the record
        res.write(`data: ${JSON.stringify({ type: 'upload', uploadId, progress: 5, message: 'Initializing...' })}\n\n`);
        
        let pdfBuffer: Buffer;

        if (pdfUrl) {
            // Download PDF from URL
            try {
                const urlResponse = await fetch(pdfUrl);
                
                if (!urlResponse.ok) {
                    throw new Error(`Failed to download PDF: ${urlResponse.statusText}`);
                }

                const contentType = urlResponse.headers.get('content-type');
                if (contentType && !contentType.includes('pdf')) {
                    throw new Error('URL does not point to a PDF file');
                }

                const arrayBuffer = await urlResponse.arrayBuffer();
                pdfBuffer = Buffer.from(arrayBuffer);

                if (pdfBuffer.length === 0) {
                    throw new Error('Downloaded PDF is empty');
                }

                res.write(`data: ${JSON.stringify({ type: 'upload', progress: 5, message: 'PDF downloaded' })}\n\n`);
            } catch (error) {
                throw new Error(`Failed to download PDF from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } else {
            // Use provided base64 PDF
            pdfBuffer = Buffer.from(pdfBase64, 'base64');
        }
        
        // Upload PDF to S3 with auto-delete tag (will be deleted after 1 day by S3 lifecycle rule)
        const pdfS3Key = await uploadFile({
            content: pdfBuffer,
            fileName: `users/${user._id}/uploads/${uploadId}.pdf`,
            contentType: 'application/pdf',
            autoDelete: true // Tag for S3 lifecycle auto-deletion
        });

        res.write(`data: ${JSON.stringify({ type: 'upload', progress: 10, message: 'PDF uploaded to S3' })}\n\n`);

        // Update database record with S3 key and parsing status
        await updateBookUpload(uploadId, {
            pdfS3Key,
            status: 'parsing'
        });

        res.write(`data: ${JSON.stringify({ type: 'upload', uploadId, progress: 15, message: 'Starting parser...' })}\n\n`);

        // Validate PDF magic number
        if (pdfBuffer.length < 4 || !pdfBuffer.toString('ascii', 0, 4).startsWith('%PDF')) {
            throw new Error('Invalid PDF file format');
        }

        // Write buffer directly to temp location (no need to download from S3)
        const tempPdfPath = `/tmp/${uploadId}.pdf`;
        const tempOutputPath = `/tmp/${uploadId}-output`;

        fs.writeFileSync(tempPdfPath, pdfBuffer);

        // Create output directory
        if (!fs.existsSync(tempOutputPath)) {
            fs.mkdirSync(tempOutputPath, { recursive: true });
        }

        // Run parser with SSE
        await runParserWithSSE(uploadId, user._id, tempPdfPath, tempOutputPath, res);

        // Cleanup temp files
        try {
            if (fs.existsSync(tempPdfPath)) {
                fs.unlinkSync(tempPdfPath);
            }
            if (fs.existsSync(tempOutputPath)) {
                fs.rmSync(tempOutputPath, { recursive: true, force: true });
            }
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }

        res.end();

    } catch (error) {
        console.error('Parse API error:', error);
        
        // Update DB with failure status if we have an uploadId
        try {
            if (uploadId) {
                await createBookUpload({
                    userId: new ObjectId(user?._id || ''),
                    pdfS3Key: '',
                    status: 'failed',
                    skippedValidationErrors: [],
                    error: {
                        message: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                        timestamp: new Date()
                    }
                });
            }
        } catch (dbError) {
            console.error('Failed to save error to DB:', dbError);
        }
        
        res.write(`data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            // Only send stack in development
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
        })}\n\n`);
        
        res.end();
    }
}

