import { ObjectId } from 'mongodb';
import {
    updateReadingPosition,
    findReadingProgressByUserAndBook,
    calculateBookProgress,
    getReadingStats
} from '../../server/database/collections/readingProgress';
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

            const result = await updateReadingPosition(
                new ObjectId(userId),
                new ObjectId(bookId),
                currentChapter,
                currentChunk,
                wordsRead,
                sessionTimeMinutes
            );

            if (!result) {
                throw new Error('Failed to update reading position');
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
            throw error;
        }
    },

    [GET_READING_PROGRESS_API_NAME]: async (request: GetReadingProgressRequest): Promise<GetReadingProgressResponse> => {
        try {
            const { userId, bookId } = request;

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

            // Calculate enhanced progress information
            const { bookProgress, chapterProgress } = await calculateBookProgress(
                new ObjectId(bookId),
                result.currentChapter,
                result.currentChunk
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
            console.error('Error getting reading progress:', error);
            throw error;
        }
    },

    [GET_READING_STATS_API_NAME]: async (request: GetReadingStatsRequest): Promise<GetReadingStatsResponse> => {
        try {
            const { userId, bookId } = request;

            const stats = await getReadingStats(
                new ObjectId(userId),
                new ObjectId(bookId)
            );

            if (!stats) {
                throw new Error('Failed to get reading statistics');
            }

            return {
                success: true,
                stats
            };
        } catch (error) {
            console.error('Error getting reading stats:', error);
            throw error;
        }
    }
}; 