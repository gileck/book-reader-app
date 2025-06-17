import { PromptCustomization } from './types';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    chapterContext: {
        number: number;
        title: string;
    };
}



export function buildContextPrompt(
    bookTitle: string,
    chapterTitle: string,
    chapterNumber: number,
    currentSentence: string,
    lastSentences: string,
    question: string,
    conversationHistory?: Array<ChatMessage>,
    externalPrompt?: boolean,
    customization?: PromptCustomization
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

    // Include conversation history (last 4 messages) if available and not external prompt
    if (!externalPrompt && conversationHistory && conversationHistory.length > 0) {
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

Please provide a helpful response based on the current reading context above.`;
    }

    // Add customization instructions if provided
    if (customization) {
        prompt += '\n\n';
        
        const customInstructions = [];
        
        if (customization.answerLength) {
            const lengthInstructions = {
                brief: 'Keep your response very brief (1-2 sentences).',
                short: 'Provide a short response (1 paragraph).',
                medium: 'Give a medium-length response (2-3 paragraphs).',
                detailed: 'Provide a detailed and comprehensive explanation.'
            };
            customInstructions.push(lengthInstructions[customization.answerLength]);
        }
        
        if (customization.answerLevel) {
            const levelInstructions = {
                simple: 'Explain in simple terms that anyone can understand.',
                intermediate: 'Use clear language appropriate for a general audience.',
                advanced: 'Provide an academic-level analysis with sophisticated concepts.'
            };
            customInstructions.push(levelInstructions[customization.answerLevel]);
        }
        
        if (customization.answerStyle) {
            const styleInstructions = {
                casual: 'Use a friendly, conversational tone.',
                professional: 'Maintain a formal, academic tone.',
                tutoring: 'Take a patient, educational approach as if teaching.',
                analytical: 'Focus on critical thinking and deep analysis.'
            };
            customInstructions.push(styleInstructions[customization.answerStyle]);
        }
        
        if (customInstructions.length > 0) {
            prompt += 'Response guidelines: ' + customInstructions.join(' ');
        }
    }

    return prompt;
} 