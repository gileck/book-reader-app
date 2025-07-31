import { useMemo, useCallback } from 'react';
import type { ChapterClient, TextChunkClient } from '../../../../apis/chapters/types';

interface AudioState {
    textChunks: TextChunkClient[];
    currentChunkIndex: number;
}

interface BookQAState {
    contextLines: number;
}

export const useContentContext = (
    chapter: ChapterClient | null,
    audio: AudioState,
    bookQA: BookQAState
) => {
    // Get current reading context for Q&A
    const getCurrentSentence = useCallback(() => {
        if (!chapter || !audio.textChunks[audio.currentChunkIndex]) return '';
        return audio.textChunks[audio.currentChunkIndex].text;
    }, [chapter, audio.textChunks, audio.currentChunkIndex]);

    // Define getLastSentences calculation using useMemo
    const getLastSentences = useMemo(() => {
        if (!chapter || audio.textChunks.length === 0) return '';
        const contextCount = bookQA.contextLines;
        const startIndex = Math.max(0, audio.currentChunkIndex - contextCount);
        const endIndex = Math.max(0, audio.currentChunkIndex);

        if (startIndex >= endIndex) return '';

        const lastSentences = audio.textChunks
            .slice(startIndex, endIndex)
            .map(chunk => chunk.text)
            .join(' ');
        return lastSentences;
    }, [chapter, audio.textChunks, audio.currentChunkIndex, bookQA.contextLines]);

    return {
        getCurrentSentence,
        getLastSentences
    };
};