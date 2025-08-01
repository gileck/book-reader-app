import { useMemo } from 'react';
import type { ChapterClient } from '../../../../apis/chapters/types';
import { createHighlightingStrategy, type HighlightingContext } from '../highlighting';
import { useSettings } from '../../../settings/SettingsContext';

export const useHighlighting = (
    currentChunkIndex: number,
    currentWordIndex: number,
    highlightColor: string,
    chapter: ChapterClient | null,
    onWordClick: (chunkIndex: number, wordIndex: number) => void,
    onNavigateToChunk: (chunkIndex: number) => void
) => {
    const { settings, updateSettings } = useSettings();

    const context: HighlightingContext = useMemo(() => ({
        currentChunkIndex,
        currentWordIndex,
        highlightColor,
        chapter,
        onWordClick,
        onNavigateToChunk
    }), [currentChunkIndex, currentWordIndex, highlightColor, chapter, onWordClick, onNavigateToChunk]);

    const strategy = useMemo(() =>
        createHighlightingStrategy(settings.highlightingMode || 'word', context),
        [settings.highlightingMode, context]
    );

    const toggleMode = () => {
        const newMode = settings.highlightingMode === 'word' ? 'sentence' : 'word';
        updateSettings({ highlightingMode: newMode });
    };

    return {
        mode: settings.highlightingMode || 'word',
        getWordStyle: strategy.getWordStyle.bind(strategy),
        getWordClassName: strategy.getWordClassName.bind(strategy),
        handleWordClick: strategy.handleWordClick.bind(strategy),
        handleNext: strategy.handleNext.bind(strategy),
        handlePrevious: strategy.handlePrevious.bind(strategy),
        toggleMode
    };
}; 