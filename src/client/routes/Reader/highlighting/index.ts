import type { HighlightingStrategy, HighlightingContext } from './types';
import { WordHighlightingStrategy } from './WordHighlightingStrategy';
import { SentenceHighlightingStrategy } from './SentenceHighlightingStrategy';

export const createHighlightingStrategy = (
    mode: 'word' | 'sentence',
    context: HighlightingContext
): HighlightingStrategy => {
    return mode === 'word'
        ? new WordHighlightingStrategy(context)
        : new SentenceHighlightingStrategy(context);
};

export * from './types'; 