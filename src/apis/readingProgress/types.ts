export interface ReadingProgressClient {
    userId: string;
    bookId: string;
    currentChapter: number;
    currentChunk: number;
    lastReadAt: Date;
    // Enhanced progress info
    chapterProgress: number; // 0-100 percentage within current chapter
    bookProgress: number; // 0-100 percentage of entire book
    totalReadingTime: number; // Total reading time in minutes
    currentSessionTime: number; // Current session time in minutes
    sessionsCount: number; // Number of reading sessions
}

export interface ReadingProgressStats {
    bookProgress: number; // Overall book completion percentage
    chapterProgress: number; // Current chapter completion percentage
    totalReadingTime: number; // Total time spent reading in minutes
    currentSessionTime: number; // Current session time in minutes
    sessionsCount: number; // Number of reading sessions
    chaptersCompleted: number; // Number of chapters fully read
    totalChapters: number; // Total chapters in book
    estimatedTimeRemaining: number; // Estimated time to complete book in minutes
}

export interface UpdateReadingPositionRequest {
    userId: string;
    bookId: string;
    currentChapter: number;
    currentChunk: number;
    wordsRead?: number;
    sessionTimeMinutes?: number; // Time spent in current session
}

export interface UpdateReadingPositionResponse {
    success: boolean;
    readingProgress: ReadingProgressClient;
}

export interface GetReadingProgressRequest {
    userId: string;
    bookId: string;
}

export interface GetReadingProgressResponse {
    success: boolean;
    readingProgress: ReadingProgressClient | null;
}

export interface GetReadingStatsRequest {
    userId: string;
    bookId: string;
}

export interface GetReadingStatsResponse {
    success: boolean;
    stats: ReadingProgressStats;
} 