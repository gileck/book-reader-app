/* eslint-disable restrict-api-routes/no-direct-api-routes */
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { getUserFromRequest } from '@/server/auth';
import { findBookById } from '@/server/database/collections/books/books';
import { findChapterByBookAndNumber } from '@/server/database/collections/chapters/chapters';
import type { SearchResultItem, SearchChapterEvent } from '@/apis/search/types';

export const config = {
    api: {
        responseLimit: false // Disable response buffering for SSE
    }
};

/**
 * Send SSE event to client
 */
function sendSSE(res: NextApiResponse, data: SearchChapterEvent): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Flush the response to ensure immediate delivery
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (res as any).flush === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res as any).flush();
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Flush headers immediately to start the stream
    res.flushHeaders();

    try {
        // Get authenticated user
        const user = await getUserFromRequest(req);
        if (!user) {
            sendSSE(res, { type: 'error', error: 'Unauthorized' });
            res.end();
            return;
        }

        const { bookId, query } = req.body;

        // Validate query
        if (!query || !query.trim()) {
            sendSSE(res, { type: 'error', error: 'Search query is required' });
            res.end();
            return;
        }

        // Validate bookId
        if (!bookId) {
            sendSSE(res, { type: 'error', error: 'Book ID is required' });
            res.end();
            return;
        }

        // Get book metadata
        const book = await findBookById(new ObjectId(bookId));
        if (!book) {
            sendSSE(res, { type: 'error', error: 'Book not found' });
            res.end();
            return;
        }

        // Check user has access to book
        if (!book.isPublic && (!book.uploadedBy || book.uploadedBy.toString() !== user._id)) {
            sendSSE(res, { type: 'error', error: 'Access denied' });
            res.end();
            return;
        }

        const lowerQuery = query.toLowerCase();
        const totalChapters = book.totalChapters;
        const chapterStartNumber = book.chapterStartNumber || 1;
        let searchedChapters = 0;

        // Iterate through all chapters
        for (let chapterNum = chapterStartNumber; 
             chapterNum < chapterStartNumber + totalChapters; 
             chapterNum++) {
            
            try {
                // Fetch chapter
                const chapter = await findChapterByBookAndNumber(bookId, chapterNum);
                
                if (!chapter) {
                    searchedChapters++;
                    continue; // Skip missing chapters
                }

                // Send chapter-start event
                sendSSE(res, {
                    type: 'chapter-start',
                    chapterNumber: chapter.chapterNumber,
                    chapterTitle: chapter.title,
                    totalChapters,
                    searchedChapters
                });

                // Search this chapter's chunks
                const matches: SearchResultItem[] = [];
                
                for (const chunk of chapter.content.chunks) {
                    // Only search text and header chunks
                    if ((chunk.type === 'text' || chunk.type === 'header') &&
                        chunk.text.toLowerCase().includes(lowerQuery)) {
                        
                        matches.push({
                            chunkIndex: chunk.index,
                            text: chunk.text,
                            type: chunk.type,
                            chapterNumber: chapter.chapterNumber,
                            chapterTitle: chapter.title
                        });
                    }
                }

                // Send results if any matches found
                if (matches.length > 0) {
                    sendSSE(res, {
                        type: 'results',
                        chapterNumber: chapter.chapterNumber,
                        chapterTitle: chapter.title,
                        results: matches
                    });
                }

                searchedChapters++;
            } catch (error) {
                console.error(`Error searching chapter ${chapterNum}:`, error);
                // Continue with next chapter - don't abort entire search
                searchedChapters++;
                sendSSE(res, {
                    type: 'error',
                    error: `Error searching chapter ${chapterNum}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    chapterNumber: chapterNum
                });
            }
        }

        // Send completion event
        sendSSE(res, {
            type: 'complete',
            totalChapters,
            searchedChapters
        });

        res.end();
    } catch (error) {
        console.error('Search all chapters error:', error);
        sendSSE(res, {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
        res.end();
    }
}

