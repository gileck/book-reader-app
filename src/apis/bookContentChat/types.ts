export interface BookContentChatRequest {
    modelId: string;
    question: string;
    bookId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    currentSentence: string;
    lastSentences: string;
    conversationHistory?: ChatMessage[];
}

export interface BookContentChatResponse {
    result: string;
    cost: {
        totalCost: number;
    };
    error?: string;
}

// Cost estimation types
export interface BookContentChatCostEstimateRequest {
    modelId: string;
    question: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    currentSentence: string;
    lastSentences: string;
    conversationHistory?: ChatMessage[];
}

export interface BookContentChatCostEstimateResponse {
    estimatedCost: number;
    error?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    chapterContext: {
        number: number;
        title: string;
    };
    currentSentence?: string;
    cost?: number;
    estimatedCost?: number;
    replyTo?: {
        messageIndex: number;
        content: string;
    };
} 