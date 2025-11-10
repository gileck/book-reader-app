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

interface ParserChapter {
    chapterNumber: number;
    title: string;
    content: unknown;
    wordCount?: number;
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
        const parserOutputJson = await getFileAsString(upload.parserOutputS3Key);
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
        return { error: 'Failed to get metadata' };
    }
}

