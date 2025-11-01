export interface ReadingProgressClient {
    userId: string;
    bookId: string;
    currentChapter: number;
    currentChunk: number;
    lastReadAt: Date;
    // Optional progress info (only calculated when explicitly requested via getReadingStats)
    chapterProgress?: number; // 0-100 percentage within current chapter
    bookProgress?: number; // 0-100 percentage of entire book
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
    currentChapter: number; // Current chapter number
    lastReadAt?: Date; // Last time the book was read
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
    readingProgress?: ReadingProgressClient;
    error?: string;
}

export interface GetReadingProgressRequest {
    userId: string;
    bookId: string;
}

export interface GetReadingProgressResponse {
    success: boolean;
    readingProgress: ReadingProgressClient | null;
    error?: string;
}

export interface GetReadingStatsRequest {
    userId: string;
    bookId: string;
}

export interface GetReadingStatsResponse {
    success: boolean;
    stats?: ReadingProgressStats;
    error?: string;
} 