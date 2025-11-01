import { ApiHandlerContext } from "../types";
import { ChapterOverviewRequest, ChapterOverviewResponse, ChapterOverviewCostEstimateRequest, ChapterOverviewCostEstimateResponse, OverviewFormat, OverviewLength, OverviewLevel } from "./types";
import { AIModelAdapter } from "../../server/ai/baseModelAdapter";
import { isModelExists } from "../../server/ai/models";
import { API_GENERATE_CHAPTER_OVERVIEW, API_ESTIMATE_CHAPTER_OVERVIEW_COST } from "./index";

export * from './index';

function buildOverviewPrompt(
    bookTitle: string,
    chapterTitle: string,
    chapterNumber: number,
    chapterContent: string,
    format: OverviewFormat,
    length: OverviewLength,
    level: OverviewLevel
): string {
    // Build length instruction
    const lengthInstructions = {
        'short': 'Keep the overview concise (2-3 paragraphs or 150-250 words)',
        'medium': 'Provide a moderate length overview (4-6 paragraphs or 300-500 words)',
        'long': 'Provide a comprehensive and detailed overview (7+ paragraphs or 600-1000 words)'
    };

    // Build level instruction
    const levelInstructions = {
        'basic': 'Write in simple, easy-to-understand language suitable for someone new to the topic',
        'intermediate': 'Write for readers with some background knowledge, using standard terminology',
        'advanced': 'Write for experienced readers, using technical language and assuming deep understanding'
    };

    // Build format-specific instructions
    const formatInstructions = {
        'summary': `Create a flowing narrative summary of the chapter using markdown formatting. Use **bold** for key terms, *italics* for emphasis, and organize with clear headings (##, ###). ${lengthInstructions[length]}. ${levelInstructions[level]}.`,
        'key-points': `Create a structured markdown list of key points from the chapter. Use:
- ## Main heading for the section
- ### Subheadings for categories
- **Bold** for important terms
- Bullet points (-) for key insights
- Numbered lists (1., 2., 3.) for sequential concepts
${lengthInstructions[length]}. ${levelInstructions[level]}.`,
        'qa': `Create a Q&A format overview using markdown. Format as:
## Question 1
**Q:** [Question here]
**A:** [Answer with **bold** for key points and *italics* for emphasis]

Use clear markdown headings, bold, and italics to make it readable. ${lengthInstructions[length]}. ${levelInstructions[level]}.`,
        'comprehensive': `Create a comprehensive markdown overview that includes:
## Summary
[Brief overview with **bold** key terms]

## Key Concepts & Themes
- **Concept 1:** Description
- **Concept 2:** Description

## Important Details
[Detailed explanation with ### subheadings as needed]

## Takeaways
- Practical insight 1
- Practical insight 2

Use markdown formatting throughout (headers, bold, italics, lists). ${lengthInstructions[length]}. ${levelInstructions[level]}.`
    };

    return `You are a helpful assistant creating an overview of a book chapter. Your task is to analyze the chapter content and create a well-formatted markdown overview based on the specified format and requirements.

**IMPORTANT: Use markdown formatting in your response (headers, bold, italics, lists, etc.)**

Book: "${bookTitle}"
Chapter ${chapterNumber}: "${chapterTitle}"

Format Requirements:
${formatInstructions[format]}

Chapter Content:
${chapterContent}

Please create the overview now in markdown format, following the specified format, length, and complexity level. Make it informative, well-structured, and valuable for the reader.`;
}

async function generateOverview(
    params: ChapterOverviewRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ApiHandlerContext
): Promise<ChapterOverviewResponse> {
    try {
        const { modelId, bookTitle, chapterTitle, chapterNumber, chapterContent, format, length, level } = params;

        // Validate model ID exists
        if (!isModelExists(modelId)) {
            return {
                overview: "",
                cost: { totalCost: 0 },
                error: `Invalid model ID: ${modelId}`
            };
        }

        // Build prompt
        const prompt = buildOverviewPrompt(
            bookTitle,
            chapterTitle,
            chapterNumber,
            chapterContent,
            format,
            length,
            level
        );

        // Initialize AI adapter
        const adapter = new AIModelAdapter(modelId);

        // Process with AI model
        const response = await adapter.processPromptToText(prompt, 'chapterOverview/generate');

        return {
            overview: response.result,
            cost: response.cost
        };
    } catch (error) {
        console.error("Error generating chapter overview:", error);
        return {
            overview: "",
            cost: { totalCost: 0 },
            error: `AI service error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

async function estimateOverviewCost(
    params: ChapterOverviewCostEstimateRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: ApiHandlerContext
): Promise<ChapterOverviewCostEstimateResponse> {
    try {
        const { modelId, bookTitle, chapterNumber, chapterTitle, chapterContent, format, length, level } = params;

        // Validate model ID exists
        if (!isModelExists(modelId)) {
            return {
                estimatedCost: 0,
                error: `Invalid model ID: ${modelId}`
            };
        }

        // Build prompt (using actual values for accurate estimation)
        const prompt = buildOverviewPrompt(
            bookTitle,
            chapterTitle,
            chapterNumber,
            chapterContent,
            format,
            length,
            level
        );

        // Estimate expected output tokens based on user-selected length
        const expectedOutputTokens = (() => {
            switch (length) {
                case 'short': return 250;    // ~150-250 words = ~200-350 tokens
                case 'medium': return 500;   // ~300-500 words = ~400-700 tokens
                case 'long': return 900;     // ~600-1000 words = ~800-1400 tokens
                default: return 500;
            }
        })();

        // Initialize AI adapter
        const adapter = new AIModelAdapter(modelId);

        // Estimate cost with expected output tokens for more accurate estimation
        const costEstimate = adapter.estimateCost(prompt, expectedOutputTokens);

        return {
            estimatedCost: costEstimate.totalCost
        };
    } catch (error) {
        console.error("Error estimating chapter overview cost:", error);
        return {
            estimatedCost: 0,
            error: `Cost estimation error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

export const chapterOverviewApiHandlers = {
    [API_GENERATE_CHAPTER_OVERVIEW]: { process: generateOverview },
    [API_ESTIMATE_CHAPTER_OVERVIEW_COST]: { process: estimateOverviewCost }
};

