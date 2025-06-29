import { useState, useCallback, useEffect } from 'react';
import { askBookContentQuestion, estimateBookContentQuestionCost } from '../../../../apis/bookContentChat/client';
import { ChatMessage, AnswerLength, AnswerLevel, AnswerStyle } from '../../../../apis/bookContentChat/types';
import { getAllModels } from '../../../../server/ai/models';

interface UseBookQAProps {
    bookId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    currentSentence: string;
    getLastSentences: () => string;
}

export type { AnswerLength, AnswerLevel, AnswerStyle };

interface UseBookQAState {
    isOpen: boolean;
    isFullScreen: boolean;
    isLoading: boolean;
    messages: ChatMessage[];
    selectedModelId: string;
    isSettingsOpen: boolean;
    contextLines: number;
    estimateBeforeSend: boolean;
    costApprovalThreshold: number;
    pendingQuestion: string | null;
    estimatedCost: number | null;
    showCostApprovalDialog: boolean;
    replyContext: {
        messageIndex: number;
        messageContent: string;
    } | null;
    answerLength: AnswerLength;
    answerLevel: AnswerLevel;
    answerStyle: AnswerStyle;
}

const DEFAULT_MODEL_ID = 'gemini-1.5-flash-8b'; // Default model

export const useBookQA = ({
    bookId,
    bookTitle,
    chapterNumber,
    chapterTitle,
    currentSentence,
    getLastSentences
}: UseBookQAProps) => {
    const [state, setState] = useState<UseBookQAState>({
        isOpen: false,
        isFullScreen: false,
        isLoading: false,
        messages: [],
        selectedModelId: DEFAULT_MODEL_ID,
        isSettingsOpen: false,
        contextLines: 3,
        estimateBeforeSend: false,
        costApprovalThreshold: 0.01,
        pendingQuestion: null,
        estimatedCost: null,
        showCostApprovalDialog: false,
        replyContext: null,
        answerLength: 'medium',
        answerLevel: 'intermediate',
        answerStyle: 'casual'
    });

    // Load conversation history and settings from localStorage on mount
    useEffect(() => {
        const conversationKey = `bookQA_conversation_${bookId}`;
        const settingsKey = 'bookQA_settings';

        try {
            // Load conversation history
            const savedConversation = localStorage.getItem(conversationKey);
            const messages = savedConversation ? JSON.parse(savedConversation) : [];

            // Load settings
            const savedSettings = localStorage.getItem(settingsKey);
            const settings = savedSettings ? JSON.parse(savedSettings) : {};

            // Validate model exists
            const availableModels = getAllModels();
            const modelExists = availableModels.some(model => model.id === settings.selectedModelId);
            const selectedModelId = modelExists ? settings.selectedModelId : DEFAULT_MODEL_ID;
            const contextLines = settings.contextLines || 3;
            const estimateBeforeSend = settings.estimateBeforeSend || false;
            const costApprovalThreshold = settings.costApprovalThreshold || 0.01;
            const answerLength = settings.answerLength || 'medium';
            const answerLevel = settings.answerLevel || 'intermediate';
            const answerStyle = settings.answerStyle || 'casual';

            setState(prev => ({
                ...prev,
                messages,
                selectedModelId,
                contextLines,
                estimateBeforeSend,
                costApprovalThreshold,
                answerLength,
                answerLevel,
                answerStyle
            }));
        } catch (error) {
            console.error('Error loading conversation/settings from localStorage:', error);
        }
    }, [bookId]);

    // Save conversation to localStorage whenever messages change
    useEffect(() => {
        if (state.messages.length > 0) {
            const conversationKey = `bookQA_conversation_${bookId}`;
            try {
                localStorage.setItem(conversationKey, JSON.stringify(state.messages));
            } catch (error) {
                console.error('Error saving conversation to localStorage:', error);
            }
        }
    }, [state.messages, bookId]);

    // Save settings to localStorage whenever selectedModelId, contextLines, cost settings, or prompt settings change
    useEffect(() => {
        const settingsKey = 'bookQA_settings';
        try {
            const settings = {
                selectedModelId: state.selectedModelId,
                contextLines: state.contextLines,
                estimateBeforeSend: state.estimateBeforeSend,
                costApprovalThreshold: state.costApprovalThreshold,
                answerLength: state.answerLength,
                answerLevel: state.answerLevel,
                answerStyle: state.answerStyle
            };
            localStorage.setItem(settingsKey, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving settings to localStorage:', error);
        }
    }, [state.selectedModelId, state.contextLines, state.estimateBeforeSend, state.costApprovalThreshold, state.answerLength, state.answerLevel, state.answerStyle]);

    const updateState = useCallback((partialState: Partial<UseBookQAState>) => {
        setState(prev => ({ ...prev, ...partialState }));
    }, []);

    const togglePanel = useCallback(() => {
        updateState({ isOpen: !state.isOpen });
    }, [state.isOpen, updateState]);

    const closePanel = useCallback(() => {
        updateState({ isOpen: false, isFullScreen: false });
    }, [updateState]);

    const toggleFullScreen = useCallback(() => {
        updateState({ isFullScreen: !state.isFullScreen });
    }, [state.isFullScreen, updateState]);

    const openSettings = useCallback(() => {
        updateState({ isSettingsOpen: true });
    }, [updateState]);

    const closeSettings = useCallback(() => {
        updateState({ isSettingsOpen: false });
    }, [updateState]);

    const handleModelChange = useCallback((modelId: string) => {
        updateState({ selectedModelId: modelId });
    }, [updateState]);

    const handleContextLinesChange = useCallback((lines: number) => {
        updateState({ contextLines: lines });
    }, [updateState]);

    const handleEstimateBeforeSendChange = useCallback((value: boolean) => {
        updateState({ estimateBeforeSend: value });
    }, [updateState]);

    const handleCostApprovalThresholdChange = useCallback((value: number) => {
        updateState({ costApprovalThreshold: value });
    }, [updateState]);

    const handleAnswerLengthChange = useCallback((value: AnswerLength) => {
        updateState({ answerLength: value });
    }, [updateState]);

    const handleAnswerLevelChange = useCallback((value: AnswerLevel) => {
        updateState({ answerLevel: value });
    }, [updateState]);

    const handleAnswerStyleChange = useCallback((value: AnswerStyle) => {
        updateState({ answerStyle: value });
    }, [updateState]);

    const setReplyContext = useCallback((messageIndex: number, messageContent: string) => {
        updateState({
            replyContext: { messageIndex, messageContent }
        });
    }, [updateState]);

    const clearReplyContext = useCallback(() => {
        updateState({ replyContext: null });
    }, [updateState]);

    const clearHistory = useCallback(() => {
        const conversationKey = `bookQA_conversation_${bookId}`;
        try {
            localStorage.removeItem(conversationKey);
            updateState({ messages: [] });
        } catch (error) {
            console.error('Error clearing conversation history:', error);
        }
    }, [bookId, updateState]);

    const submitQuestionWithoutEstimation = useCallback(async (question: string, estimatedCost?: number, openPanel: boolean = true, customCustomization?: { answerLength?: AnswerLength; answerLevel?: AnswerLevel; answerStyle?: AnswerStyle }) => {
        // Auto-expand chat to fullscreen when submitting question (if openPanel is true)
        if (openPanel) {
            updateState({
                isOpen: true,
                isFullScreen: true
            });
        }

        // Add user message immediately
        const userMessage: ChatMessage = {
            role: 'user',
            content: question,
            timestamp: new Date().toISOString(),
            chapterContext: {
                number: chapterNumber,
                title: chapterTitle
            },
            currentSentence: state.replyContext ? undefined : currentSentence,
            replyTo: state.replyContext ? {
                messageIndex: state.replyContext.messageIndex,
                content: state.replyContext.messageContent
            } : undefined
        };

        const newMessages = [...state.messages, userMessage];
        updateState({
            messages: newMessages,
            isLoading: true,
            replyContext: null // Clear reply context after sending
        });

        try {
            // Get conversation history (last 4 messages for context)
            const conversationHistory = newMessages.slice(-4);

            const result = await askBookContentQuestion({
                modelId: state.selectedModelId,
                question,
                bookId,
                bookTitle,
                chapterNumber,
                chapterTitle,
                currentSentence,
                lastSentences: getLastSentences(),
                conversationHistory,
                customization: customCustomization || {
                    answerLength: state.answerLength,
                    answerLevel: state.answerLevel,
                    answerStyle: state.answerStyle
                }
            });

            if (result.data?.error) {
                const errorMessage: ChatMessage = {
                    role: 'assistant',
                    content: `Sorry, I encountered an error: ${result.data.error}`,
                    timestamp: new Date().toISOString(),
                    chapterContext: {
                        number: chapterNumber,
                        title: chapterTitle
                    }
                };
                updateState({
                    messages: [...newMessages, errorMessage],
                    isLoading: false
                });
            } else if (result.data?.result) {
                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: result.data.result,
                    timestamp: new Date().toISOString(),
                    chapterContext: {
                        number: chapterNumber,
                        title: chapterTitle
                    },
                    cost: result.data.cost?.totalCost,
                    estimatedCost: estimatedCost
                };
                updateState({
                    messages: [...newMessages, assistantMessage],
                    isLoading: false
                });
            } else {
                const errorMessage: ChatMessage = {
                    role: 'assistant',
                    content: 'Sorry, I didn\'t receive a response. Please try again.',
                    timestamp: new Date().toISOString(),
                    chapterContext: {
                        number: chapterNumber,
                        title: chapterTitle
                    }
                };
                updateState({
                    messages: [...newMessages, errorMessage],
                    isLoading: false
                });
            }
        } catch (error) {
            console.error('Error submitting question:', error);
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: 'Sorry, I encountered a technical error. Please try again.',
                timestamp: new Date().toISOString(),
                chapterContext: {
                    number: chapterNumber,
                    title: chapterTitle
                }
            };
            updateState({
                messages: [...newMessages, errorMessage],
                isLoading: false
            });
        }
    }, [
        state.messages,
        state.selectedModelId,
        bookId,
        bookTitle,
        chapterNumber,
        chapterTitle,
        currentSentence,
        getLastSentences,
        updateState
    ]);

    const handleCostApproval = useCallback((approved: boolean, openPanel: boolean = true) => {
        if (approved && state.pendingQuestion && state.estimatedCost !== null) {
            // Proceed with the actual question submission, passing the estimated cost
            updateState({
                showCostApprovalDialog: false,
                pendingQuestion: null,
                estimatedCost: null
            });
            // Call the actual submit function with estimated cost
            submitQuestionWithoutEstimation(state.pendingQuestion, state.estimatedCost, openPanel);
        } else {
            // Cancel the question
            updateState({
                showCostApprovalDialog: false,
                pendingQuestion: null,
                estimatedCost: null,
                isLoading: false
            });
        }
    }, [state.pendingQuestion, state.estimatedCost, submitQuestionWithoutEstimation, updateState]);

    const submitQuestion = useCallback(async (question: string, openPanel: boolean = true, customCustomization?: { answerLength?: AnswerLength; answerLevel?: AnswerLevel; answerStyle?: AnswerStyle }) => {
        if (!question.trim() || state.isLoading) return;

        // Create user message for context (even if we're just estimating)
        const userMessage: ChatMessage = {
            role: 'user',
            content: question,
            timestamp: new Date().toISOString(),
            chapterContext: {
                number: chapterNumber,
                title: chapterTitle
            },
            currentSentence: currentSentence
        };

        const potentialNewMessages = [...state.messages, userMessage];

        if (state.estimateBeforeSend) {
            // First estimate the cost
            try {
                updateState({ isLoading: true });

                const estimateResult = await estimateBookContentQuestionCost({
                    modelId: state.selectedModelId,
                    question,
                    bookTitle,
                    chapterNumber,
                    chapterTitle,
                    currentSentence,
                    lastSentences: getLastSentences(),
                    conversationHistory: potentialNewMessages.slice(-4),
                    customization: customCustomization || {
                        answerLength: state.answerLength,
                        answerLevel: state.answerLevel,
                        answerStyle: state.answerStyle
                    }
                });

                if (estimateResult.data?.error) {
                    console.error('Cost estimation error:', estimateResult.data.error);
                    updateState({ isLoading: false });
                    return;
                }

                const estimatedCost = estimateResult.data?.estimatedCost || 0;

                if (estimatedCost > state.costApprovalThreshold) {
                    // Show cost approval dialog
                    updateState({
                        pendingQuestion: question,
                        estimatedCost: estimatedCost,
                        showCostApprovalDialog: true,
                        isLoading: false
                    });
                    return;
                }

                // If below threshold, proceed with estimated cost
                submitQuestionWithoutEstimation(question, estimatedCost, openPanel, customCustomization);
                return;
            } catch (error) {
                console.error('Error estimating cost:', error);
                updateState({ isLoading: false });
                return;
            }
        }

        // Proceed with normal submission (no estimation)
        submitQuestionWithoutEstimation(question, undefined, openPanel, customCustomization);
    }, [
        state.isLoading,
        state.messages,
        state.selectedModelId,
        state.estimateBeforeSend,
        state.costApprovalThreshold,
        chapterNumber,
        chapterTitle,
        currentSentence,
        getLastSentences,
        submitQuestionWithoutEstimation,
        updateState
    ]);

    return {
        // State
        isOpen: state.isOpen,
        isFullScreen: state.isFullScreen,
        isLoading: state.isLoading,
        messages: state.messages,
        selectedModelId: state.selectedModelId,
        isSettingsOpen: state.isSettingsOpen,
        contextLines: state.contextLines,
        estimateBeforeSend: state.estimateBeforeSend,
        costApprovalThreshold: state.costApprovalThreshold,
        showCostApprovalDialog: state.showCostApprovalDialog,
        estimatedCost: state.estimatedCost,
        pendingQuestion: state.pendingQuestion,
        replyContext: state.replyContext,
        answerLength: state.answerLength,
        answerLevel: state.answerLevel,
        answerStyle: state.answerStyle,

        // Actions
        togglePanel,
        closePanel,
        toggleFullScreen,
        openSettings,
        closeSettings,
        handleModelChange,
        handleContextLinesChange,
        handleEstimateBeforeSendChange,
        handleCostApprovalThresholdChange,
        handleCostApproval,
        clearHistory,
        submitQuestion,
        setReplyContext,
        clearReplyContext,
        handleAnswerLengthChange,
        handleAnswerLevelChange,
        handleAnswerStyleChange
    };
}; 