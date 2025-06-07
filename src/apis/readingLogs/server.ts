import { ObjectId } from 'mongodb';
import { createReadingLog, groupLogsIntoSessions } from '@/server/database/collections/readingLogs';
import { CREATE_READING_LOG_API_NAME, GET_READING_SESSIONS_API_NAME } from './index';
import type {
    CreateReadingLogRequest,
    CreateReadingLogResponse,
    GetReadingSessionsRequest,
    GetReadingSessionsResponse,
    ReadingLogClient,
    ReadingSessionClient
} from './types';

export const readingLogsApis = {
    [CREATE_READING_LOG_API_NAME]: async (request: CreateReadingLogRequest): Promise<CreateReadingLogResponse> => {
        try {
            const { userId, bookId, chapterNumber, chunkIndex, chunkText } = request;

            // Validate ObjectId format
            if (!userId || !ObjectId.isValid(userId)) {
                throw new Error(`Invalid userId format: ${userId}`);
            }

            if (!bookId || !ObjectId.isValid(bookId)) {
                throw new Error(`Invalid bookId format: ${bookId}`);
            }

            const logData = {
                userId: new ObjectId(userId),
                bookId: new ObjectId(bookId),
                chapterNumber,
                chunkIndex,
                chunkText,
                timestamp: new Date()
            };

            const result = await createReadingLog(logData);

            const log: ReadingLogClient = {
                _id: result._id.toString(),
                userId: result.userId.toString(),
                bookId: result.bookId.toString(),
                chapterNumber: result.chapterNumber,
                chunkIndex: result.chunkIndex,
                chunkText: result.chunkText,
                timestamp: result.timestamp
            };

            return {
                success: true,
                log
            };
        } catch (error) {
            console.error('Error creating reading log:', error);
            throw error;
        }
    },

    [GET_READING_SESSIONS_API_NAME]: async (request: GetReadingSessionsRequest): Promise<GetReadingSessionsResponse> => {
        try {
            const { userId, limit, offset } = request;

            // Validate ObjectId format
            if (!userId || !ObjectId.isValid(userId)) {
                throw new Error(`Invalid userId format: ${userId}`);
            }

            const sessions = await groupLogsIntoSessions(new ObjectId(userId));

            // Apply pagination if needed
            let paginatedSessions = sessions;
            if (offset || limit) {
                const start = offset || 0;
                const end = limit ? start + limit : undefined;
                paginatedSessions = sessions.slice(start, end);
            }

            // Convert to client format
            const clientSessions: ReadingSessionClient[] = paginatedSessions.map(session => ({
                sessionId: session.sessionId,
                bookId: session.bookId,
                bookTitle: session.bookTitle,
                chapterNumber: session.chapterNumber,
                chapterTitle: session.chapterTitle,
                startTime: session.startTime,
                endTime: session.endTime,
                duration: session.duration,
                totalLines: session.totalLines,
                logs: session.logs.map(log => ({
                    _id: log._id.toString(),
                    userId: log.userId.toString(),
                    bookId: log.bookId.toString(),
                    chapterNumber: log.chapterNumber,
                    chunkIndex: log.chunkIndex,
                    chunkText: log.chunkText,
                    timestamp: log.timestamp
                }))
            }));

            return {
                success: true,
                sessions: clientSessions,
                total: sessions.length
            };
        } catch (error) {
            console.error('Error getting reading sessions:', error);
            throw error;
        }
    }
}; 