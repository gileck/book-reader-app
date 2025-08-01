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

    // Enhanced context gathering with paragraph awareness for Parser v2
    const getSentencesWithParagraphContext = useCallback((
        textChunks: TextChunkClient[],
        currentChunkIndex: number,
        contextCount: number,
        currentParagraphIndex?: number
    ): string => {
        if (textChunks.length === 0) return '';

        // For Parser v2 books with paragraphIndex, use paragraph-aware context
        if (currentParagraphIndex !== undefined) {
            const contextSentences: string[] = [];
            let sentencesAdded = 0;

            // Start from current chunk and work backwards
            for (let i = currentChunkIndex - 1; i >= 0 && sentencesAdded < contextCount; i--) {
                const chunk = textChunks[i];
                if (chunk.type === 'text') {
                    // Include sentences from current paragraph and previous paragraphs
                    // Prioritize current paragraph, then add from previous paragraphs if needed
                    const isCurrentParagraph = chunk.paragraphIndex === currentParagraphIndex;
                    const isPreviousParagraph = chunk.paragraphIndex !== undefined &&
                        chunk.paragraphIndex < currentParagraphIndex;

                    if (isCurrentParagraph || (isPreviousParagraph && sentencesAdded < contextCount * 0.7)) {
                        contextSentences.unshift(chunk.text);
                        sentencesAdded++;
                    }
                }
            }

            return contextSentences.join(' ');
        }

        // Fallback for Parser v1 or books without paragraphIndex
        const startIndex = Math.max(0, currentChunkIndex - contextCount);
        const endIndex = Math.max(0, currentChunkIndex);

        if (startIndex >= endIndex) return '';

        return textChunks
            .slice(startIndex, endIndex)
            .filter(chunk => chunk.type === 'text')
            .map(chunk => chunk.text)
            .join(' ');
    }, []);

    // Define getLastSentences calculation using enhanced paragraph-aware logic
    const getLastSentences = useMemo(() => {
        if (!chapter || audio.textChunks.length === 0) return '';

        const currentChunk = audio.textChunks[audio.currentChunkIndex];
        const currentParagraphIndex = currentChunk?.paragraphIndex;

        return getSentencesWithParagraphContext(
            audio.textChunks,
            audio.currentChunkIndex,
            bookQA.contextLines,
            currentParagraphIndex
        );
    }, [chapter, audio.textChunks, audio.currentChunkIndex, bookQA.contextLines, getSentencesWithParagraphContext]);

    // Get context for a specific chunk (useful for bookmark context)
    const getContextForChunk = useCallback((chunkIndex: number, contextLines: number = 3): string => {
        if (!chapter || audio.textChunks.length === 0) return '';

        const targetChunk = audio.textChunks[chunkIndex];
        const targetParagraphIndex = targetChunk?.paragraphIndex;

        return getSentencesWithParagraphContext(
            audio.textChunks,
            chunkIndex,
            contextLines,
            targetParagraphIndex
        );
    }, [chapter, audio.textChunks, getSentencesWithParagraphContext]);

    // Get paragraph boundaries for advanced AI context
    const getParagraphBoundaries = useCallback((chunkIndex: number) => {
        if (!chapter || audio.textChunks.length === 0) return null;

        const currentChunk = audio.textChunks[chunkIndex];
        if (!currentChunk || currentChunk.paragraphIndex === undefined) return null;

        const paragraphIndex = currentChunk.paragraphIndex;
        let startIndex = chunkIndex;
        let endIndex = chunkIndex;

        // Find start of paragraph
        while (startIndex > 0 &&
            audio.textChunks[startIndex - 1]?.paragraphIndex === paragraphIndex) {
            startIndex--;
        }

        // Find end of paragraph
        while (endIndex < audio.textChunks.length - 1 &&
            audio.textChunks[endIndex + 1]?.paragraphIndex === paragraphIndex) {
            endIndex++;
        }

        return {
            startIndex,
            endIndex,
            paragraphIndex,
            sentences: audio.textChunks
                .slice(startIndex, endIndex + 1)
                .map(chunk => chunk.text)
                .join(' ')
        };
    }, [chapter, audio.textChunks]);

    return {
        getCurrentSentence,
        getLastSentences,
        getContextForChunk,
        getParagraphBoundaries,
        getSentencesWithParagraphContext
    };
};