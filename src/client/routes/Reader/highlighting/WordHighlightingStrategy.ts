import type { HighlightingStrategy, HighlightingContext } from './types';

export class WordHighlightingStrategy implements HighlightingStrategy {
    constructor(private context: HighlightingContext) { }

    getWordStyle(chunkIndex: number, wordIndex: number): React.CSSProperties {
        const { currentChunkIndex, currentWordIndex, highlightColor } = this.context;

        if (chunkIndex === currentChunkIndex && wordIndex === currentWordIndex) {
            return {
                backgroundColor: highlightColor,
                borderRadius: '2px',
                padding: '1px 2px'
            };
        }
        return {};
    }

    getWordClassName(chunkIndex: number, wordIndex: number): string {
        const { currentChunkIndex, currentWordIndex } = this.context;
        return chunkIndex === currentChunkIndex && wordIndex === currentWordIndex ? 'current-word' : '';
    }

    handleWordClick(chunkIndex: number, wordIndex: number): void {
        this.context.onWordClick(chunkIndex, wordIndex);
    }

    handleNext(): void {
        // Regular word-by-word navigation (existing logic)
        const { currentChunkIndex, currentWordIndex } = this.context;
        this.context.onWordClick(currentChunkIndex, currentWordIndex + 1);
    }

    handlePrevious(): void {
        // Regular word-by-word navigation (existing logic)
        const { currentChunkIndex, currentWordIndex } = this.context;
        this.context.onWordClick(currentChunkIndex, Math.max(0, currentWordIndex - 1));
    }
} 