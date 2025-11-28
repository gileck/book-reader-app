import type { TextChunkClient } from '@/apis/chapters/types';

/**
 * Measured real-world pause between sentences at 1x speed.
 * This includes:
 * - 100ms setTimeout delay
 * - Audio element startup/initialization (~300-400ms)
 * - Audio decoding/buffering (~200-300ms)
 * - Browser audio pipeline latency (~100-200ms)
 * 
 * Actual measured pause: 800-1000ms at 1x speed
 * We use 900ms as a conservative middle estimate
 */
const BASE_INTER_SENTENCE_PAUSE_MS = 900;

/**
 * Calculates the estimated time remaining to finish reading/listening to the chapter
 * based on the number of words remaining and the current playback speed.
 * 
 * @param chunks - All text chunks in the chapter
 * @param currentSentenceIndex - Current chunk/sentence index (0-based)
 * @param playbackSpeed - Current playback speed multiplier (e.g., 1.0, 1.5, 2.0)
 * @returns Estimated time remaining in seconds
 */
export function calculateTimeRemaining(
    chunks: TextChunkClient[],
    currentSentenceIndex: number,
    playbackSpeed: number
): number {
    // Get remaining chunks (excluding current one)
    const remainingChunks = chunks
        .slice(currentSentenceIndex + 1)
        .filter(chunk => chunk.type === 'text' || chunk.type === 'header');

    // Count words in all remaining chunks
    const remainingWords = remainingChunks.reduce((total, chunk) => total + (chunk.wordCount || 0), 0);

    // Average speaking rate: ~150 words per minute at 1x speed
    // Adjusted by playback speed (higher speed = less time)
    const wordsPerMinute = 150 * playbackSpeed;
    const estimatedMinutes = remainingWords / wordsPerMinute;
    const audioPlaybackSeconds = estimatedMinutes * 60;

    // Add inter-sentence pauses
    // The pause duration is affected by playback speed:
    // Measured values:
    // - At 1x speed: ~900ms
    // - At 2x speed: ~500ms
    // 
    // This gives us a linear relationship:
    // pause = 900ms - (speed - 1) * 400ms
    // 
    // At 1x: 900 - 0 = 900ms
    // At 1.5x: 900 - 200 = 700ms
    // At 2x: 900 - 400 = 500ms
    // 
    // Floor at 300ms to avoid negative or unrealistic values at very high speeds
    const pauseReduction = (playbackSpeed - 1) * 400;
    const adjustedPauseMs = Math.max(300, BASE_INTER_SENTENCE_PAUSE_MS - pauseReduction);

    const numberOfPauses = remainingChunks.length;
    const pauseTimeSeconds = (numberOfPauses * adjustedPauseMs) / 1000;

    return audioPlaybackSeconds + pauseTimeSeconds;
}

/**
 * Formats seconds into a human-readable time string
 * 
 * @param seconds - Time in seconds
 * @returns Formatted string like "4m", "1h 23m", or "45s"
 */
export function formatTimeRemaining(seconds: number): string {
    if (seconds < 60) {
        return `${Math.ceil(seconds)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
        if (remainingMinutes > 0) {
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${hours}h`;
    }

    return `${minutes}m`;
}

/**
 * Calculates and formats the time remaining for display
 * 
 * @param chunks - All text chunks in the chapter
 * @param currentSentenceIndex - Current chunk/sentence index (0-based)
 * @param playbackSpeed - Current playback speed multiplier
 * @returns Formatted time string (e.g., "4m") or empty string if no time remaining
 */
export function getFormattedTimeRemaining(
    chunks: TextChunkClient[],
    currentSentenceIndex: number,
    playbackSpeed: number
): string {
    const seconds = calculateTimeRemaining(chunks, currentSentenceIndex, playbackSpeed);

    // If less than 10 seconds, don't show anything
    if (seconds < 10) {
        return '';
    }

    return formatTimeRemaining(seconds);
}

