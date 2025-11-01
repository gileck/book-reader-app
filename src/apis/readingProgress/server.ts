import { ObjectId } from 'mongodb';
import {
    updateReadingPosition,
    findReadingProgressByUserAndBook,
    calculateBookProgress,
    getReadingStats
} from '../../server/database/collections/readingProgress';
import { findBookById } from '../../server/database/collections/books';
import { UPDATE_READING_POSITION_API_NAME, GET_READING_PROGRESS_API_NAME, GET_READING_STATS_API_NAME } from './index';
import type {
    UpdateReadingPositionRequest,
    UpdateReadingPositionResponse,
    GetReadingProgressRequest,
    GetReadingProgressResponse,
    GetReadingStatsRequest,
    GetReadingStatsResponse,
    ReadingProgressClient
} from './types';

export const readingProgressApis = {
    [UPDATE_READING_POSITION_API_NAME]: async (request: UpdateReadingPositionRequest): Promise<UpdateReadingPositionResponse> => {
        try {
            const { userId, bookId, currentChapter, currentChunk, wordsRead, sessionTimeMinutes } = request;

            // Validate ObjectId format
            if (!userId || !ObjectId.isValid(userId)) {
                return {
                    success: false,
                    error: `Invalid userId format: ${userId}`
                };
            }

            if (!bookId || !ObjectId.isValid(bookId)) {
                return {
                    success: false,
                    error: `Invalid bookId format: ${bookId}`
                };
            }

            // CRITICAL: Validate that currentChapter and currentChunk are not null/undefined
            if (currentChapter === null || currentChapter === undefined) {
                console.error('CRITICAL BUG: Attempt to save null currentChapter', {
                    userId,
                    bookId,
                    currentChapter,
                    currentChunk,
                    requestData: request
                });
                return {
                    success: false,
                    error: 'Unable to save reading progress: Invalid chapter position. Please try refreshing the page.'
                };
            }

            if (currentChunk === null || currentChunk === undefined) {
                console.error('CRITICAL BUG: Attempt to save null currentChunk', {
                    userId,
                    bookId,
                    currentChapter,
                    currentChunk,
                    requestData: request
                });
                return {
                    success: false,
                    error: 'Unable to save reading progress: Invalid chunk position. Please try refreshing the page.'
                };
            }

            // Validate that they are valid numbers
            if (typeof currentChapter !== 'number' || isNaN(currentChapter) || currentChapter < 0) {
                console.error('CRITICAL BUG: Invalid currentChapter value', {
                    userId,
                    bookId,
                    currentChapter,
                    currentChunk,
                    requestData: request
                });
                return {
                    success: false,
                    error: 'Unable to save reading progress: Invalid chapter number. Please try refreshing the page.'
                };
            }

            if (typeof currentChunk !== 'number' || isNaN(currentChunk) || currentChunk < 0) {
                console.error('CRITICAL BUG: Invalid currentChunk value', {
                    userId,
                    bookId,
                    currentChapter,
                    currentChunk,
                    requestData: request
                });
                return {
                    success: false,
                    error: 'Unable to save reading progress: Invalid chunk number. Please try refreshing the page.'
                };
            }

            // Validate currentChapter against book's chapterStartNumber
            const book = await findBookById(new ObjectId(bookId));
            if (book) {
                const bookStartChapter = book.chapterStartNumber ?? 1;
                if (currentChapter < bookStartChapter) {
                    console.error('CRITICAL BUG: Attempt to save invalid chapter for book', {
                        userId,
                        bookId,
                        currentChapter,
                        bookStartChapter,
                        bookTitle: book.title
                    });
                    return {
                        success: false,
                        error: `Unable to save reading progress: Chapter ${currentChapter} is invalid for this book (starts at chapter ${bookStartChapter}). Please try refreshing the page.`
                    };
                }
            }

            const result = await updateReadingPosition(
                new ObjectId(userId),
                new ObjectId(bookId),
                currentChapter,
                currentChunk,
                wordsRead,
                sessionTimeMinutes
            );

            if (!result) {
                return {
                    success: false,
                    error: 'Failed to update reading position. Please try again.'
                };
            }

            // Calculate enhanced progress information
            const { bookProgress, chapterProgress } = await calculateBookProgress(
                new ObjectId(bookId),
                currentChapter,
                currentChunk
            );

            const readingProgress: ReadingProgressClient = {
                userId: result.userId.toString(),
                bookId: result.bookId.toString(),
                currentChapter: result.currentChapter,
                currentChunk: result.currentChunk,
                lastReadAt: result.lastReadAt,
                chapterProgress,
                bookProgress,
                totalReadingTime: result.totalReadingTimeMinutes || 0,
                currentSessionTime: 0, // Will be calculated in frontend
                sessionsCount: result.sessionHistory?.length || 0
            };

            return {
                success: true,
                readingProgress
            };
        } catch (error) {
            console.error('Error updating reading position:', error);
            return {
                success: false,
                error: 'An unexpected error occurred while saving your reading progress. Please try again.'
            };
        }
    },

    [GET_READING_PROGRESS_API_NAME]: async (request: GetReadingProgressRequest): Promise<GetReadingProgressResponse> => {
        try {
            const { userId, bookId } = request;

            // Validate ObjectId format
            if (!userId || !ObjectId.isValid(userId)) {
                console.error('Invalid userId format:', userId);
                return {
                    success: false,
                    readingProgress: null,
                    error: 'Invalid user ID format'
                };
            }

            if (!bookId || !ObjectId.isValid(bookId)) {
                console.error('Invalid bookId format:', bookId);
                return {
                    success: false,
                    readingProgress: null,
                    error: 'Invalid book ID format'
                };
            }

            const result = await findReadingProgressByUserAndBook(
                new ObjectId(userId),
                new ObjectId(bookId)
            );

            if (!result) {
                return {
                    success: true,
                    readingProgress: null
                };
            }

            // Handle legacy data: default to chapter 1, chunk 0 if null values exist
            let currentChapter = result.currentChapter;
            let currentChunk = result.currentChunk;

            if (currentChapter === null || currentChapter === undefined) {
                console.warn('Found null currentChapter in database, defaulting to 1', {
                    userId,
                    bookId,
                    savedChapter: result.currentChapter,
                    savedChunk: result.currentChunk
                });
                currentChapter = 1;
            }

            if (currentChunk === null || currentChunk === undefined) {
                console.warn('Found null currentChunk in database, defaulting to 0', {
                    userId,
                    bookId,
                    savedChapter: result.currentChapter,
                    savedChunk: result.currentChunk
                });
                currentChunk = 0;
            }

            // OPTIMIZED: Return only position data without expensive progress calculations
            // For progress percentages, use getReadingStats API instead
            const readingProgress: ReadingProgressClient = {
                userId: result.userId.toString(),
                bookId: result.bookId.toString(),
                currentChapter: currentChapter,
                currentChunk: currentChunk,
                lastReadAt: result.lastReadAt,
                // bookProgress and chapterProgress are NOT included - use getReadingStats for that
                totalReadingTime: result.totalReadingTimeMinutes || 0,
                currentSessionTime: 0, // Will be calculated in frontend
                sessionsCount: result.sessionHistory?.length || 0
            };

            return {
                success: true,
                readingProgress
            };
        } catch (error) {
            console.error('Error getting reading progress:', error);
            return {
                success: false,
                readingProgress: null,
                error: 'An unexpected error occurred while loading your reading progress. Please try again.'
            };
        }
    },

    [GET_READING_STATS_API_NAME]: async (request: GetReadingStatsRequest): Promise<GetReadingStatsResponse> => {
        try {
            const { userId, bookId } = request;

            // Validate ObjectId format
            if (!userId || !ObjectId.isValid(userId)) {
                return {
                    success: false,
                    error: `Invalid userId format: ${userId}`
                };
            }

            if (!bookId || !ObjectId.isValid(bookId)) {
                return {
                    success: false,
                    error: `Invalid bookId format: ${bookId}`
                };
            }

            const stats = await getReadingStats(
                new ObjectId(userId),
                new ObjectId(bookId)
            );

            if (!stats) {
                return {
                    success: false,
                    error: 'Failed to get reading statistics'
                };
            }

            // Get reading progress for lastReadAt and currentChapter
            const progress = await findReadingProgressByUserAndBook(
                new ObjectId(userId),
                new ObjectId(bookId)
            );

            return {
                success: true,
                stats: {
                    ...stats,
                    currentChapter: progress?.currentChapter || 1,
                    lastReadAt: progress?.lastReadAt
                }
            };
        } catch (error) {
            console.error('Error getting reading stats:', error);
            return {
                success: false,
                error: 'An unexpected error occurred while loading reading statistics. Please try again.'
            };
        }
    }
}; 