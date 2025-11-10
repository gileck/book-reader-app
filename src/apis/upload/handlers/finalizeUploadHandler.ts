import { ObjectId } from 'mongodb';
import { getBookUpload, deleteBookUpload } from '@/server/database/collections/bookUploads';
import { createBook } from '@/server/database/collections/books/books';
import { createChapter } from '@/server/database/collections/chapters/chapters';
import { deleteBook } from '@/server/database/collections/books/books';
import { getFileAsString, deleteFile } from '@/server/s3/sdk';
import type { ApiHandlerContext, FinalizeUploadRequest, FinalizeUploadResponse } from '../types';

// TypeScript types for parser output
interface ParserMetadata {
    title?: string;
    author?: string;
    description?: string;
    language?: string;
    imageBaseURL?: string;
    chapterStartNumber?: number;
    totalWords?: number;
    totalSentences?: number;
    totalParagraphs?: number;
    totalImages?: number;
    totalLinks?: number;
}

interface ParserChunk {
    type: 'paragraph' | 'text' | 'header' | 'image';
    content?: string;
    text?: string;
    wordCount?: number;
    pageNumber?: number;
    sentenceCount?: number;
    paragraphIndex?: number;
    imageName?: string;
    imageAlt?: string;
    links?: Array<{
        text: string;
        targetPageNumber?: number;
        targetText?: string;
        linkId: string;
        role: 'source' | 'target';
        targetChunkId?: string;
        sourceChunkId?: string;
        targetChunk?: number;
        chapterNumber?: number;
    }>;
}

interface ParserChapter {
    chapterNumber: number;
    title: string;
    content?: unknown;
    wordCount?: number;
    chunks: ParserChunk[];
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

export async function finalizeUploadHandler(
    params: FinalizeUploadRequest,
    context: ApiHandlerContext
): Promise<FinalizeUploadResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        // Get upload record
        const upload = await getBookUpload(params.uploadId);

        if (!upload) {
            return { error: 'Upload not found' };
        }

        // Verify ownership
        if (upload.userId.toString() !== context.userId) {
            return { error: 'Forbidden' };
        }

        // Verify status is success
        if (upload.status !== 'success') {
            return { error: 'Upload has not completed successfully' };
        }

        if (!upload.parserOutputS3Key) {
            return { error: 'Parser output not found' };
        }

        // Download parser output from S3
        const parserOutputJson = await getFileAsString(upload.parserOutputS3Key);
        const parserOutput: ParserOutput = JSON.parse(parserOutputJson);

        if (!parserOutput.finalOutput) {
            return { error: 'Invalid parser output: missing finalOutput' };
        }

        const { metadata, chapters } = parserOutput.finalOutput;

        let createdBookId: ObjectId | null = null;

        try {
            // Find the first image (sorted by filename) to use as cover
            // This matches the logic in upload-book.js and getMetadataHandler.ts
            let coverImage: string | undefined;
            
            // Collect all image names from all chapters
            const allImageNames: string[] = [];
            for (const chapter of chapters) {
                if (chapter.chunks && Array.isArray(chapter.chunks)) {
                    for (const chunk of chapter.chunks) {
                        const c = chunk as { type?: string; imageName?: string };
                        if (c.type === 'image' && c.imageName) {
                            allImageNames.push(c.imageName);
                        }
                    }
                }
            }
            
            // Sort by filename (numerically) and pick the first one
            if (allImageNames.length > 0) {
                allImageNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                const firstImage = allImageNames[0];
                const baseURL = metadata.imageBaseURL || '';
                coverImage = baseURL ? `${baseURL}${firstImage}` : undefined;
                console.log(`[finalizeUpload] Selected cover image: ${coverImage} (from ${allImageNames.length} total images)`);
            }

            // Create book
            const book = await createBook({
                title: metadata.title || 'Untitled Book',
                author: metadata.author || 'Unknown Author',
                description: metadata.description || '',
                coverImage,
                totalChapters: chapters.length,
                totalWords: metadata.totalWords || chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0),
                language: metadata.language || 'en-US',
                imageBaseURL: metadata.imageBaseURL || '',
                isPublic: false,
                uploadedBy: new ObjectId(context.userId),
                chapterStartNumber: metadata.chapterStartNumber || 1,
                parserVersion: 2, // Parser v2
                createdAt: new Date(),
                updatedAt: new Date()
            });

            createdBookId = book._id;

            // Convert parser chapters to database format (following upload-book.js logic)
            const chaptersToInsert = chapters.map(chapter => {
                const convertedChunks = chapter.chunks.map((chunk, index) => {
                    // Map parser types to database schema types
                    let dbType: 'text' | 'image' | 'header' = 'text'; // default
                    if (chunk.type === 'paragraph' || chunk.type === 'text') {
                        dbType = 'text';
                    } else if (chunk.type === 'header') {
                        dbType = 'header';
                    } else if (chunk.type === 'image') {
                        dbType = 'image';
                    }

                    return {
                        index: index,
                        // Database uses 'text' field, parser uses 'content' - map it correctly
                        text: chunk.content || chunk.text || (chunk.type === 'image' ? chunk.imageAlt || '' : ''),
                        wordCount: chunk.wordCount || 0,
                        type: dbType,
                        ...(chunk.pageNumber !== undefined && { pageNumber: chunk.pageNumber }),
                        ...(chunk.sentenceCount !== undefined && { sentenceCount: chunk.sentenceCount }),
                        ...(chunk.paragraphIndex !== undefined && { paragraphIndex: chunk.paragraphIndex }),
                        ...(chunk.links && chunk.links.length > 0 && {
                            links: chunk.links.map(link => ({
                                text: link.text,
                                targetPageNumber: link.targetPageNumber,
                                targetText: link.targetText,
                                linkId: link.linkId,
                                role: link.role,
                                // NEW: Step 5.1 chunk references
                                ...(link.targetChunkId && { targetChunkId: link.targetChunkId }),
                                ...(link.sourceChunkId && { sourceChunkId: link.sourceChunkId }),
                                // Legacy fields for compatibility
                                ...(link.targetChunk !== undefined && { targetChunk: link.targetChunk }),
                                ...(link.chapterNumber !== undefined && { chapterNumber: link.chapterNumber })
                            }))
                        }),
                        ...(chunk.imageName && { imageName: chunk.imageName }),
                        ...(chunk.imageAlt && { imageAlt: chunk.imageAlt })
                    };
                });

                return {
                    bookId: book._id,
                    chapterNumber: chapter.chapterNumber,
                    title: chapter.title || `Chapter ${chapter.chapterNumber}`,
                    content: {
                        chunks: convertedChunks
                    },
                    wordCount: convertedChunks.reduce((sum, chunk) => sum + (chunk.wordCount || 0), 0),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            });

            // Create all chapters in parallel for better performance
            await Promise.all(
                chaptersToInsert.map(chapter => createChapter(chapter))
            );

            // Images are already uploaded to Vercel Blob in the correct location
            // during parsing (productionRunner.ts), so no need to move them.
            // The imageBaseURL from parser output is already in the correct format.
            console.log(`📸 Images already uploaded to Vercel Blob: ${metadata.imageBaseURL || 'none'}`);

            // Clean up upload artifacts (PDF, parser output, and upload record)
            // NOTE: Images are NOT deleted - they're already in the correct Vercel Blob location
            // for the library book (books/BookTitle/images/) and are referenced by the book record
            console.log(`🧹 Cleaning up upload artifacts for uploadId: ${params.uploadId}...`);
            const cleanupPromises: Promise<void>[] = [];
            
            // Delete PDF from S3
            if (upload.pdfS3Key) {
                cleanupPromises.push(
                    deleteFile(upload.pdfS3Key).catch(err => {
                        console.error(`Failed to delete upload PDF ${upload.pdfS3Key}:`, err);
                    })
                );
            }
            
            // Delete parser output from S3
            if (upload.parserOutputS3Key) {
                cleanupPromises.push(
                    deleteFile(upload.parserOutputS3Key).catch(err => {
                        console.error(`Failed to delete parser output ${upload.parserOutputS3Key}:`, err);
                    })
                );
            }
            
            // Wait for all file deletions to complete
            await Promise.all(cleanupPromises);
            console.log(`✅ Upload artifacts cleaned up (PDF, parser output)`);
            console.log(`📸 Images kept in Vercel Blob at: ${metadata.imageBaseURL || 'N/A'} (used by library book)`);
            
            // Delete the upload record from database
            try {
                await deleteBookUpload(params.uploadId);
                console.log(`✅ Deleted upload record: ${params.uploadId}`);
            } catch (err) {
                console.error(`Failed to delete upload record ${params.uploadId}:`, err);
                // Don't throw - book was created successfully, this is just cleanup
            }

            return {
                success: true,
                bookId: book._id.toString()
            };

        } catch (creationError) {
            // Rollback: delete the book if it was created
            if (createdBookId) {
                try {
                    await deleteBook(createdBookId.toString());
                    console.log(`Rolled back book creation: ${createdBookId}`);
                } catch (rollbackError) {
                    console.error('Failed to rollback book creation:', rollbackError);
                }
            }
            throw creationError;
        }

    } catch (error) {
        console.error('Finalize upload error:', error);
        return { error: 'Failed to finalize upload' };
    }
}

