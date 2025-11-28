import { useCallback, useEffect, useRef } from 'react';
import { createReadingLog } from '../../../../apis/readingLogs/client';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface UseReadingLogsProps {
    userId: string;
    bookId: string | undefined;
    chapter: ChapterClient | null;
    currentSentenceIndex: number | null;
    isPlaying: boolean;
}

export const useReadingLogs = ({
    userId,
    bookId,
    chapter,
    currentSentenceIndex,
    isPlaying
}: UseReadingLogsProps) => {
    const lastLoggedChunk = useRef<number>(-1);
    const isPlayingRef = useRef<boolean>(false);

    // Update playing ref
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    const logChunk = useCallback(async (chunkIndex: number) => {
        if (!bookId || !chapter || chunkIndex < 0) return;

        // Get all chunks (chunkIndex refers to position in full array)
        const allChunks = chapter.content.chunks;

        if (chunkIndex >= allChunks.length) return;

        const chunk = allChunks[chunkIndex];
        if (!chunk) return;

        // Only log text and header chunks (skip images and empty chunks)
        if (chunk.type === 'image' || !chunk.text?.trim()) return;

        try {
            await createReadingLog({
                userId,
                bookId,
                chapterNumber: chapter.chapterNumber,
                chunkIndex,
                chunkText: chunk.text
            });
        } catch (error) {
            console.error('Error logging reading chunk:', error);
        }
    }, [userId, bookId, chapter]);

    // Log chunk when it starts playing
    useEffect(() => {
        // Only log if:
        // 1. Audio is playing
        // 2. We haven't already logged this chunk
        // 3. We have valid data
        // 4. currentSentenceIndex is not null
        if (isPlaying &&
            currentSentenceIndex !== null &&
            currentSentenceIndex !== lastLoggedChunk.current &&
            bookId &&
            chapter &&
            currentSentenceIndex >= 0) {

            logChunk(currentSentenceIndex);
            lastLoggedChunk.current = currentSentenceIndex;
        }
    }, [isPlaying, currentSentenceIndex, logChunk, bookId, chapter]);

    // Reset logged chunk when chapter changes
    useEffect(() => {
        lastLoggedChunk.current = -1;
    }, [chapter?.chapterNumber]);

    return {
        logChunk
    };
}; 