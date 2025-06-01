import React from 'react';
import {
    Box,
    Typography,
    LinearProgress,
    Grid,
    Card,
    CardContent,
    Chip
} from '@mui/material';
import {
    AutoStories,
    Schedule,
    TrendingUp,
    CheckCircle
} from '@mui/icons-material';

interface ReadingStatsDisplayProps {
    bookProgress: number; // 0-100
    chapterProgress: number; // 0-100
    totalReadingTime: number; // minutes
    currentSessionTime: number; // minutes
    sessionsCount: number;
    currentChapter: number;
    totalChapters: number;
    compact?: boolean; // For smaller display in audio controls
}

export const ReadingStatsDisplay: React.FC<ReadingStatsDisplayProps> = ({
    bookProgress,
    chapterProgress,
    totalReadingTime,
    currentSessionTime,
    sessionsCount,
    currentChapter,
    totalChapters,
    compact = false
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

    if (compact) {
        return (
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                minWidth: 0,
                flex: 1
            }}>
                {/* Book Progress */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <Typography variant="caption" sx={{ color: '#b0b0b0', fontSize: '0.75rem' }}>
                        Book:
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#e0e0e0', fontWeight: 500 }}>
                        {bookProgress}%
                    </Typography>
                </Box>

                {/* Session Time */}
                {currentSessionTime > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Schedule sx={{ fontSize: 14, color: '#b0b0b0' }} />
                        <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
                            {formatTime(currentSessionTime)}
                        </Typography>
                    </Box>
                )}

                {/* Chapter Progress */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: '#b0b0b0', fontSize: '0.75rem' }}>
                        Ch:
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
                        {currentChapter}/{totalChapters}
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Card sx={{
            backgroundColor: '#2a2a2a',
            color: 'white',
            border: '1px solid #404040'
        }}>
            <CardContent>
                <Typography variant="h6" gutterBottom sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    marginBottom: 2
                }}>
                    <AutoStories />
                    Reading Progress
                </Typography>

                <Grid container spacing={3}>
                    {/* Book-wide Progress */}
                    <Grid item xs={12}>
                        <Box sx={{ marginBottom: 1 }}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 1
                            }}>
                                <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                                    Overall Book Progress
                                </Typography>
                                <Typography variant="h6" sx={{ color: '#4285f4', fontWeight: 'bold' }}>
                                    {bookProgress}%
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={bookProgress}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: '#404040',
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor: '#4285f4',
                                        borderRadius: 4
                                    }
                                }}
                            />
                        </Box>
                    </Grid>

                    {/* Current Chapter Progress */}
                    <Grid item xs={12}>
                        <Box sx={{ marginBottom: 2 }}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 1
                            }}>
                                <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                                    Current Chapter Progress
                                </Typography>
                                <Typography variant="body1" sx={{ color: '#81c784', fontWeight: 500 }}>
                                    {chapterProgress}%
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={chapterProgress}
                                sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: '#404040',
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor: '#81c784',
                                        borderRadius: 3
                                    }
                                }}
                            />
                        </Box>
                    </Grid>

                    {/* Statistics */}
                    <Grid item xs={12}>
                        <Grid container spacing={2}>
                            {/* Chapters Completed */}
                            <Grid item xs={6} sm={3}>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                    <CheckCircle sx={{ color: '#81c784', fontSize: 24 }} />
                                    <Typography variant="h6" sx={{ color: '#81c784', fontWeight: 'bold' }}>
                                        {chaptersCompleted}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#b0b0b0', textAlign: 'center' }}>
                                        Chapters Completed
                                    </Typography>
                                </Box>
                            </Grid>

                            {/* Total Reading Time */}
                            <Grid item xs={6} sm={3}>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                    <Schedule sx={{ color: '#ffb74d', fontSize: 24 }} />
                                    <Typography variant="h6" sx={{ color: '#ffb74d', fontWeight: 'bold' }}>
                                        {formatTime(totalReadingTime)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#b0b0b0', textAlign: 'center' }}>
                                        Total Time
                                    </Typography>
                                </Box>
                            </Grid>

                            {/* Current Session */}
                            <Grid item xs={6} sm={3}>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                    <TrendingUp sx={{ color: '#f48fb1', fontSize: 24 }} />
                                    <Typography variant="h6" sx={{ color: '#f48fb1', fontWeight: 'bold' }}>
                                        {formatTime(currentSessionTime)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#b0b0b0', textAlign: 'center' }}>
                                        This Session
                                    </Typography>
                                </Box>
                            </Grid>

                            {/* Sessions Count */}
                            <Grid item xs={6} sm={3}>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                    <AutoStories sx={{ color: '#90caf9', fontSize: 24 }} />
                                    <Typography variant="h6" sx={{ color: '#90caf9', fontWeight: 'bold' }}>
                                        {sessionsCount}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#b0b0b0', textAlign: 'center' }}>
                                        Sessions
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Chapter Status */}
                    <Grid item xs={12}>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            marginTop: 1
                        }}>
                            <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                                Chapter:
                            </Typography>
                            <Chip
                                label={`${currentChapter} of ${totalChapters}`}
                                size="small"
                                sx={{
                                    backgroundColor: '#4285f4',
                                    color: 'white',
                                    fontWeight: 500
                                }}
                            />
                            {chaptersCompleted > 0 && (
                                <Chip
                                    label={`${chaptersCompleted} completed`}
                                    size="small"
                                    sx={{
                                        backgroundColor: '#81c784',
                                        color: 'white'
                                    }}
                                />
                            )}
                        </Box>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
}; 