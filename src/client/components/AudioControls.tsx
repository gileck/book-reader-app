import React, { useState } from 'react';
import {
    Box,
    IconButton,
    Typography,
    LinearProgress,
    Alert,
    AlertTitle,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
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
    QuestionMark,
    List,
    Close,
    Menu,
    VerticalAlignTop,
    MyLocation,
    Fullscreen
} from '@mui/icons-material';
import { BookmarkDropdown } from './BookmarkDropdown';
import type { BookmarkClient } from '../../apis/bookmarks/types';
import type { TtsErrorDetail } from '../../apis/tts/types';

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
    onQuickPrompts?: () => void;
    onChapters?: () => void;
    isPlaying: boolean;
    ttsEnabled?: boolean;
    isCurrentChunkLoading?: boolean;
    isBookmarked?: boolean;
    progress: number; // 0-100 (chapter progress)
    playbackSpeed?: number;
    bookmarks?: BookmarkClient[];
    currentChapterNumber?: number;
    currentSentenceIndex?: number;
    totalChapters?: number;
    minChapterNumber?: number;
    onNavigateToBookmark?: (chapterNumber: number, chunkIndex: number) => void;
    onNavigateToChunk?: (chunkIndex: number) => void;
    ttsServiceAvailable?: boolean;
    ttsError?: TtsErrorDetail | null;
    onDismissError?: () => void;
    chapterTransitionLoading?: boolean;
    // Enhanced progress data
    progressData?: {
        chapterProgress: number;
        bookProgress: number;
        totalReadingTime: number;
        currentSessionTime: number;
        sessionsCount: number;
    };
    unitLabelOverride?: string;
    estimatedTimeRemaining?: string;
    hideChapterInfo?: boolean; // Hide chapter title and progress bar
    // Navigation controls (integrated into audio controls)
    onJumpToCurrentChunk?: () => void; // Handler to scroll to currently playing chunk
    showJumpToCurrentChunk?: boolean; // Show "Jump to current chunk" button (left side)
    onToggleFullscreen?: () => void; // Handler to toggle fullscreen mode
    showFullscreenButton?: boolean; // Show fullscreen button (right side)
    onGoToTop?: () => void; // Handler to navigate to first sentence and scroll to top
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
    onQuickPrompts,
    onChapters,
    isPlaying,
    ttsEnabled = true,
    isCurrentChunkLoading = false,
    isBookmarked = false,
    progress,
    playbackSpeed = 1.0,
    bookmarks = [],
    currentChapterNumber = 1,
    currentSentenceIndex = 0,
    totalChapters = 1,
    minChapterNumber = 1,
    onNavigateToBookmark,
    onNavigateToChunk,
    ttsServiceAvailable = true,
    ttsError,
    onDismissError,
    chapterTransitionLoading = false,
    unitLabelOverride,
    estimatedTimeRemaining,
    hideChapterInfo = false,
    onJumpToCurrentChunk,
    showJumpToCurrentChunk = false,
    onToggleFullscreen,
    showFullscreenButton = false,
    onGoToTop
}) => {
    // Use local progress for immediate feedback, fall back to server progress
    const displayProgress = progress;

    // Determine if play button should be disabled
    const ttsDisabled = !ttsEnabled;
    const hasError = !!ttsError || !ttsServiceAvailable;

    // Sentence navigation dialog state
    const [navigationDialogOpen, setNavigationDialogOpen] = useState(false);
    const [targetSentence, setTargetSentence] = useState('');

    return (
        <Box sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #333',
            padding: 2,
            paddingBottom: 'max(30px, env(safe-area-inset-bottom))',
            zIndex: 1000
        }}>
            {/* Chapter Transition Progress Bar - Overlay at top */}
            {chapterTransitionLoading && (
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1001
                }}>
                    <LinearProgress
                        sx={{
                            height: 3,
                            borderRadius: 0,
                            backgroundColor: 'rgba(64, 64, 64, 0.3)',
                            '& .MuiLinearProgress-bar': {
                                backgroundColor: '#ff9800',
                                borderRadius: 0
                            }
                        }}
                    />
                </Box>
            )}
            {/* Error Alert - Show when there's a TTS error (but not when TTS is disabled) */}
            {hasError && !ttsDisabled && (
                <Box sx={{ mb: 2, mx: 'auto', maxWidth: 600 }}>
                    <Alert
                        severity="error"
                        variant="filled"
                        sx={{
                            backgroundColor: '#d32f2f',
                            color: 'white',
                            '& .MuiAlert-icon': {
                                color: 'white'
                            }
                        }}
                        action={
                            onDismissError && (
                                <IconButton
                                    aria-label="close"
                                    color="inherit"
                                    size="small"
                                    onClick={onDismissError}
                                    sx={{
                                        color: 'white',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                                        }
                                    }}
                                >
                                    <Close fontSize="inherit" />
                                </IconButton>
                            )
                        }
                    >
                        <AlertTitle sx={{ color: 'white', fontWeight: 'bold' }}>
                            Audio Unavailable
                        </AlertTitle>
                        {ttsError?.message || 'Audio service is currently unavailable. Please check your TTS configuration.'}
                        {ttsError?.provider && (
                            <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: '0.875em', opacity: 0.9 }}>
                                Provider: {ttsError.provider.charAt(0).toUpperCase() + ttsError.provider.slice(1)}
                            </Box>
                        )}
                    </Alert>
                </Box>
            )}

            {/* Chapter Title and Navigation */}
            {!hideChapterInfo && (
                <>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 1
                    }}>
                        <IconButton
                            onClick={onPreviousChapter}
                            disabled={currentChapterNumber <= minChapterNumber}
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

                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flex: 1,
                            justifyContent: 'center',
                            gap: 1
                        }}>
                            <Typography
                                variant="body2"
                                sx={{
                                    textAlign: 'center',
                                    fontWeight: 500,
                                    color: '#e0e0e0',
                                    fontSize: '1rem'
                                }}
                            >
                                {chapterTitle}
                            </Typography>
                            {onChapters && (
                                <IconButton
                                    onClick={onChapters}
                                    sx={{
                                        color: 'white',
                                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                                        p: 0.5
                                    }}
                                    size="small"
                                >
                                    <List sx={{ fontSize: 18 }} />
                                </IconButton>
                            )}
                        </Box>

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
                        justifyContent: 'space-between',
                        mb: 2,
                        minHeight: 24,
                        gap: 1
                    }}>
                        {/* Left side buttons */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'fit-content' }}>
                            {/* Jump to Current Chunk Button */}
                            {showJumpToCurrentChunk && onJumpToCurrentChunk && (
                                <IconButton
                                    onClick={onJumpToCurrentChunk}
                                    size="small"
                                    sx={{
                                        color: '#4285f4',
                                        padding: '6px',
                                        '&:hover': {
                                            color: '#5a9fff',
                                            backgroundColor: 'rgba(66, 133, 244, 0.1)'
                                        }
                                    }}
                                    title="Jump to current chunk"
                                >
                                    <MyLocation sx={{ fontSize: 20 }} />
                                </IconButton>
                            )}

                            {/* Go to Top Button */}
                            <IconButton
                                onClick={onGoToTop || (() => onNavigateToChunk?.(0))}
                                size="small"
                                sx={{
                                    color: '#b0b0b0',
                                    padding: '4px',
                                    '&:hover': {
                                        color: '#e0e0e0',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                    }
                                }}
                                title="Go to first sentence"
                            >
                                <VerticalAlignTop sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Box>

                        {/* Center: Sentence Counter */}
                        <Typography
                            variant="body2"
                            sx={{
                                color: '#b0b0b0',
                                fontWeight: 400,
                                fontSize: '0.875rem',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {currentChunk} of {totalChunks} {unitLabelOverride || 'sentences'}
                            {estimatedTimeRemaining && (
                                <Box
                                    component="span"
                                    sx={{
                                        ml: 1,
                                        color: '#4285f4',
                                        fontWeight: 500
                                    }}
                                >
                                    ({estimatedTimeRemaining})
                                </Box>
                            )}
                        </Typography>

                        {/* Right side buttons */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'fit-content' }}>
                            {/* Navigate to Sentence Button */}
                            <IconButton
                                onClick={() => setNavigationDialogOpen(true)}
                                size="small"
                                sx={{
                                    color: '#b0b0b0',
                                    padding: '4px',
                                    '&:hover': {
                                        color: '#e0e0e0',
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                    }
                                }}
                                title="Go to sentence..."
                            >
                                <Menu sx={{ fontSize: 18 }} />
                            </IconButton>

                            {/* Fullscreen Button */}
                            {showFullscreenButton && onToggleFullscreen && (
                                <IconButton
                                    onClick={onToggleFullscreen}
                                    size="small"
                                    sx={{
                                        color: '#b0b0b0',
                                        padding: '6px',
                                        '&:hover': {
                                            color: '#e0e0e0',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                        }
                                    }}
                                    title="Enter fullscreen"
                                >
                                    <Fullscreen sx={{ fontSize: 20 }} />
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                </>
            )}

            {/* Main Controls */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                position: 'relative'
            }}>
                {/* Left Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 100 }}>
                    {/* Quick Prompts Button */}
                    <IconButton
                        onClick={onQuickPrompts || onAskAI}
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

                    {/* Play/Pause Button with Loading Indicator */}
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <IconButton
                            onClick={isPlaying ? onPause : onPlay}
                            disabled={
                                isPlaying
                                    ? false // Never disable pause - users should always be able to stop audio
                                    : (isCurrentChunkLoading || hasError || ttsDisabled) // Only disable play if there's an issue
                            }
                            title={
                                isPlaying
                                    ? 'Pause'
                                    : ttsDisabled
                                        ? 'Text-to-Speech is disabled'
                                        : hasError
                                            ? `Audio unavailable: ${ttsError?.message || 'Check TTS configuration'}`
                                            : isCurrentChunkLoading
                                                ? 'Loading current audio...'
                                                : 'Play'
                            }
                            sx={{
                                backgroundColor:
                                    isPlaying
                                        ? '#f44336' // Red for pause (always enabled)
                                        : (hasError || ttsDisabled)
                                            ? '#9e9e9e' // Gray when disabled due to error or TTS is off
                                            : '#4caf50', // Green for play
                                color: 'white',
                                '&:hover': {
                                    backgroundColor:
                                        isPlaying
                                            ? '#d32f2f' // Darker red on hover for pause
                                            : (hasError || ttsDisabled)
                                                ? '#757575' // Darker gray on hover when disabled
                                                : '#388e3c' // Darker green for play
                                },
                                '&:disabled': {
                                    backgroundColor: '#9e9e9e', // Keep gray when disabled
                                    color: 'white'
                                },
                                width: 64,
                                height: 64,
                                mx: 1
                            }}
                            size="large"
                        >
                            {isPlaying ? (
                                <Pause sx={{ fontSize: 32 }} />
                            ) : (
                                <PlayArrow sx={{ fontSize: 32 }} />
                            )}
                        </IconButton>
                        {/* Loading Spinner Overlay */}
                        {isCurrentChunkLoading && (
                            <CircularProgress
                                size={72}
                                thickness={2}
                                sx={{
                                    color: '#4caf50',
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    marginTop: '-36px',
                                    marginLeft: '-36px',
                                    zIndex: 1
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
                            {playbackSpeed.toFixed(1)}x
                        </Typography>
                    </IconButton>

                    {/* Bookmark Button */}
                    <BookmarkDropdown
                        bookmarks={bookmarks}
                        currentChapterNumber={currentChapterNumber}
                        currentSentenceIndex={currentSentenceIndex}
                        onNavigateToBookmark={onNavigateToBookmark}
                        onToggleBookmark={onBookmark}
                        isCurrentBookmarked={isBookmarked}
                    />
                </Box>
            </Box>

            {/* Sentence Navigation Dialog */}
            <Dialog
                open={navigationDialogOpen}
                onClose={() => {
                    setNavigationDialogOpen(false);
                    setTargetSentence('');
                }}
                PaperProps={{
                    sx: {
                        backgroundColor: '#1a1a1a',
                        color: 'white',
                        minWidth: 300
                    }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>Go to Sentence</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={`Sentence (1-${totalChunks})`}
                        type="number"
                        fullWidth
                        variant="outlined"
                        value={targetSentence}
                        onChange={(e) => setTargetSentence(e.target.value)}
                        inputProps={{
                            min: 1,
                            max: totalChunks
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                color: 'white',
                                '& fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.23)'
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.4)'
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#4285f4'
                                }
                            },
                            '& .MuiInputLabel-root': {
                                color: 'rgba(255, 255, 255, 0.7)'
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const sentence = parseInt(targetSentence);
                                if (sentence >= 1 && sentence <= totalChunks) {
                                    onNavigateToChunk?.(sentence - 1);
                                    setNavigationDialogOpen(false);
                                    setTargetSentence('');
                                }
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => {
                            setNavigationDialogOpen(false);
                            setTargetSentence('');
                        }}
                        sx={{ color: '#b0b0b0' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            const sentence = parseInt(targetSentence);
                            if (sentence >= 1 && sentence <= totalChunks) {
                                onNavigateToChunk?.(sentence - 1);
                                setNavigationDialogOpen(false);
                                setTargetSentence('');
                            }
                        }}
                        sx={{
                            backgroundColor: '#4285f4',
                            color: 'white',
                            '&:hover': {
                                backgroundColor: '#3367d6'
                            }
                        }}
                        disabled={
                            !targetSentence ||
                            parseInt(targetSentence) < 1 ||
                            parseInt(targetSentence) > totalChunks
                        }
                    >
                        Go
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}; 