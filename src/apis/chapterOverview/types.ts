export type OverviewFormat = 'summary' | 'key-points' | 'qa' | 'comprehensive';
export type OverviewLength = 'short' | 'medium' | 'long';
export type OverviewLevel = 'basic' | 'intermediate' | 'advanced';

export interface ChapterOverviewRequest {
    modelId: string;
    bookId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    chapterContent: string; // Full chapter text content (no images)
    format: OverviewFormat;
    length: OverviewLength;
    level: OverviewLevel;
}

export interface ChapterOverviewResponse {
    overview: string;
    cost: {
        totalCost: number;
    };
    error?: string;
}

export interface SavedOverview {
    id: string;
    bookId: string;
    chapterNumber: number;
    chapterTitle: string;
    format: OverviewFormat;
    length: OverviewLength;
    level: OverviewLevel;
    modelId: string;
    content: string;
    timestamp: string;
    cost?: number;
}

export interface ChapterOverviewCostEstimateRequest {
    modelId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    chapterContent: string;
    format: OverviewFormat;
    length: OverviewLength;
    level: OverviewLevel;
}

export interface ChapterOverviewCostEstimateResponse {
    estimatedCost: number;
    error?: string;
}

