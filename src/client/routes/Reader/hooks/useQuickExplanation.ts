import { useState, useEffect } from 'react';
import { ChatMessage, AnswerLength, AnswerLevel, AnswerStyle } from '../../../../apis/bookContentChat/types';

interface CustomCustomization {
    answerLength?: AnswerLength;
    answerLevel?: AnswerLevel;
    answerStyle?: AnswerStyle;
}

interface UseQuickExplanationProps {
    bookQA: {
        messages: ChatMessage[];
        isLoading: boolean;
        submitQuestion: (question: string, openPanel?: boolean, customCustomization?: CustomCustomization) => void;
        togglePanel: () => void;
        isOpen: boolean;
    };
}

export const useQuickExplanation = ({ bookQA }: UseQuickExplanationProps) => {
    const [quickExplanationOpen, setQuickExplanationOpen] = useState(false);
    const [quickExplanationLoading, setQuickExplanationLoading] = useState(false);
    const [quickExplanationText, setQuickExplanationText] = useState('');
    const [quickExplanationAnswer, setQuickExplanationAnswer] = useState('');

    // Monitor bookQA messages for quick explanation response
    useEffect(() => {
        if (quickExplanationLoading && bookQA.messages.length > 0 && !bookQA.isLoading) {
            const latestMessage = bookQA.messages[bookQA.messages.length - 1];
            if (latestMessage.role === 'assistant') {
                setQuickExplanationAnswer(latestMessage.content);
                setQuickExplanationLoading(false);
            }
        }
    }, [bookQA.messages, bookQA.isLoading, quickExplanationLoading]);

    // Handle explaining selected text
    const handleExplainText = (selectedText: string) => {
        setQuickExplanationText(selectedText);
        setQuickExplanationAnswer('');
        setQuickExplanationOpen(true);
        setQuickExplanationLoading(true);

        // Submit question using bookQA but don't open the panel with custom settings for quick explanation
        bookQA.submitQuestion(
            `Provide a short simple explanation of the text: "${selectedText}"`, 
            false, 
            { answerLength: 'short', answerLevel: 'simple', answerStyle: 'casual' }
        );
    };

    // Handle opening quick explanation in full QA panel
    const handleOpenInQAPanel = () => {
        setQuickExplanationOpen(false);
        if (!bookQA.isOpen) {
            bookQA.togglePanel();
        }
        // The conversation is already in the bookQA messages, so just open the panel
    };

    // Handle closing quick explanation
    const handleCloseQuickExplanation = () => {
        setQuickExplanationOpen(false);
        setQuickExplanationText('');
        setQuickExplanationAnswer('');
    };

    return {
        // State
        quickExplanationOpen,
        quickExplanationLoading,
        quickExplanationText,
        quickExplanationAnswer,
        
        // Actions
        handleExplainText,
        handleOpenInQAPanel,
        handleCloseQuickExplanation
    };
}; 