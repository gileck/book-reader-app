import { getBookUpload } from '@/server/database/collections/bookUploads';
import { getFileAsString, getSignedFileUrl } from '@/server/s3/sdk';
import type { ApiHandlerContext, GetMetadataRequest, GetMetadataResponse } from '../types';

// TypeScript types for parser output
interface ParserMetadata {
    title?: string;
    author?: string;
    description?: string;
    language?: string;
    imageBaseURL?: string;
    chapterStartNumber?: number;
    totalChapters?: number;
    totalWords?: number;
    totalSentences?: number;
    totalParagraphs?: number;
    totalImages?: number;
    totalLinks?: number;
    averageWordsPerChapter?: number;
    averageWordsPerParagraph?: number;
}

interface ParserChunk {
    type: string;
    imageName?: string;
    imageAlt?: string;
    content?: string;
    text?: string;
}

interface ParserChapter {
    chapterNumber: number;
    title: string;
    content: unknown;
    wordCount?: number;
    chunks?: ParserChunk[];
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

export async function getMetadataHandler(
    params: GetMetadataRequest,
    context: ApiHandlerContext
): Promise<GetMetadataResponse> {
    try {
        if (!context.userId) {
            console.error('[getMetadata] Unauthorized - no userId');
            return { error: 'Unauthorized' };
        }

        // Get upload record
        const upload = await getBookUpload(params.uploadId);

        if (!upload) {
            console.error('[getMetadata] Upload not found:', params.uploadId);
            return { error: 'Upload not found' };
        }

        // Verify ownership
        if (upload.userId.toString() !== context.userId) {
            console.error('[getMetadata] Forbidden - userId mismatch');
            return { error: 'Forbidden' };
        }

        // Verify status is success
        if (upload.status !== 'success') {
            console.error('[getMetadata] Upload not successful, status:', upload.status);
            return { error: `Upload has not completed successfully (status: ${upload.status})` };
        }

        if (!upload.parserOutputS3Key) {
            console.error('[getMetadata] Parser output S3 key missing for upload:', params.uploadId);
            return { error: 'Parser output not found' };
        }

        console.log('[getMetadata] Fetching parser output from S3:', upload.parserOutputS3Key);

        // Download parser output from S3
        let parserOutputJson: string;
        try {
            parserOutputJson = await getFileAsString(upload.parserOutputS3Key);
        } catch (error) {
            if (error && typeof error === 'object' && 'Code' in error && error.Code === 'NoSuchKey') {
                console.error('[getMetadata] Parser output file not found in S3:', upload.parserOutputS3Key);
                return { 
                    error: 'Parser output file not found. The file may have been deleted or the upload did not complete successfully. Please try re-uploading the book.' 
                };
            }
            throw error; // Re-throw other errors
        }
        
        const parserOutput: ParserOutput = JSON.parse(parserOutputJson);

        console.log('[getMetadata] Parser output structure:', {
            success: parserOutput.success,
            hasFinalOutput: !!parserOutput.finalOutput,
            hasMetadata: !!parserOutput.finalOutput?.metadata,
            hasChapters: !!parserOutput.finalOutput?.chapters,
            chaptersLength: parserOutput.finalOutput?.chapters?.length
        });

        // Validate parser output structure
        if (!parserOutput.finalOutput) {
            console.error('[getMetadata] Parser output missing finalOutput');
            return { error: 'Invalid parser output: missing finalOutput' };
        }

        const { metadata, chapters } = parserOutput.finalOutput;

        if (!metadata) {
            console.error('[getMetadata] Parser output missing metadata');
            return { error: 'Invalid parser output: missing metadata' };
        }

        if (!chapters || !Array.isArray(chapters)) {
            console.error('[getMetadata] Parser output missing or invalid chapters');
            return { error: 'Invalid parser output: missing chapters' };
        }

        console.log('[getMetadata] Successfully loaded metadata:', {
            title: metadata.title,
            chapters: chapters.length,
            totalWords: metadata.totalWords,
            totalSentences: metadata.totalSentences,
            totalParagraphs: metadata.totalParagraphs,
            totalImages: metadata.totalImages,
            totalLinks: metadata.totalLinks
        });

        // Generate a signed URL for the parser output (valid for 1 hour)
        let parserOutputUrl: string | undefined;
        try {
            parserOutputUrl = await getSignedFileUrl(upload.parserOutputS3Key, 3600);
            console.log('[getMetadata] Generated signed URL for parser output');
        } catch (error) {
            console.error('[getMetadata] Failed to generate signed URL:', error);
            // Continue without the URL if generation fails
        }

        // Extract all images and cover image from database (stored during upload)
        // This avoids expensive list() operations on Vercel Blob
        let coverImageUrl: string | undefined;
        const images: Array<{ name: string; url: string; sizeKB?: number }> = [];
        
        if (upload.images && upload.images.length > 0) {
            console.log(`[getMetadata] Found ${upload.images.length} images in database`);
            
            // First image is the cover (sorted during upload)
            coverImageUrl = upload.images[0].url;
            console.log('[getMetadata] Cover image from database:', coverImageUrl);
            
            // Build full image list with URLs and sizes
            for (const img of upload.images) {
                let sizeKB: number | undefined;
                if (img.size) {
                    const kb = img.size / 1024;
                    if (kb < 0.1) {
                        sizeKB = 0.05; // Special marker for <0.1 KB
                    } else if (kb < 1) {
                        sizeKB = Math.round(kb * 10) / 10; // Round to 1 decimal place (0.1, 0.2, etc.)
                    } else {
                        sizeKB = Math.round(kb); // Round to nearest integer for >= 1 KB
                    }
                }
                
                images.push({
                    name: img.name,
                    url: img.url,
                    sizeKB
                });
            }
            
            console.log('[getMetadata] Total images from database:', images.length);
        } else {
            console.log('[getMetadata] No images found in database for this upload');
        }

        return {
            metadata: {
                title: metadata.title || 'Untitled Book',
                author: metadata.author,
                description: metadata.description,
                language: metadata.language,
                chapterCount: chapters.length,
                totalWordCount: metadata.totalWords,
                totalSentences: metadata.totalSentences,
                totalParagraphs: metadata.totalParagraphs,
                totalImages: metadata.totalImages,
                totalLinks: metadata.totalLinks,
                averageWordsPerChapter: metadata.averageWordsPerChapter,
                averageWordsPerParagraph: metadata.averageWordsPerParagraph,
                coverImageUrl, // Include cover image URL
                images: images.length > 0 ? images : undefined, // Include all images sorted by name
                chapters: chapters.map(ch => ({
                    number: ch.chapterNumber,
                    title: ch.title
                })),
                // Include S3 key for debugging
                parserOutputS3Key: upload.parserOutputS3Key,
                // Include signed URL for direct download
                parserOutputUrl
            }
        };
    } catch (error) {
        console.error('[getMetadata] Error:', error);
        console.error('[getMetadata] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('[getMetadata] Error message:', error instanceof Error ? error.message : String(error));
        return { error: `Failed to get metadata: ${error instanceof Error ? error.message : String(error)}` };
    }
}

