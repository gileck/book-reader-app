import React from 'react';
import { LinearProgress } from '@mui/material';

interface ChapterProgressBarProps {
    /** Current sentence index (0-based) */
    currentSentenceIndex: number;
    /** Total number of sentences in the chapter */
    totalSentences: number;
}

/**
 * ChapterProgressBar - Visual progress indicator for chapter reading progress
 * 
 * Displays a progress bar showing the current position within the chapter
 * based on the current sentence index. Updates automatically as the user navigates
 * through sentences. Designed to be embedded within the FullscreenTextControls panel.
 * 
 * Features:
 * - Clean, minimal design without text values
 * - Smooth transitions between updates
 * - iOS-inspired styling with proper theming
 * - Responsive to light/dark mode
 * 
 * @example
 * ```tsx
 * <ChapterProgressBar
 *   currentSentenceIndex={25}
 *   totalSentences={100}
 * />
 * ```
 */
export const ChapterProgressBar: React.FC<ChapterProgressBarProps> = ({
    currentSentenceIndex,
    totalSentences
}) => {
    // Calculate progress percentage (0-100)
    const progress = totalSentences > 0
        ? Math.min(100, Math.max(0, (currentSentenceIndex / (totalSentences - 1)) * 100))
        : 0;

    return (
        <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                '& .MuiLinearProgress-bar': {
                    borderRadius: 2,
                    transition: 'transform 0.3s ease-in-out',
                    backgroundColor: 'primary.main'
                },
                '@media (prefers-color-scheme: dark)': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
            }}
            aria-label={`Chapter progress: ${Math.round(progress)}%`}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
        />
    );
};

