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
            // Apple Books-inspired warm, translucent background
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            backgroundColor: 'var(--reader-controls-bg)',
            borderTop: '0.5px solid var(--reader-separator)',
            boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.08)',
            padding: 1.5,
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 1000,
            fontFamily: 'var(--reader-font-sans)',
        }}>
            {/* Grabber indicator - iOS sheet affordance */}
            <Box sx={{
                width: 32,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'var(--reader-text-muted)',
                opacity: 0.35,
                mx: 'auto',
                mb: 1,
            }} />

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
                            backgroundColor: 'var(--reader-progress-track)',
                            '& .MuiLinearProgress-bar': {
                                backgroundColor: 'var(--reader-accent)',
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
                            borderRadius: '12px',
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
                        mb: 0.75
                    }}>
                        <IconButton
                            onClick={onPreviousChapter}
                            disabled={currentChapterNumber <= minChapterNumber}
                            sx={{
                                color: 'var(--reader-text)',
                                '&:hover': { 
                                    backgroundColor: 'var(--reader-accent-subtle)',
                                    color: 'var(--reader-accent)'
                                },
                                '&:disabled': { 
                                    color: 'var(--reader-text-muted)',
                                    opacity: 0.4
                                },
                                p: 1,
                                borderRadius: '10px',
                                transition: 'all 180ms ease'
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
                                sx={{
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    color: 'var(--reader-text)',
                                    fontSize: '15px',
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                {chapterTitle}
                            </Typography>
                            {onChapters && (
                                <IconButton
                                    onClick={onChapters}
                                    sx={{
                                        color: 'var(--reader-accent)',
                                        '&:hover': { 
                                            backgroundColor: 'var(--reader-accent-subtle)'
                                        },
                                        p: 0.5,
                                        borderRadius: '8px',
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
                                color: 'var(--reader-text)',
                                '&:hover': { 
                                    backgroundColor: 'var(--reader-accent-subtle)',
                                    color: 'var(--reader-accent)'
                                },
                                '&:disabled': { 
                                    color: 'var(--reader-text-muted)',
                                    opacity: 0.4
                                },
                                p: 1,
                                borderRadius: '10px',
                                transition: 'all 180ms ease'
                            }}
                            size="medium"
                        >
                            <ChevronRight sx={{ fontSize: 24 }} />
                        </IconButton>
                    </Box>

                    {/* Enhanced Progress Bar - Pill style */}
                    <Box sx={{ mb: 0.75, px: 1 }}>
                        <LinearProgress
                            variant="determinate"
                            value={displayProgress}
                            sx={{
                                height: 5,
                                borderRadius: 2.5,
                                backgroundColor: 'var(--reader-progress-track)',
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: 'var(--reader-accent)',
                                    borderRadius: 3,
                                    transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
                                }
                            }}
                        />
                    </Box>

                    {/* Reading Stats and Sentence Counter */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 1,
                        minHeight: 24,
                        gap: 1,
                        px: 0.5
                    }}>
                        {/* Left side buttons */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'fit-content' }}>
                            {/* Jump to Current Chunk Button */}
                            {showJumpToCurrentChunk && onJumpToCurrentChunk && (
                                <IconButton
                                    onClick={onJumpToCurrentChunk}
                                    size="small"
                                    sx={{
                                        color: 'var(--reader-accent)',
                                        padding: '6px',
                                        borderRadius: '8px',
                                        '&:hover': {
                                            backgroundColor: 'var(--reader-accent-subtle)'
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
                                    color: 'var(--reader-text-secondary)',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    '&:hover': {
                                        color: 'var(--reader-text)',
                                        backgroundColor: 'var(--reader-accent-subtle)'
                                    }
                                }}
                                title="Go to first sentence"
                            >
                                <VerticalAlignTop sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Box>

                        {/* Center: Sentence Counter */}
                        <Typography
                            sx={{
                                color: 'var(--reader-text-secondary)',
                                fontWeight: 500,
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                                letterSpacing: '-0.01em'
                            }}
                        >
                            {currentChunk} of {totalChunks} {unitLabelOverride || 'sentences'}
                            {estimatedTimeRemaining && (
                                <Box
                                    component="span"
                                    sx={{
                                        ml: 1,
                                        color: 'var(--reader-accent)',
                                        fontWeight: 600
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
                                    color: 'var(--reader-text-secondary)',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    '&:hover': {
                                        color: 'var(--reader-text)',
                                        backgroundColor: 'var(--reader-accent-subtle)'
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
                                        color: 'var(--reader-text-secondary)',
                                        padding: '6px',
                                        borderRadius: '8px',
                                        '&:hover': {
                                            color: 'var(--reader-text)',
                                            backgroundColor: 'var(--reader-accent-subtle)'
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 90 }}>
                    {/* Quick Prompts Button */}
                    <IconButton
                        onClick={onQuickPrompts || onAskAI}
                        sx={{
                            color: 'var(--reader-text)',
                            backgroundColor: 'var(--reader-accent-subtle)',
                            '&:hover': { 
                                backgroundColor: 'var(--reader-accent-light)',
                                color: 'var(--reader-surface)'
                            },
                            p: 1,
                            borderRadius: '10px',
                            transition: 'all 180ms ease'
                        }}
                        size="medium"
                    >
                        <QuestionMark sx={{ fontSize: 20 }} />
                    </IconButton>

                    {/* Settings Button */}
                    <IconButton
                        onClick={onSettings}
                        sx={{
                            color: 'var(--reader-text-secondary)',
                            '&:hover': { 
                                backgroundColor: 'var(--reader-accent-subtle)',
                                color: 'var(--reader-text)'
                            },
                            p: 1,
                            borderRadius: '10px',
                            transition: 'all 180ms ease'
                        }}
                        size="medium"
                    >
                        <Settings sx={{ fontSize: 20 }} />
                    </IconButton>
                </Box>

                {/* Centered Play Controls */}
                <Box sx={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    {/* Previous Chunk Button */}
                    <IconButton
                        onClick={onPreviousChunk}
                        disabled={currentChunk <= 1}
                        sx={{
                            color: 'var(--reader-text)',
                            '&:hover': { 
                                backgroundColor: 'var(--reader-accent-subtle)',
                                color: 'var(--reader-accent)'
                            },
                            '&:disabled': { 
                                color: 'var(--reader-text-muted)',
                                opacity: 0.4
                            },
                            p: 0.75,
                            borderRadius: '10px',
                            transition: 'all 180ms ease'
                        }}
                        size="medium"
                    >
                        <SkipPrevious sx={{ fontSize: 26 }} />
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
                                backgroundColor: isPlaying
                                    ? 'var(--reader-pause-button)'
                                    : (hasError || ttsDisabled)
                                        ? 'var(--reader-text-muted)'
                                        : 'var(--reader-play-button)',
                                color: 'white',
                                '&:hover': {
                                    backgroundColor: isPlaying
                                        ? '#e55a5a'
                                        : (hasError || ttsDisabled)
                                            ? 'var(--reader-text-secondary)'
                                            : 'var(--reader-play-button-hover)',
                                    transform: 'scale(1.05)'
                                },
                                '&:active': {
                                    transform: 'scale(0.95)'
                                },
                                '&:disabled': {
                                    backgroundColor: 'var(--reader-text-muted)',
                                    color: 'white',
                                    opacity: 0.6
                                },
                                width: 64,
                                height: 64,
                                mx: 1,
                                boxShadow: isPlaying 
                                    ? '0 4px 16px rgba(255, 107, 107, 0.4)'
                                    : '0 4px 16px rgba(52, 199, 89, 0.4)',
                                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)'
                            }}
                            size="large"
                        >
                            {isPlaying ? (
                                <Pause sx={{ fontSize: 36 }} />
                            ) : (
                                <PlayArrow sx={{ fontSize: 36 }} />
                            )}
                        </IconButton>
                        {/* Loading Spinner Overlay */}
                        {isCurrentChunkLoading && (
                            <CircularProgress
                                size={72}
                                thickness={2}
                                sx={{
                                    color: 'var(--reader-play-button)',
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
                            color: 'var(--reader-text)',
                            '&:hover': { 
                                backgroundColor: 'var(--reader-accent-subtle)',
                                color: 'var(--reader-accent)'
                            },
                            '&:disabled': { 
                                color: 'var(--reader-text-muted)',
                                opacity: 0.4
                            },
                            p: 0.75,
                            borderRadius: '10px',
                            transition: 'all 180ms ease'
                        }}
                        size="medium"
                    >
                        <SkipNext sx={{ fontSize: 26 }} />
                    </IconButton>
                </Box>

                {/* Right Controls */}
                <Box sx={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    minWidth: 90,
                    justifyContent: 'flex-end'
                }}>
                    {/* Speed Control Button */}
                    <Box
                        component="button"
                        onClick={onSpeedSettings}
                        sx={{
                            backgroundColor: 'var(--reader-accent-subtle)',
                            color: 'var(--reader-accent)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontFamily: 'var(--reader-font-sans)',
                            fontSize: '14px',
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            transition: 'all 180ms ease',
                            '&:hover': {
                                backgroundColor: 'var(--reader-accent-light)',
                                color: 'var(--reader-surface)'
                            },
                            '&:active': {
                                transform: 'scale(0.95)'
                            }
                        }}
                    >
                        {playbackSpeed.toFixed(1)}x
                    </Box>

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

            {/* Sentence Navigation Dialog - Apple Books style */}
            <Dialog
                open={navigationDialogOpen}
                onClose={() => {
                    setNavigationDialogOpen(false);
                    setTargetSentence('');
                }}
                PaperProps={{
                    sx: {
                        backgroundColor: 'var(--reader-surface)',
                        color: 'var(--reader-text)',
                        borderRadius: '16px',
                        minWidth: 320,
                        boxShadow: 'var(--reader-shadow-elevated)'
                    }
                }}
            >
                <DialogTitle sx={{ 
                    pb: 1,
                    fontFamily: 'var(--reader-font-sans)',
                    fontWeight: 600,
                    fontSize: '18px',
                    letterSpacing: '-0.01em'
                }}>
                    Go to Sentence
                </DialogTitle>
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
                                color: 'var(--reader-text)',
                                borderRadius: '12px',
                                '& fieldset': {
                                    borderColor: 'var(--reader-separator)'
                                },
                                '&:hover fieldset': {
                                    borderColor: 'var(--reader-accent-light)'
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'var(--reader-accent)'
                                }
                            },
                            '& .MuiInputLabel-root': {
                                color: 'var(--reader-text-secondary)'
                            },
                            '& .MuiInputLabel-root.Mui-focused': {
                                color: 'var(--reader-accent)'
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
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button
                        onClick={() => {
                            setNavigationDialogOpen(false);
                            setTargetSentence('');
                        }}
                        sx={{ 
                            color: 'var(--reader-text-secondary)',
                            fontFamily: 'var(--reader-font-sans)',
                            fontWeight: 500,
                            borderRadius: '10px',
                            px: 2,
                            '&:hover': {
                                backgroundColor: 'var(--reader-accent-subtle)'
                            }
                        }}
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
                            backgroundColor: 'var(--reader-accent)',
                            color: 'white',
                            fontFamily: 'var(--reader-font-sans)',
                            fontWeight: 600,
                            borderRadius: '10px',
                            px: 3,
                            '&:hover': {
                                backgroundColor: 'var(--reader-accent-light)'
                            },
                            '&:disabled': {
                                backgroundColor: 'var(--reader-text-muted)',
                                opacity: 0.4
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
