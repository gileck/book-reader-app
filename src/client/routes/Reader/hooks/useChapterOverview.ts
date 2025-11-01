import { useState, useCallback, useEffect } from 'react';
import { generateChapterOverview, estimateChapterOverviewCost } from '@/apis/chapterOverview/client';
import { SavedOverview, OverviewFormat, OverviewLength, OverviewLevel } from '@/apis/chapterOverview/types';
import { getAllModels } from '@/server/ai/models';

interface UseChapterOverviewProps {
    bookId: string;
    bookTitle: string;
    chapterNumber: number;
    chapterTitle: string;
    chapterContent: string; // Full chapter text
}

export type { OverviewFormat, OverviewLength, OverviewLevel, SavedOverview };

interface UseChapterOverviewState {
    isGenerating: boolean;
    overviews: SavedOverview[];
    selectedOverviewId: string | null;
    selectedModelId: string;
    selectedFormat: OverviewFormat;
    selectedLength: OverviewLength;
    selectedLevel: OverviewLevel;
    estimateBeforeSend: boolean;
    costApprovalThreshold: number;
    pendingGeneration: {
        format: OverviewFormat;
        length: OverviewLength;
        level: OverviewLevel;
    } | null;
    estimatedCost: number | null;
    showCostApprovalDialog: boolean;
    error: string | null;
}

const DEFAULT_MODEL_ID = 'gemini-2.5-flash-lite';

export const useChapterOverview = ({
    bookId,
    bookTitle,
    chapterNumber,
    chapterTitle,
    chapterContent
}: UseChapterOverviewProps) => {
    const [state, setState] = useState<UseChapterOverviewState>({
        isGenerating: false,
        overviews: [],
        selectedOverviewId: null,
        selectedModelId: DEFAULT_MODEL_ID,
        selectedFormat: 'summary',
        selectedLength: 'medium',
        selectedLevel: 'intermediate',
        estimateBeforeSend: false,
        costApprovalThreshold: 0.05,
        pendingGeneration: null,
        estimatedCost: null,
        showCostApprovalDialog: false,
        error: null
    });

    // Load overviews and settings from localStorage on mount
    useEffect(() => {
        const overviewsKey = `chapterOverviews_${bookId}_${chapterNumber}`;
        const settingsKey = 'chapterOverview_settings';

        try {
            // Load saved overviews for this chapter
            const savedOverviews = localStorage.getItem(overviewsKey);
            const overviews = savedOverviews ? JSON.parse(savedOverviews) : [];

            // Load settings
            const savedSettings = localStorage.getItem(settingsKey);
            const settings = savedSettings ? JSON.parse(savedSettings) : {};

            // Validate model exists
            const availableModels = getAllModels();
            const modelExists = availableModels.some(model => model.id === settings.selectedModelId);
            const selectedModelId = modelExists ? settings.selectedModelId : DEFAULT_MODEL_ID;
            const estimateBeforeSend = settings.estimateBeforeSend || false;
            const costApprovalThreshold = settings.costApprovalThreshold || 0.05;

            setState(prev => ({
                ...prev,
                overviews,
                selectedModelId,
                estimateBeforeSend,
                costApprovalThreshold
            }));
        } catch (error) {
            console.error('Error loading overviews/settings from localStorage:', error);
        }
    }, [bookId, chapterNumber]);

    // Save overviews to localStorage whenever they change
    useEffect(() => {
        if (state.overviews.length > 0) {
            const overviewsKey = `chapterOverviews_${bookId}_${chapterNumber}`;
            try {
                localStorage.setItem(overviewsKey, JSON.stringify(state.overviews));
            } catch (error) {
                console.error('Error saving overviews to localStorage:', error);
            }
        }
    }, [state.overviews, bookId, chapterNumber]);

    // Save settings to localStorage whenever they change
    useEffect(() => {
        const settingsKey = 'chapterOverview_settings';
        try {
            const settings = {
                selectedModelId: state.selectedModelId,
                estimateBeforeSend: state.estimateBeforeSend,
                costApprovalThreshold: state.costApprovalThreshold
            };
            localStorage.setItem(settingsKey, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving settings to localStorage:', error);
        }
    }, [state.selectedModelId, state.estimateBeforeSend, state.costApprovalThreshold]);

    const updateState = useCallback((partialState: Partial<UseChapterOverviewState>) => {
        setState(prev => ({ ...prev, ...partialState }));
    }, []);

    const handleModelChange = useCallback((modelId: string) => {
        updateState({ selectedModelId: modelId });
    }, [updateState]);

    const handleFormatChange = useCallback((format: OverviewFormat) => {
        updateState({ selectedFormat: format });
    }, [updateState]);

    const handleLengthChange = useCallback((length: OverviewLength) => {
        updateState({ selectedLength: length });
    }, [updateState]);

    const handleLevelChange = useCallback((level: OverviewLevel) => {
        updateState({ selectedLevel: level });
    }, [updateState]);

    const handleEstimateBeforeSendChange = useCallback((value: boolean) => {
        updateState({ estimateBeforeSend: value });
    }, [updateState]);

    const handleCostApprovalThresholdChange = useCallback((value: number) => {
        updateState({ costApprovalThreshold: value });
    }, [updateState]);

    const selectOverview = useCallback((overviewId: string | null) => {
        updateState({ selectedOverviewId: overviewId });
    }, [updateState]);

    const deleteOverview = useCallback((overviewId: string) => {
        const newOverviews = state.overviews.filter(o => o.id !== overviewId);
        updateState({ 
            overviews: newOverviews,
            selectedOverviewId: state.selectedOverviewId === overviewId ? null : state.selectedOverviewId
        });

        // Update localStorage
        const overviewsKey = `chapterOverviews_${bookId}_${chapterNumber}`;
        try {
            if (newOverviews.length > 0) {
                localStorage.setItem(overviewsKey, JSON.stringify(newOverviews));
            } else {
                localStorage.removeItem(overviewsKey);
            }
        } catch (error) {
            console.error('Error updating overviews in localStorage:', error);
        }
    }, [state.overviews, state.selectedOverviewId, bookId, chapterNumber, updateState]);

    const generateOverviewWithoutEstimation = useCallback(async (
        format: OverviewFormat,
        length: OverviewLength,
        level: OverviewLevel,
        estimatedCost?: number
    ) => {
        updateState({ isGenerating: true, error: null });

        try {
            const result = await generateChapterOverview({
                modelId: state.selectedModelId,
                bookId,
                bookTitle,
                chapterNumber,
                chapterTitle,
                chapterContent,
                format,
                length,
                level
            });

            if (result.data?.error) {
                updateState({
                    error: `Error: ${result.data.error}`,
                    isGenerating: false
                });
                return;
            }

            if (result.data?.overview) {
                // Create unique ID based on settings
                const overviewId = `${format}_${length}_${level}_${Date.now()}`;
                
                const newOverview: SavedOverview = {
                    id: overviewId,
                    bookId,
                    chapterNumber,
                    chapterTitle,
                    format,
                    length,
                    level,
                    modelId: state.selectedModelId,
                    content: result.data.overview,
                    timestamp: new Date().toISOString(),
                    cost: result.data.cost?.totalCost || estimatedCost
                };

                const newOverviews = [...state.overviews, newOverview];
                updateState({
                    overviews: newOverviews,
                    selectedOverviewId: overviewId,
                    isGenerating: false
                });
            } else {
                updateState({
                    error: 'Failed to generate overview. Please try again.',
                    isGenerating: false
                });
            }
        } catch (error) {
            console.error('Error generating overview:', error);
            updateState({
                error: 'Technical error occurred. Please try again.',
                isGenerating: false
            });
        }
    }, [state.selectedModelId, state.overviews, bookId, bookTitle, chapterNumber, chapterTitle, chapterContent, updateState]);

    const handleCostApproval = useCallback((approved: boolean) => {
        if (approved && state.pendingGeneration && state.estimatedCost !== null) {
            updateState({
                showCostApprovalDialog: false,
                pendingGeneration: null,
                estimatedCost: null
            });
            const { format, length, level } = state.pendingGeneration;
            generateOverviewWithoutEstimation(format, length, level, state.estimatedCost);
        } else {
            updateState({
                showCostApprovalDialog: false,
                pendingGeneration: null,
                estimatedCost: null,
                isGenerating: false
            });
        }
    }, [state.pendingGeneration, state.estimatedCost, generateOverviewWithoutEstimation, updateState]);

    const generateOverview = useCallback(async (
        format?: OverviewFormat,
        length?: OverviewLength,
        level?: OverviewLevel
    ) => {
        const selectedFormat = format || state.selectedFormat;
        const selectedLength = length || state.selectedLength;
        const selectedLevel = level || state.selectedLevel;

        if (state.estimateBeforeSend) {
            // Estimate cost first
            try {
                updateState({ isGenerating: true });

                const estimateResult = await estimateChapterOverviewCost({
                    modelId: state.selectedModelId,
                    bookTitle,
                    chapterNumber,
                    chapterTitle,
                    chapterContent,
                    format: selectedFormat,
                    length: selectedLength,
                    level: selectedLevel
                });

                if (estimateResult.data?.error) {
                    updateState({
                        error: `Cost estimation error: ${estimateResult.data.error}`,
                        isGenerating: false
                    });
                    return;
                }

                const estimatedCost = estimateResult.data?.estimatedCost || 0;

                if (estimatedCost > state.costApprovalThreshold) {
                    // Show cost approval dialog
                    updateState({
                        pendingGeneration: {
                            format: selectedFormat,
                            length: selectedLength,
                            level: selectedLevel
                        },
                        estimatedCost: estimatedCost,
                        showCostApprovalDialog: true,
                        isGenerating: false
                    });
                    return;
                }

                // If below threshold, proceed with estimated cost
                generateOverviewWithoutEstimation(selectedFormat, selectedLength, selectedLevel, estimatedCost);
                return;
            } catch (error) {
                console.error('Error estimating cost:', error);
                updateState({ 
                    error: 'Failed to estimate cost. Please try again.',
                    isGenerating: false 
                });
                return;
            }
        }

        // Proceed with normal generation (no estimation)
        generateOverviewWithoutEstimation(selectedFormat, selectedLength, selectedLevel);
    }, [
        state.selectedFormat,
        state.selectedLength,
        state.selectedLevel,
        state.estimateBeforeSend,
        state.selectedModelId,
        state.costApprovalThreshold,
        chapterContent,
        generateOverviewWithoutEstimation,
        updateState
    ]);

    const clearError = useCallback(() => {
        updateState({ error: null });
    }, [updateState]);

    return {
        // State
        isGenerating: state.isGenerating,
        overviews: state.overviews,
        selectedOverviewId: state.selectedOverviewId,
        selectedOverview: state.overviews.find(o => o.id === state.selectedOverviewId) || null,
        selectedModelId: state.selectedModelId,
        selectedFormat: state.selectedFormat,
        selectedLength: state.selectedLength,
        selectedLevel: state.selectedLevel,
        estimateBeforeSend: state.estimateBeforeSend,
        costApprovalThreshold: state.costApprovalThreshold,
        showCostApprovalDialog: state.showCostApprovalDialog,
        estimatedCost: state.estimatedCost,
        error: state.error,

        // Actions
        handleModelChange,
        handleFormatChange,
        handleLengthChange,
        handleLevelChange,
        handleEstimateBeforeSendChange,
        handleCostApprovalThresholdChange,
        selectOverview,
        deleteOverview,
        generateOverview,
        handleCostApproval,
        clearError
    };
};

