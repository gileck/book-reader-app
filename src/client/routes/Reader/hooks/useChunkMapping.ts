import { useMemo } from 'react';
import type { ChapterClient, TextChunkClient } from '../../../../apis/chapters/types';

interface AudioActions {
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    currentChunkIndex: number;
    textChunks: TextChunkClient[];
    // Note: Sentence highlighting now done directly in JSX - no function needed
}

interface NavigationActions {
    setCurrentChunkIndex: (index: number) => void;
}

interface ChunkMapping {
    absoluteToText: Map<number, number>;
    textToAbsolute: Map<number, number>;
    textChunks: TextChunkClient[];
}

export const useChunkMapping = (
    chapter: ChapterClient | null,
    audio: AudioActions,
    navigation: NavigationActions
) => {
    // SIMPLIFIED: No more mapping needed! Audio system now uses absolute indexing
    const chunkIndexMapping = useMemo((): ChunkMapping => {
        if (!chapter) return { absoluteToText: new Map(), textToAbsolute: new Map(), textChunks: [] };

        // All chunks with absolute indexing - much simpler!
        const textChunks = chapter.content.chunks;

        // Create identity mappings (absolute index = audio index)
        const absoluteToText = new Map<number, number>();
        const textToAbsolute = new Map<number, number>();

        chapter.content.chunks.forEach((chunk, absoluteIndex) => {
            absoluteToText.set(absoluteIndex, absoluteIndex);
            textToAbsolute.set(absoluteIndex, absoluteIndex);
        });

        return { absoluteToText, textToAbsolute, textChunks };
    }, [chapter]);

    // Sentence highlighting now done directly in JSX - no optimization functions needed

    const handleOptimizedWordClick = useMemo(() => {
        return (chunkIndex: number, wordIndex: number) => {
            // SIMPLIFIED: Direct indexing - no conversion needed!
            audio.handleWordClick(chunkIndex, wordIndex);
        };
    }, [audio.handleWordClick]);

    const handleOptimizedSentenceClick = useMemo(() => {
        return (chunkIndex: number) => {
            // SIMPLIFIED: Direct indexing - audio system now handles non-text chunks gracefully

            // Set the current chunk index in reader state (will sync to audio)
            navigation.setCurrentChunkIndex(chunkIndex);

            // Also jump to the first word of that chunk (audio system will skip if non-text)
            audio.handleWordClick(chunkIndex, 0);
        };
    }, [navigation.setCurrentChunkIndex, audio.handleWordClick]);

    // SIMPLIFIED: Current chunk index is now direct (no conversion needed)
    const currentChunkIndex = useMemo(() => {
        return audio.currentChunkIndex;
    }, [audio.currentChunkIndex]);

    return {
        chunkIndexMapping,
        handleOptimizedWordClick,
        handleOptimizedSentenceClick,
        currentChunkIndex
        // Note: Sentence highlighting now done directly in JSX - no functions needed
    };
};