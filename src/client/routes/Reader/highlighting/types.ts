import type { ChapterClient } from '../../../../apis/chapters/types';

export interface HighlightingStrategy {
    getWordStyle(chunkIndex: number, wordIndex: number): React.CSSProperties;
    getWordClassName(chunkIndex: number, wordIndex: number): string;
    handleWordClick(chunkIndex: number, wordIndex: number): void;
    handleNext(): void;
    handlePrevious(): void;
}

export interface HighlightingContext {
    currentChunkIndex: number;
    currentWordIndex: number;
    highlightColor: string;
    chapter: ChapterClient | null;
    onWordClick: (chunkIndex: number, wordIndex: number) => void;
    onNavigateToChunk: (chunkIndex: number) => void;
} 