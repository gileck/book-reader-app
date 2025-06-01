import React from 'react';
import {
    Box,
    LinearProgress,
    Typography,
    Chip
} from '@mui/material';
import {
    CheckCircle,
    Schedule
} from '@mui/icons-material';

interface BookProgressIndicatorProps {
    bookProgress: number; // 0-100
    currentChapter: number;
    totalChapters: number;
    totalReadingTime?: number; // in minutes
    compact?: boolean;
    showTime?: boolean;
}

export const BookProgressIndicator: React.FC<BookProgressIndicatorProps> = ({
    bookProgress,
    currentChapter,
    totalChapters,
    totalReadingTime = 0,
    compact = false,
    showTime = false
}) => {
    const formatTime = (minutes: number): string => {
        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    };

    const chaptersCompleted = Math.max(0, currentChapter - 1);
    const isCompleted = bookProgress >= 100;

    if (compact) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <LinearProgress
                    variant="determinate"
                    value={bookProgress}
                    sx={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: '#f0f0f0',
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: isCompleted ? '#4caf50' : '#4285f4',
                            borderRadius: 2
                        }
                    }}
                />
                <Typography variant="caption" sx={{ minWidth: 'auto', color: 'text.secondary' }}>
                    {bookProgress}%
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            {/* Progress Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <LinearProgress
                    variant="determinate"
                    value={bookProgress}
                    sx={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#f0f0f0',
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: isCompleted ? '#4caf50' : '#4285f4',
                            borderRadius: 3
                        }
                    }}
                />
                <Typography variant="body2" sx={{ minWidth: 'auto', fontWeight: 500 }}>
                    {bookProgress}%
                </Typography>
                {isCompleted && (
                    <CheckCircle sx={{ color: '#4caf50', fontSize: 20 }} />
                )}
            </Box>

            {/* Progress Details */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap'
            }}>
                {/* Chapter Progress */}
                <Chip
                    label={`Ch ${currentChapter}/${totalChapters}`}
                    size="small"
                    variant="outlined"
                    sx={{
                        fontSize: '0.75rem',
                        backgroundColor: isCompleted ? '#e8f5e8' : '#e3f2fd',
                        borderColor: isCompleted ? '#4caf50' : '#4285f4',
                        color: isCompleted ? '#2e7d32' : '#1976d2'
                    }}
                />

                {/* Chapters Completed */}
                {chaptersCompleted > 0 && (
                    <Chip
                        label={`${chaptersCompleted} completed`}
                        size="small"
                        sx={{
                            fontSize: '0.75rem',
                            backgroundColor: '#e8f5e8',
                            color: '#2e7d32'
                        }}
                    />
                )}

                {/* Reading Time */}
                {showTime && totalReadingTime > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {formatTime(totalReadingTime)}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}; 