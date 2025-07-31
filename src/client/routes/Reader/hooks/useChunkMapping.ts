import React, { useMemo } from 'react';
import type { ChapterClient, TextChunkClient } from '../../../../apis/chapters/types';

interface AudioActions {
    getWordStyle: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getWordClassName: (chunkIndex: number, wordIndex: number) => string;
    getSentenceStyle: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName: (chunkIndex: number) => string;
    handleWordClick: (chunkIndex: number, wordIndex: number) => void;
    currentChunkIndex: number;
    textChunks: TextChunkClient[];
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
    // Enhanced chunk mapping for v2: handles mixed chunk types (text, header, image)
    // Only text chunks participate in audio - headers and images are visual-only
    const chunkIndexMapping = useMemo((): ChunkMapping => {
        if (!chapter) return { absoluteToText: new Map(), textToAbsolute: new Map(), textChunks: [] };

        // Filter chunks to get only text chunks for audio processing
        const textChunks = chapter.content.chunks.filter(c =>
            c.type === 'text'
        );

        const absoluteToText = new Map<number, number>();
        const textToAbsolute = new Map<number, number>();

        let textChunkIndex = 0;
        chapter.content.chunks.forEach((chunk, absoluteIndex) => {
            // Only map text chunks for audio - skip headers and images
            if (chunk.type === 'text') {
                absoluteToText.set(absoluteIndex, textChunkIndex);
                textToAbsolute.set(textChunkIndex, absoluteIndex);
                textChunkIndex++;
            }
        });

        return { absoluteToText, textToAbsolute, textChunks };
    }, [chapter]);

    // Optimized functions using cached mapping
    const getOptimizedWordStyle = useMemo(() => {
        return (chunkIndex: number, wordIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return {};
            return audio.getWordStyle(textChunkIndex, wordIndex);
        };
    }, [audio.getWordStyle, chunkIndexMapping]);

    const getOptimizedWordClassName = useMemo(() => {
        return (chunkIndex: number, wordIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return '';
            return audio.getWordClassName(textChunkIndex, wordIndex);
        };
    }, [audio.getWordClassName, chunkIndexMapping]);

    const getOptimizedSentenceStyle = useMemo(() => {
        return (chunkIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return {};
            return audio.getSentenceStyle(textChunkIndex);
        };
    }, [audio.getSentenceStyle, chunkIndexMapping]);

    const getOptimizedSentenceClassName = useMemo(() => {
        return (chunkIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return '';
            return audio.getSentenceClassName(textChunkIndex);
        };
    }, [audio.getSentenceClassName, chunkIndexMapping]);

    const handleOptimizedWordClick = useMemo(() => {
        return (chunkIndex: number, wordIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) return;
            audio.handleWordClick(textChunkIndex, wordIndex);
        };
    }, [audio.handleWordClick, chunkIndexMapping]);

    const handleOptimizedSentenceClick = useMemo(() => {
        return (chunkIndex: number) => {
            const textChunkIndex = chunkIndexMapping.absoluteToText.get(chunkIndex);
            if (textChunkIndex === undefined) {
                // This is a non-text chunk (header or image) - no audio action needed
                console.log(`Chunk ${chunkIndex} is not a text chunk, skipping audio navigation`);
                return;
            }

            // Set the current chunk index in reader state (will sync to audio)
            navigation.setCurrentChunkIndex(textChunkIndex);

            // Also jump to the first word of that chunk
            audio.handleWordClick(textChunkIndex, 0);
        };
    }, [chunkIndexMapping, navigation.setCurrentChunkIndex, audio.handleWordClick]);

    // Optimized current chunk index calculation
    const currentChunkIndex = useMemo(() => {
        const currentTextChunk = audio.textChunks[audio.currentChunkIndex];
        if (!currentTextChunk) return 0;

        return chunkIndexMapping.textToAbsolute.get(audio.currentChunkIndex) || 0;
    }, [audio.currentChunkIndex, audio.textChunks, chunkIndexMapping]);

    return {
        chunkIndexMapping,
        getOptimizedWordStyle,
        getOptimizedWordClassName,
        getOptimizedSentenceStyle,
        getOptimizedSentenceClassName,
        handleOptimizedWordClick,
        handleOptimizedSentenceClick,
        currentChunkIndex
    };
};