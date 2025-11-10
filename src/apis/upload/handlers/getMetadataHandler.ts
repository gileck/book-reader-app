import { getBookUpload } from '@/server/database/collections/bookUploads';
import { getFileAsString, getSignedFileUrl } from '@/server/s3/sdk';
import { VERCEL_BLOB_IMAGES_BASE_PATH } from '@/common/constants';
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

        // Extract cover image (first image from all chapters, sorted by filename)
        let coverImageUrl: string | undefined;
        if (metadata.imageBaseURL) {
            const allImageNames: string[] = [];
            
            // Collect all image names from all chapters
            for (const chapter of chapters) {
                if (chapter.chunks && Array.isArray(chapter.chunks)) {
                    for (const chunk of chapter.chunks) {
                        if (chunk.type === 'image' && chunk.imageName) {
                            allImageNames.push(chunk.imageName);
                        }
                    }
                }
            }
            
            if (allImageNames.length > 0) {
                // Sort by filename (numerically) to match upload-book.js logic
                allImageNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                
                // Pick first image as cover
                const firstImage = allImageNames[0];
                coverImageUrl = `${VERCEL_BLOB_IMAGES_BASE_PATH}${metadata.imageBaseURL}${firstImage}`;
                console.log('[getMetadata] Cover image:', coverImageUrl);
            }
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

