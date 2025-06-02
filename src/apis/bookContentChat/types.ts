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

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    chapterContext: {
        number: number;
        title: string;
    };
    cost?: number;
    currentSentence?: string; // For user messages, shows the sentence they're replying to
}

export interface BookContentChatResponse {
    result: string;
    cost: {
        totalCost: number;
    };
    error?: string;
} 