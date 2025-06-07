import { useCallback, useEffect, useRef } from 'react';
import { createReadingLog } from '../../../../apis/readingLogs/client';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface UseReadingLogsProps {
    userId: string;
    bookId: string | undefined;
    chapter: ChapterClient | null;
    currentChunkIndex: number;
    isPlaying: boolean;
}

export const useReadingLogs = ({
    userId,
    bookId,
    chapter,
    currentChunkIndex,
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

        // Get the text chunks (filter out non-text chunks)
        const textChunks = chapter.content.chunks.filter(chunk => chunk.type === 'text');

        if (chunkIndex >= textChunks.length) return;

        const chunk = textChunks[chunkIndex];
        if (!chunk || chunk.type !== 'text') return;

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
        if (isPlaying &&
            currentChunkIndex !== lastLoggedChunk.current &&
            bookId &&
            chapter &&
            currentChunkIndex >= 0) {

            logChunk(currentChunkIndex);
            lastLoggedChunk.current = currentChunkIndex;
        }
    }, [isPlaying, currentChunkIndex, logChunk, bookId, chapter]);

    // Reset logged chunk when chapter changes
    useEffect(() => {
        lastLoggedChunk.current = -1;
    }, [chapter?.chapterNumber]);

    return {
        logChunk
    };
}; 