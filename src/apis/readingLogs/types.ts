export interface ReadingLogClient {
    _id: string;
    userId: string;
    bookId: string;
    chapterNumber: number;
    chunkIndex: number;
    chunkText: string;
    timestamp: Date;
}

export interface ReadingSessionClient {
    sessionId: string;
    bookId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    startTime: Date;
    endTime: Date;
    duration: number; // in minutes
    totalLines: number;
    logs: ReadingLogClient[];
}

export interface CreateReadingLogRequest {
    userId: string;
    bookId: string;
    chapterNumber: number;
    chunkIndex: number;
    chunkText: string;
}

export interface CreateReadingLogResponse {
    success: boolean;
    log: ReadingLogClient;
}

export interface GetReadingSessionsRequest {
    userId: string;
    limit?: number;
    offset?: number;
}

export interface GetReadingSessionsResponse {
    success: boolean;
    sessions: ReadingSessionClient[];
    total: number;
} 