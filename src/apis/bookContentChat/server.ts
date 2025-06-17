import { ApiHandlerContext } from "../types";
import { BookContentChatRequest, BookContentChatResponse, BookContentChatCostEstimateRequest, BookContentChatCostEstimateResponse } from "./types";
import { AIModelAdapter } from "../../server/ai/baseModelAdapter";
import { isModelExists } from "../../server/ai/models";
import { name } from "./index";
import { buildContextPrompt } from "./utils";

export { name };

export async function process(
    params: BookContentChatRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ApiHandlerContext
): Promise<BookContentChatResponse> {
    try {
        const { modelId, question, bookTitle, chapterTitle, chapterNumber, currentSentence, lastSentences, conversationHistory, customization } = params;

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
            conversationHistory,
            false,
            customization
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
        const { modelId, question, bookTitle, chapterTitle, chapterNumber, currentSentence, lastSentences, conversationHistory, customization } = params;

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
            conversationHistory,
            false,
            customization
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

