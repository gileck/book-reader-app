import React from 'react';
import {
    Box,
    IconButton,
    Typography,
    LinearProgress,
    CircularProgress
} from '@mui/material';
import {
    PlayArrow,
    Pause,
    SkipPrevious,
    SkipNext,
    ChevronLeft,
    ChevronRight,
    Settings,
    QuestionMark
} from '@mui/icons-material';
import { BookmarkDropdown } from './BookmarkDropdown';
import type { BookmarkClient } from '../../apis/bookmarks/types';

interface AudioControlsProps {
    chapterTitle: string;
    currentChunk: number;
    totalChunks: number;
    onPlay: () => void;
    onPause: () => void;
    onPreviousChunk: () => void;
    onNextChunk: () => void;
    onPreviousChapter: () => void;
    onNextChapter: () => void;
    onBookmark: () => void;
    onSettings: () => void;
    onSpeedSettings: () => void;
    onAskAI: () => void;
    isPlaying: boolean;
    isCurrentChunkLoading?: boolean;
    isBookmarked?: boolean;
    progress: number; // 0-100 (chapter progress)
    playbackSpeed?: number;
    bookmarks?: BookmarkClient[];
    currentChapterNumber?: number;
    currentChunkIndex?: number;
    totalChapters?: number;
    onNavigateToBookmark?: (chapterNumber: number, chunkIndex: number) => void;
    // Enhanced progress data
    progressData?: {
        chapterProgress: number;
        bookProgress: number;
        totalReadingTime: number;
        currentSessionTime: number;
        sessionsCount: number;
    };
}

export const AudioControls: React.FC<AudioControlsProps> = ({
    chapterTitle,
    currentChunk,
    totalChunks,
    onPlay,
    onPause,
    onPreviousChunk,
    onNextChunk,
    onPreviousChapter,
    onNextChapter,
    onBookmark,
    onSettings,
    onSpeedSettings,
    onAskAI,
    isPlaying,
    isCurrentChunkLoading = false,
    isBookmarked = false,
    progress,
    playbackSpeed = 1.0,
    bookmarks = [],
    currentChapterNumber = 1,
    currentChunkIndex = 0,
    totalChapters = 1,
    onNavigateToBookmark
}) => {
    // Use local progress for immediate feedback, fall back to server progress
    const displayProgress = progress;

    return (
        <Box sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #333',
            padding: 2,
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 1000
        }}>
            {/* Chapter Title and Navigation */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1
            }}>
                <IconButton
                    onClick={onPreviousChapter}
                    disabled={currentChapterNumber <= 1}
                    sx={{
                        color: 'white',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                        '&:disabled': { color: 'rgba(255,255,255,0.3)' },
                        p: 1
                    }}
                    size="medium"
                >
                    <ChevronLeft sx={{ fontSize: 24 }} />
                </IconButton>

                <Typography
                    variant="body2"
                    sx={{
                        textAlign: 'center',
                        fontWeight: 500,
                        color: '#e0e0e0',
                        flex: 1,
                        fontSize: '1rem'
                    }}
                >
                    {chapterTitle}
                </Typography>

                <IconButton
                    onClick={onNextChapter}
                    disabled={totalChapters ? currentChapterNumber >= totalChapters : false}
                    sx={{
                        color: 'white',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                        '&:disabled': { color: 'rgba(255,255,255,0.3)' },
                        p: 1
                    }}
                    size="medium"
                >
                    <ChevronRight sx={{ fontSize: 24 }} />
                </IconButton>
            </Box>

            {/* Enhanced Progress Bar */}
            <Box sx={{ mb: 1 }}>
                <LinearProgress
                    variant="determinate"
                    value={displayProgress}
                    sx={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: '#404040',
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: '#4285f4',
                            borderRadius: 2
                        }
                    }}
                />
            </Box>

            {/* Reading Stats and Sentence Counter */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
                minHeight: 24
            }}>
                {/* Sentence Counter (centered) */}
                <Typography
                    variant="body2"
                    sx={{
                        color: '#b0b0b0',
                        fontWeight: 400,
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {currentChunk} of {totalChunks} sentences
                </Typography>
            </Box>

            {/* Main Controls */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                position: 'relative'
            }}>
                {/* Left Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 100 }}>
                    {/* Ask AI Button */}
                    <IconButton
                        onClick={onAskAI}
                        sx={{
                            color: 'white',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                            p: 1
                        }}
                        size="medium"
                    >
                        <QuestionMark />
                    </IconButton>

                    {/* Settings Button */}
                    <IconButton
                        onClick={onSettings}
                        sx={{
                            color: 'white',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                            p: 1
                        }}
                        size="medium"
                    >
                        <Settings />
                    </IconButton>
                </Box>

                {/* Centered Play Controls */}
                <Box sx={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                }}>
                    {/* Previous Chunk Button */}
                    <IconButton
                        onClick={onPreviousChunk}
                        disabled={currentChunk <= 1}
                        sx={{
                            color: 'white',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                            '&:disabled': { color: 'rgba(255,255,255,0.3)' },
                            p: 1
                        }}
                        size="large"
                    >
                        <SkipPrevious />
                    </IconButton>

                    {/* Play/Pause Button */}
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <IconButton
                            onClick={isPlaying ? onPause : onPlay}
                            disabled={isCurrentChunkLoading}
                            sx={{
                                backgroundColor: isCurrentChunkLoading
                                    ? '#666'
                                    : isPlaying ? '#f44336' : '#4caf50',
                                color: 'white',
                                '&:hover': {
                                    backgroundColor: isCurrentChunkLoading
                                        ? '#666'
                                        : isPlaying ? '#d32f2f' : '#388e3c'
                                },
                                '&:disabled': {
                                    backgroundColor: '#666',
                                    color: 'rgba(255,255,255,0.6)'
                                },
                                width: 64,
                                height: 64,
                                mx: 1
                            }}
                            size="large"
                        >
                            {isPlaying ? <Pause sx={{ fontSize: 32 }} /> : <PlayArrow sx={{ fontSize: 32 }} />}
                        </IconButton>
                        {isCurrentChunkLoading && (
                            <CircularProgress
                                size={68}
                                sx={{
                                    color: '#4caf50',
                                    position: 'absolute',
                                    top: -2,
                                    left: 14,
                                    zIndex: 1,
                                }}
                            />
                        )}
                    </Box>

                    {/* Next Chunk Button */}
                    <IconButton
                        onClick={onNextChunk}
                        disabled={currentChunk >= totalChunks}
                        sx={{
                            color: 'white',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                            '&:disabled': { color: 'rgba(255,255,255,0.3)' },
                            p: 1
                        }}
                        size="large"
                    >
                        <SkipNext />
                    </IconButton>
                </Box>

                {/* Right Controls */}
                <Box sx={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    minWidth: 100,
                    justifyContent: 'flex-end'
                }}>
                    {/* Speed Control Button */}
                    <IconButton
                        onClick={onSpeedSettings}
                        sx={{
                            color: 'white',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                            minWidth: 50,
                            height: 48,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            p: 1
                        }}
                    >
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {playbackSpeed}x
                        </Typography>
                    </IconButton>

                    {/* Bookmark Button */}
                    <BookmarkDropdown
                        bookmarks={bookmarks}
                        currentChapterNumber={currentChapterNumber}
                        currentChunkIndex={currentChunkIndex}
                        onNavigateToBookmark={onNavigateToBookmark}
                        onToggleBookmark={onBookmark}
                        isCurrentBookmarked={isBookmarked}
                    />
                </Box>
            </Box>
        </Box>
    );
}; 