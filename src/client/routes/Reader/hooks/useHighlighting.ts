import { useMemo } from 'react';
import type { ChapterClient } from '../../../../apis/chapters/types';
import { createHighlightingStrategy, type HighlightingContext } from '../highlighting';

export const useHighlighting = (
    currentChunkIndex: number,
    currentWordIndex: number,
    highlightColor: string,
    chapter: ChapterClient | null,
    onWordClick: (chunkIndex: number, wordIndex: number) => void,
    onNavigateToChunk: (chunkIndex: number) => void
) => {

    const context: HighlightingContext = useMemo(() => ({
        currentChunkIndex,
        currentWordIndex,
        highlightColor,
        chapter,
        onWordClick,
        onNavigateToChunk
    }), [currentChunkIndex, currentWordIndex, highlightColor, chapter, onWordClick, onNavigateToChunk]);

    const strategy = useMemo(() =>
        createHighlightingStrategy('word', context),
        [context]
    );

    const toggleMode = () => {
        // Mode toggling functionality removed for simplicity
    };

    return {
        mode: 'word',
        getWordStyle: strategy.getWordStyle.bind(strategy),
        getWordClassName: strategy.getWordClassName.bind(strategy),
        handleWordClick: strategy.handleWordClick.bind(strategy),
        handleNext: strategy.handleNext.bind(strategy),
        handlePrevious: strategy.handlePrevious.bind(strategy),
        toggleMode
    };
}; 