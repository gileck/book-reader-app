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
    
    // Use refs to always access current values without dependency cycles
    const currentChapterRef = useRef(currentChapterNumber);
    const currentChunkRef = useRef(currentChunkIndex);
    
    // Update refs when values change
    useEffect(() => {
        currentChapterRef.current = currentChapterNumber;
        currentChunkRef.current = currentChunkIndex;
    }, [currentChapterNumber, currentChunkIndex]);

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

    const [alert, setAlert] = useState<{
        open: boolean;
        message: string;
        severity: 'error' | 'warning' | 'info' | 'success';
    }>({
        open: false,
        message: '',
        severity: 'error'
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

    // Show alert function
    const showAlert = useCallback((message: string, severity: 'error' | 'warning' | 'info' | 'success' = 'error') => {
        setAlert({
            open: true,
            message,
            severity
        });
    }, []);

    // Close alert function
    const closeAlert = useCallback(() => {
        setAlert(prev => ({ ...prev, open: false }));
    }, []);

    // Save reading progress with session time
    const saveProgress = useCallback(async () => {
        if (!bookId) return;

        // Get current values from refs (always fresh, no stale closure)
        const chapterToSave = currentChapterRef.current;
        const chunkToSave = currentChunkRef.current;
        
        // Don't save if we don't have valid values
        if (chapterToSave === null || chunkToSave === null) return;

        try {
            const sessionTimeMinutes = getCurrentSessionTime();

            const result = await updateReadingPosition({
                userId,
                bookId,
                currentChapter: chapterToSave,
                currentChunk: chunkToSave,
                sessionTimeMinutes: sessionTimeMinutes > 0 ? sessionTimeMinutes : undefined
            });

            // Check if the API returned an error
            if (result.data && !result.data.success) {
                console.error('Error saving reading progress:', result.data.error);
                // Show user-friendly error message
                if (result.data.error) {
                    showAlert(`Reading Progress Error: ${result.data.error}`, 'error');
                }
                return;
            }

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
            // Show generic error message for network/unexpected errors
            showAlert('Unable to save reading progress. Please check your connection and try again.', 'error');
        }
    }, [userId, bookId, getCurrentSessionTime, showAlert]);

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
            // Fire and forget immediate save - saveProgress will check for valid values
            if (bookId) {
                saveProgress();
            }
        };
    }, [saveProgress, bookId]);

    return {
        isLoadingProgress: false, // No longer loading since main hook handles this
        progressData,
        getCurrentSessionTime,
        alert,
        closeAlert
    };
}; 