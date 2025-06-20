import { useEffect, useCallback, useRef, useState } from 'react';
import { updateReadingPosition } from '../../../../apis/readingProgress/client';

interface UseReadingProgressProps {
    userId: string;
    bookId: string | undefined;
    currentChapterNumber: number | null;
    currentChunkIndex: number | null;
    isPlaying?: boolean; // Track if audio is playing for session time
    isInitialLoadComplete?: boolean; // Flag to indicate if initial reading position is loaded
}

export const useReadingProgress = ({
    userId,
    bookId,
    currentChapterNumber,
    currentChunkIndex,
    isPlaying = false,
    isInitialLoadComplete = false
}: UseReadingProgressProps) => {
    const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const sessionStartTime = useRef<number>(Date.now());
    const lastActiveTime = useRef<number>(Date.now());
    const accumulatedSessionTime = useRef<number>(0);

    const [progressData, setProgressData] = useState<{
        chapterProgress: number;
        bookProgress: number;
        totalReadingTime: number;
        sessionsCount: number;
    }>({
        chapterProgress: 0,
        bookProgress: 0,
        totalReadingTime: 0,
        sessionsCount: 0
    });

    // Track session time when audio is playing
    useEffect(() => {
        if (isPlaying) {
            lastActiveTime.current = Date.now();

            const interval = setInterval(() => {
                const now = Date.now();
                const timeSinceLastActive = now - lastActiveTime.current;

                // Only count time if user was recently active (within 10 seconds)
                if (timeSinceLastActive < 10000) {
                    accumulatedSessionTime.current += 1; // Add 1 second
                }
                lastActiveTime.current = now;
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [isPlaying]);

    // Calculate current session time
    const getCurrentSessionTime = useCallback(() => {
        return Math.round(accumulatedSessionTime.current / 60); // Convert to minutes
    }, []);

    // Save reading progress with session time
    const saveProgress = useCallback(async () => {
        if (!bookId) return;

        try {
            const sessionTimeMinutes = getCurrentSessionTime();

            const result = await updateReadingPosition({
                userId,
                bookId,
                currentChapter: currentChapterNumber!,
                currentChunk: currentChunkIndex!,
                sessionTimeMinutes: sessionTimeMinutes > 0 ? sessionTimeMinutes : undefined
            });

            // Update progress data from server response
            if (result.data?.success && result.data.readingProgress) {
                const progress = result.data.readingProgress;
                setProgressData({
                    chapterProgress: progress.chapterProgress,
                    bookProgress: progress.bookProgress,
                    totalReadingTime: progress.totalReadingTime,
                    sessionsCount: progress.sessionsCount
                });
            }

            // Reset session time after saving
            accumulatedSessionTime.current = 0;
            sessionStartTime.current = Date.now();
        } catch (error) {
            console.error('Error saving reading progress:', error);
        }
    }, [userId, bookId, currentChapterNumber, currentChunkIndex, getCurrentSessionTime]);

    // Debounced save when position changes - only after initial load is complete
    useEffect(() => {
        // Don't save until initial reading position is loaded from database
        // and we have valid chapter/chunk values (not null)
        if (!bookId || !isInitialLoadComplete || currentChapterNumber === null || currentChunkIndex === null) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            saveProgress();
        }, 2000); // Save after 2 seconds of no changes

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [currentChapterNumber, currentChunkIndex, saveProgress, bookId, isInitialLoadComplete]);

    // Save immediately when component unmounts
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            // Fire and forget immediate save
            if (bookId) {
                saveProgress();
            }
        };
    }, [saveProgress, bookId]);

    return {
        isLoadingProgress: false, // No longer loading since main hook handles this
        progressData,
        getCurrentSessionTime
    };
}; 