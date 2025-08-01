import type { HighlightingStrategy, HighlightingContext } from './types';

interface SentenceBoundary {
    start: number;
    end: number;
}

export class SentenceHighlightingStrategy implements HighlightingStrategy {
    constructor(private context: HighlightingContext) { }

    getWordStyle(chunkIndex: number, wordIndex: number): React.CSSProperties {
        const { currentChunkIndex, highlightColor, chapter } = this.context;

        if (chunkIndex !== currentChunkIndex || !chapter) return {};

        const sentence = this.findCurrentSentence();
        if (sentence && wordIndex >= sentence.start && wordIndex <= sentence.end) {
            return {
                backgroundColor: highlightColor,
                borderRadius: '2px',
                padding: '1px 2px'
            };
        }
        return {};
    }

    getWordClassName(chunkIndex: number, wordIndex: number): string {
        const { currentChunkIndex, chapter } = this.context;

        if (chunkIndex !== currentChunkIndex || !chapter) return '';

        const sentence = this.findCurrentSentence();
        if (sentence && wordIndex >= sentence.start && wordIndex <= sentence.end) {
            return 'current-sentence';
        }
        return '';
    }

    handleWordClick(chunkIndex: number, wordIndex: number): void {
        // Jump to sentence start
        const sentence = this.findSentenceForWord(chunkIndex, wordIndex);
        this.context.onWordClick(chunkIndex, sentence?.start || wordIndex);
    }

    handleNext(): void {
        // Navigate to next sentence
        const nextSentence = this.findNextSentence();
        if (nextSentence) {
            this.context.onWordClick(this.context.currentChunkIndex, nextSentence.start);
        } else {
            // If no next sentence in current chunk, move to next chunk
            this.context.onNavigateToChunk(this.context.currentChunkIndex + 1);
        }
    }

    handlePrevious(): void {
        // Navigate to previous sentence
        const prevSentence = this.findPreviousSentence();
        if (prevSentence) {
            this.context.onWordClick(this.context.currentChunkIndex, prevSentence.start);
        } else {
            // If no previous sentence in current chunk, move to previous chunk
            if (this.context.currentChunkIndex > 0) {
                this.context.onNavigateToChunk(this.context.currentChunkIndex - 1);
            }
        }
    }

    private findCurrentSentence(): SentenceBoundary | null {
        const { chapter, currentChunkIndex, currentWordIndex } = this.context;
        if (!chapter) return null;

        const chunk = chapter.content.chunks[currentChunkIndex];
        if (!chunk || chunk.type !== 'text') return null;

        const sentences = this.getSentenceBoundaries(chunk.text);
        return sentences.find(sentence =>
            currentWordIndex >= sentence.start && currentWordIndex <= sentence.end
        ) || null;
    }

    private findSentenceForWord(chunkIndex: number, wordIndex: number): SentenceBoundary | null {
        const { chapter } = this.context;
        if (!chapter) return null;

        const chunk = chapter.content.chunks[chunkIndex];
        if (!chunk || chunk.type !== 'text') return null;

        const sentences = this.getSentenceBoundaries(chunk.text);
        return sentences.find(sentence =>
            wordIndex >= sentence.start && wordIndex <= sentence.end
        ) || null;
    }

    private findNextSentence(): SentenceBoundary | null {
        const { chapter, currentChunkIndex, currentWordIndex } = this.context;
        if (!chapter) return null;

        const chunk = chapter.content.chunks[currentChunkIndex];
        if (!chunk || chunk.type !== 'text') return null;

        const sentences = this.getSentenceBoundaries(chunk.text);
        const currentSentenceIndex = sentences.findIndex(sentence =>
            currentWordIndex >= sentence.start && currentWordIndex <= sentence.end
        );

        if (currentSentenceIndex >= 0 && currentSentenceIndex < sentences.length - 1) {
            return sentences[currentSentenceIndex + 1];
        }
        return null;
    }

    private findPreviousSentence(): SentenceBoundary | null {
        const { chapter, currentChunkIndex, currentWordIndex } = this.context;
        if (!chapter) return null;

        const chunk = chapter.content.chunks[currentChunkIndex];
        if (!chunk || chunk.type !== 'text') return null;

        const sentences = this.getSentenceBoundaries(chunk.text);
        const currentSentenceIndex = sentences.findIndex(sentence =>
            currentWordIndex >= sentence.start && currentWordIndex <= sentence.end
        );

        if (currentSentenceIndex > 0) {
            return sentences[currentSentenceIndex - 1];
        }
        return null;
    }

    private getSentenceBoundaries(text: string): SentenceBoundary[] {
        // Simple sentence detection - split on punctuation
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        const boundaries: SentenceBoundary[] = [];

        let wordIndex = 0;
        for (let i = 0; i < sentences.length; i++) {
            const sentenceWords = sentences[i].trim().split(/\s+/).filter(w => w);
            if (sentenceWords.length > 0) {
                boundaries.push({
                    start: wordIndex,
                    end: wordIndex + sentenceWords.length - 1
                });
                wordIndex += sentenceWords.length;
            }
        }

        return boundaries;
    }
} 