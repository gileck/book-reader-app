import { ApiHandlerContext } from "../types";
import { BookContentChatRequest, BookContentChatResponse, BookContentChatCostEstimateRequest, BookContentChatCostEstimateResponse } from "./types";
import { AIModelAdapter } from "../../server/ai/baseModelAdapter";
import { isModelExists } from "../../server/ai/models";
import { name } from "./index";

export { name };

export async function process(
    params: BookContentChatRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ApiHandlerContext
): Promise<BookContentChatResponse> {
    try {
        const { modelId, question, bookTitle, chapterTitle, chapterNumber, currentSentence, lastSentences, conversationHistory } = params;

        // Validate model ID exists
        if (!isModelExists(modelId)) {
            return {
                result: "",
                cost: { totalCost: 0 },
                error: `Invalid model ID: ${modelId}`
            };
        }

        // Build context-aware prompt
        const contextPrompt = buildContextPrompt(
            bookTitle,
            chapterTitle,
            chapterNumber,
            currentSentence,
            lastSentences,
            question,
            conversationHistory
        );

        // Initialize AI adapter
        const adapter = new AIModelAdapter(modelId);

        // Process with AI model
        const response = await adapter.processPromptToText(contextPrompt, 'bookContentChat/ask');

        return {
            result: response.result,
            cost: response.cost
        };
    } catch (error) {
        console.error("Error with book content chat:", error);
        return {
            result: "",
            cost: { totalCost: 0 },
            error: `AI service error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

export async function estimateCost(
    params: BookContentChatCostEstimateRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ApiHandlerContext
): Promise<BookContentChatCostEstimateResponse> {
    try {
        const { modelId, question, bookTitle, chapterTitle, chapterNumber, currentSentence, lastSentences, conversationHistory } = params;

        // Validate model ID exists
        if (!isModelExists(modelId)) {
            return {
                estimatedCost: 0,
                error: `Invalid model ID: ${modelId}`
            };
        }

        // Build context-aware prompt (same as actual request)
        const contextPrompt = buildContextPrompt(
            bookTitle,
            chapterTitle,
            chapterNumber,
            currentSentence,
            lastSentences,
            question,
            conversationHistory
        );

        // Initialize AI adapter
        const adapter = new AIModelAdapter(modelId);

        // Estimate cost without making the actual request
        const costEstimate = adapter.estimateCost(contextPrompt);

        return {
            estimatedCost: costEstimate.totalCost
        };
    } catch (error) {
        console.error("Error estimating cost for book content chat:", error);
        return {
            estimatedCost: 0,
            error: `Cost estimation error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

function buildContextPrompt(
    bookTitle: string,
    chapterTitle: string,
    chapterNumber: number,
    currentSentence: string,
    lastSentences: string,
    question: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string; chapterContext: { number: number; title: string; } }>
): string {
    let prompt = `You are a helpful reading assistant for the book "${bookTitle}". The reader is currently in Chapter ${chapterNumber}: "${chapterTitle}".

`;

    // Check if this is a reply to a specific AI message (based on question prefix)
    const isReply = question.startsWith('Reply to:');

    if (!isReply) {
        prompt += `Current reading context:
Previous sentences: ${lastSentences}
Current sentence: ${currentSentence}

`;
    }

    // Include conversation history (last 4 messages) if available
    if (conversationHistory && conversationHistory.length > 0) {
        prompt += "Previous conversation:\n";
        const recentHistory = conversationHistory.slice(-4); // Last 4 messages

        for (const message of recentHistory) {
            const roleLabel = message.role === 'user' ? 'Reader' : 'Assistant';
            prompt += `${roleLabel} (Chapter ${message.chapterContext.number}): ${message.content}\n`;
        }
        prompt += "\n";
    }

    if (isReply) {
        prompt += `Reader's follow-up question: ${question}

Please provide a helpful response to this follow-up question about your previous response.`;
    } else {
        prompt += `Reader's question about the current text: ${question}

Please provide a helpful response based on the current reading context above. The reader is asking about the text they are currently reading.`;
    }

    return prompt;
} 