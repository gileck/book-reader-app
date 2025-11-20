import React, { useEffect, useState } from 'react';
import { Box, IconButton, Paper, Button, Popover, Stack, Typography, TextField } from '@mui/material';
import { Add, Remove, Fullscreen, FullscreenExit, Palette, PlayArrow, Pause, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { ChapterProgressBar } from './ChapterProgressBar';

interface FullscreenTextControlsProps {
    /** Current font size multiplier (0.8 - 2.0) */
    fontSize: number;
    /** Callback when font size changes */
    onFontSizeChange: (size: number) => void;
    /** Current text color */
    textColor: string;
    /** Callback when text color changes */
    onTextColorChange: (color: string) => void;
    /** Whether fullscreen mode is currently active */
    isFullscreen: boolean;
    /** Callback to toggle fullscreen mode */
    onToggleFullscreen: () => void;
    /** Whether auto scroll is currently active */
    isAutoScrolling: boolean;
    /** Callback to toggle auto scroll */
    onToggleAutoScroll: () => void;
    /** Current auto scroll speed (px/sec) */
    autoScrollSpeed: number;
    /** Callback when auto scroll speed changes */
    onAutoScrollSpeedChange: (speed: number) => void;
    /** Navigate to previous sentence */
    onPreviousSentence: () => void;
    /** Navigate to next sentence */
    onNextSentence: () => void;
    /** Whether previous sentence navigation is available */
    canGoToPrevious: boolean;
    /** Whether next sentence navigation is available */
    canGoToNext: boolean;
    /** Current sentence index for progress tracking */
    currentSentenceIndex: number;
    /** Total number of sentences in the chapter */
    totalSentences: number;
}

/**
 * FullscreenTextControls - Floating control panel for fullscreen reading mode
 * 
 * Displays minimal controls at the bottom center of the screen in fullscreen mode:
 * - Collapsible font size controls (click to show +/- buttons)
 * - Font color picker with preset colors
 * - Exit fullscreen button
 * 
 * Features:
 * - iOS-inspired design with backdrop blur
 * - Responsive sizing and positioning
 * - High z-index (1300) to stay above all content
 * - Proper ARIA labels for accessibility
 * - Collapsible controls to minimize distraction
 * 
 * @example
 * ```tsx
 * <FullscreenTextControls
 *   fontSize={1.2}
 *   onFontSizeChange={(size) => updateSettings({ fontSize: size })}
 *   textColor="#000000"
 *   onTextColorChange={(color) => updateSettings({ textColor: color })}
 *   isFullscreen={true}
 *   onToggleFullscreen={() => setIsFullscreen(false)}
 * />
 * ```
 */
export const FullscreenTextControls: React.FC<FullscreenTextControlsProps> = ({
    fontSize,
    onFontSizeChange,
    textColor,
    onTextColorChange,
    isFullscreen,
    onToggleFullscreen,
    isAutoScrolling,
    onToggleAutoScroll,
    autoScrollSpeed,
    onAutoScrollSpeedChange,
    onPreviousSentence,
    onNextSentence,
    canGoToPrevious,
    canGoToNext,
    currentSentenceIndex,
    totalSentences
}) => {
    const [typographyAnchorEl, setTypographyAnchorEl] = useState<HTMLButtonElement | null>(null);
    const handleDecrease = () => {
        const newSize = Math.max(0.8, Math.round((fontSize - 0.1) * 10) / 10);
        onFontSizeChange(newSize);
    };

    const handleIncrease = () => {
        const newSize = Math.min(2.0, Math.round((fontSize + 0.1) * 10) / 10);
        onFontSizeChange(newSize);
    };

    const handleColorSelect = (color: string) => {
        onTextColorChange(color);
        handleTypographyClose();
    };

    const handleColorInputChange = (value: string) => {
        onTextColorChange(value);
        handleTypographyClose();
    };

    const presetColors = [
        '#000000', // Black
        '#1a1a1a', // Dark gray
        '#333333', // Gray
        '#4a4a4a', // Medium gray
        '#1e3a8a', // Dark blue
        '#7c3aed', // Purple
        '#059669', // Green
        '#b91c1c', // Red
        '#ffffff', // White
        '#e5e5e5', // Light gray
        '#d4d4d4', // Lighter gray
        '#a3a3a3'  // Medium light gray
    ];

    const handleTypographyButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setTypographyAnchorEl(event.currentTarget);
    };

    const handleTypographyClose = () => {
        setTypographyAnchorEl(null);
    };

    useEffect(() => {
        if (isAutoScrolling && typographyAnchorEl) {
            setTypographyAnchorEl(null);
        }
    }, [isAutoScrolling, typographyAnchorEl]);

    const handleAutoScrollSpeedAdjust = (delta: number) => {
        const next = Math.min(200, Math.max(20, Math.round(autoScrollSpeed + delta)));
        onAutoScrollSpeedChange(next);
    };

    return (
        <>
            {/* Control Panel */}
            <Paper
                elevation={8}
                sx={{
                    position: 'fixed',
                    bottom: { xs: 16, sm: 24 },
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                    borderRadius: 4,
                    backgroundColor: 'background.paper',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    zIndex: 1300,
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                    minWidth: { xs: '90vw', sm: '600px' },
                    maxWidth: '600px',
                    '@media (prefers-color-scheme: dark)': {
                        backgroundColor: 'rgba(30, 30, 30, 0.95)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }
                }}
            >
                {/* Chapter Progress Bar - Inside panel at the top */}
                <Box sx={{ 
                    width: '100%', 
                    paddingLeft: '24px',
                    paddingRight: '24px',
                    paddingTop: '14px',
                    paddingBottom: '8px'
                }}>
                    <ChapterProgressBar
                        currentSentenceIndex={currentSentenceIndex}
                        totalSentences={totalSentences}
                    />
                </Box>

                {/* Divider */}
                <Box
                    sx={{
                        width: '100%',
                        height: '1px',
                        backgroundColor: 'divider',
                        opacity: 0.3
                    }}
                />

                {/* Controls Row */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        paddingTop: '0px',
                        paddingBottom: '6px'
                    }}
                >
                {/* Previous Sentence */}
                <IconButton
                    onClick={onPreviousSentence}
                    disabled={!canGoToPrevious}
                    size="medium"
                    sx={{
                        width: 44,
                        height: 44,
                        '&:disabled': { opacity: 0.3 }
                    }}
                    aria-label="Previous sentence"
                >
                    <ChevronLeft />
                </IconButton>

                {/* Next Sentence */}
                <IconButton
                    onClick={onNextSentence}
                    disabled={!canGoToNext}
                    size="medium"
                    sx={{
                        width: 44,
                        height: 44,
                        '&:disabled': { opacity: 0.3 }
                    }}
                    aria-label="Next sentence"
                >
                    <ChevronRight />
                </IconButton>

                {/* Divider */}
                <Box
                    sx={{
                        width: '1px',
                        height: 32,
                        backgroundColor: 'rgba(0, 0, 0, 0.12)',
                        mx: 1,
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: 'rgba(255, 255, 255, 0.12)'
                        }
                    }}
                />

                {isAutoScrolling ? (
                    <>
                        <IconButton
                            onClick={() => handleAutoScrollSpeedAdjust(-1)}
                            disabled={autoScrollSpeed <= 20}
                            size="medium"
                            sx={{
                                width: 44,
                                height: 44,
                                '&:disabled': { opacity: 0.3 }
                            }}
                            aria-label="Decrease auto scroll speed"
                        >
                            <Remove />
                        </IconButton>
                        <Button
                            sx={{
                                minWidth: 90,
                                height: 44,
                                textAlign: 'center',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                color: 'text.primary',
                                '&:hover': {
                                    backgroundColor: 'action.hover'
                                }
                            }}
                            disableRipple
                        >
                            {autoScrollSpeed} px/s
                        </Button>
                        <IconButton
                            onClick={() => handleAutoScrollSpeedAdjust(1)}
                            disabled={autoScrollSpeed >= 200}
                            size="medium"
                            sx={{
                                width: 44,
                                height: 44,
                                '&:disabled': { opacity: 0.3 }
                            }}
                            aria-label="Increase auto scroll speed"
                        >
                            <Add />
                        </IconButton>
                    </>
                ) : (
                    <Button
                        onClick={handleTypographyButtonClick}
                        sx={{
                            minWidth: 110,
                            height: 44,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            fontWeight: 600,
                            textTransform: 'none',
                            color: 'text.primary',
                            '&:hover': {
                                backgroundColor: 'action.hover'
                            }
                        }}
                        aria-label="Open typography controls"
                    >
                        <Palette fontSize="small" />
                        Text
                    </Button>
                )}

                {/* Auto Scroll Toggle */}
                <IconButton
                    onClick={onToggleAutoScroll}
                    size="medium"
                    sx={{
                        width: 44,
                        height: 44
                    }}
                    aria-label={isAutoScrolling ? 'Pause auto scroll' : 'Start auto scroll'}
                >
                    {isAutoScrolling ? <Pause /> : <PlayArrow />}
                </IconButton>

                {/* Divider */}
                <Box
                    sx={{
                        width: '1px',
                        height: 32,
                        backgroundColor: 'rgba(0, 0, 0, 0.12)',
                        mx: 1,
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: 'rgba(255, 255, 255, 0.12)'
                        }
                    }}
                />

                {/* Toggle Fullscreen */}
                <IconButton
                    onClick={onToggleFullscreen}
                    size="medium"
                    sx={{
                        width: 44,
                        height: 44
                    }}
                    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
                </Box>
            </Paper>

            {/* Typography & Color Popover */}
            <Popover
                open={Boolean(typographyAnchorEl)}
                anchorEl={typographyAnchorEl}
                onClose={handleTypographyClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center'
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center'
                }}
                sx={{
                    '& .MuiPaper-root': {
                        borderRadius: 3,
                        p: 2,
                        minWidth: 240,
                        backdropFilter: 'blur(10px)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: 'rgba(30, 30, 30, 0.95)',
                        }
                    }
                }}
            >
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Font Size
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton
                                onClick={handleDecrease}
                                disabled={fontSize <= 0.8}
                                size="small"
                                sx={{ '&:disabled': { opacity: 0.3 } }}
                                aria-label="Decrease font size"
                            >
                                <Remove fontSize="small" />
                            </IconButton>
                            <Button
                                disableRipple
                                sx={{
                                    minWidth: 70,
                                    height: 36,
                                    fontWeight: 600,
                                    color: 'text.primary',
                                    '&:hover': { backgroundColor: 'action.hover' }
                                }}
                            >
                                {fontSize.toFixed(1)}x
                            </Button>
                            <IconButton
                                onClick={handleIncrease}
                                disabled={fontSize >= 2.0}
                                size="small"
                                sx={{ '&:disabled': { opacity: 0.3 } }}
                                aria-label="Increase font size"
                            >
                                <Add fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Font Color
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 1,
                                mb: 1.5
                            }}
                        >
                            {presetColors.map((color) => (
                                <IconButton
                                    key={color}
                                    onClick={() => handleColorSelect(color)}
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        backgroundColor: color,
                                        border: textColor === color ? '3px solid' : '1px solid',
                                        borderColor: textColor === color ? 'primary.main' : 'divider',
                                        '&:hover': {
                                            backgroundColor: color,
                                            opacity: 0.85,
                                            border: '2px solid',
                                            borderColor: 'primary.main'
                                        }
                                    }}
                                    aria-label={`Select color ${color}`}
                                />
                            ))}
                        </Box>
                        <TextField
                            type="color"
                            value={textColor}
                            onChange={(e) => handleColorInputChange(e.target.value)}
                            size="small"
                            fullWidth
                        />
                    </Box>
                </Stack>
            </Popover>
        </>
    );
};

