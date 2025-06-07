import { useState, useCallback, useEffect } from 'react';
import { askBookContentQuestion } from '../../../../apis/bookContentChat/client';
import { ChatMessage } from '../../../../apis/bookContentChat/types';
import { getAllModels } from '../../../../server/ai/models';

interface UseBookQAProps {
    bookId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    currentSentence: string;
    lastSentences: string;
}

interface UseBookQAState {
    isOpen: boolean;
    isFullScreen: boolean;
    isLoading: boolean;
    messages: ChatMessage[];
    selectedModelId: string;
    isSettingsOpen: boolean;
    contextLines: number;
}

const DEFAULT_MODEL_ID = 'gemini-1.5-flash-8b'; // Default model

export const useBookQA = ({
    bookId,
    bookTitle,
    chapterNumber,
    chapterTitle,
    currentSentence,
    lastSentences
}: UseBookQAProps) => {
    const [state, setState] = useState<UseBookQAState>({
        isOpen: false,
        isFullScreen: false,
        isLoading: false,
        messages: [],
        selectedModelId: DEFAULT_MODEL_ID,
        isSettingsOpen: false,
        contextLines: 3
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

            setState(prev => ({
                ...prev,
                messages,
                selectedModelId,
                contextLines
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

    // Save settings to localStorage whenever selectedModelId or contextLines changes
    useEffect(() => {
        const settingsKey = 'bookQA_settings';
        try {
            const settings = {
                selectedModelId: state.selectedModelId,
                contextLines: state.contextLines
            };
            localStorage.setItem(settingsKey, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving settings to localStorage:', error);
        }
    }, [state.selectedModelId, state.contextLines]);

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

    const clearHistory = useCallback(() => {
        const conversationKey = `bookQA_conversation_${bookId}`;
        try {
            localStorage.removeItem(conversationKey);
            updateState({ messages: [] });
        } catch (error) {
            console.error('Error clearing conversation history:', error);
        }
    }, [bookId, updateState]);

    const submitQuestion = useCallback(async (question: string) => {
        if (!question.trim() || state.isLoading) return;

        // Auto-expand chat when submitting question
        if (!state.isOpen) {
            updateState({ isOpen: true });
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
            currentSentence: currentSentence
        };

        const newMessages = [...state.messages, userMessage];
        updateState({
            messages: newMessages,
            isLoading: true
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
                lastSentences,
                conversationHistory
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
                    cost: result.data.cost?.totalCost
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
        state.isLoading,
        state.messages,
        state.selectedModelId,
        state.isOpen,
        bookId,
        bookTitle,
        chapterNumber,
        chapterTitle,
        currentSentence,
        lastSentences,
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

        // Actions
        togglePanel,
        closePanel,
        toggleFullScreen,
        openSettings,
        closeSettings,
        handleModelChange,
        handleContextLinesChange,
        clearHistory,
        submitQuestion
    };
}; 