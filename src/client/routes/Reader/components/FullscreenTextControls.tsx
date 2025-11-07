import React, { useState } from 'react';
import { Box, IconButton, Paper, Button, Popover } from '@mui/material';
import { Add, Remove, Fullscreen, FullscreenExit, Palette } from '@mui/icons-material';

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
    onToggleFullscreen
}) => {
    const [showFontSizeControls, setShowFontSizeControls] = useState(false);
    const [colorPickerAnchor, setColorPickerAnchor] = useState<HTMLButtonElement | null>(null);
    const handleDecrease = () => {
        const newSize = Math.max(0.8, Math.round((fontSize - 0.1) * 10) / 10);
        onFontSizeChange(newSize);
    };

    const handleIncrease = () => {
        const newSize = Math.min(2.0, Math.round((fontSize + 0.1) * 10) / 10);
        onFontSizeChange(newSize);
    };

    const handleColorClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setColorPickerAnchor(event.currentTarget);
    };

    const handleColorClose = () => {
        setColorPickerAnchor(null);
    };

    const handleColorSelect = (color: string) => {
        onTextColorChange(color);
        handleColorClose();
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

    return (
        <>
            <Paper
                elevation={8}
                sx={{
                    position: 'fixed',
                    bottom: { xs: 16, sm: 24 },
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1.5,
                    borderRadius: 50,
                    backgroundColor: 'background.paper',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    zIndex: 1300,
                    transition: 'all 0.2s ease',
                    '@media (prefers-color-scheme: dark)': {
                        backgroundColor: 'rgba(30, 30, 30, 0.95)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }
                }}
            >
                {/* Font Size Controls - Collapsible */}
                {showFontSizeControls ? (
                    <>
                        {/* Decrease Font Size */}
                        <IconButton
                            onClick={handleDecrease}
                            disabled={fontSize <= 0.8}
                            size="medium"
                            sx={{
                                width: 44,
                                height: 44,
                                '&:disabled': { opacity: 0.3 }
                            }}
                            aria-label="Decrease font size"
                        >
                            <Remove />
                        </IconButton>

                        {/* Font Size Display Button */}
                        <Button
                            onClick={() => setShowFontSizeControls(false)}
                            sx={{
                                minWidth: 50,
                                height: 44,
                                textAlign: 'center',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                color: 'text.primary',
                                '&:hover': {
                                    backgroundColor: 'action.hover'
                                }
                            }}
                            aria-label="Hide font size controls"
                        >
                            {fontSize.toFixed(1)}x
                        </Button>

                        {/* Increase Font Size */}
                        <IconButton
                            onClick={handleIncrease}
                            disabled={fontSize >= 2.0}
                            size="medium"
                            sx={{
                                width: 44,
                                height: 44,
                                '&:disabled': { opacity: 0.3 }
                            }}
                            aria-label="Increase font size"
                        >
                            <Add />
                        </IconButton>
                    </>
                ) : (
                    /* Font Size Button - Collapsed */
                    <Button
                        onClick={() => setShowFontSizeControls(true)}
                        sx={{
                            minWidth: 50,
                            height: 44,
                            textAlign: 'center',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            color: 'text.primary',
                            '&:hover': {
                                backgroundColor: 'action.hover'
                            }
                        }}
                        aria-label="Show font size controls"
                    >
                        {fontSize.toFixed(1)}x
                    </Button>
                )}

                {/* Divider */}
                <Box
                    sx={{
                        width: 1,
                        height: 32,
                        backgroundColor: 'divider',
                        mx: 1
                    }}
                />

                {/* Font Color Picker */}
                <IconButton
                    onClick={handleColorClick}
                    size="medium"
                    sx={{
                        width: 44,
                        height: 44,
                        color: textColor
                    }}
                    aria-label="Change text color"
                >
                    <Palette />
                </IconButton>

                {/* Divider */}
                <Box
                    sx={{
                        width: 1,
                        height: 32,
                        backgroundColor: 'divider',
                        mx: 1
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
            </Paper>

            {/* Color Picker Popover */}
            <Popover
                open={Boolean(colorPickerAnchor)}
                anchorEl={colorPickerAnchor}
                onClose={handleColorClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                sx={{
                    '& .MuiPaper-root': {
                        borderRadius: 3,
                        p: 2,
                        backdropFilter: 'blur(10px)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        '@media (prefers-color-scheme: dark)': {
                            backgroundColor: 'rgba(30, 30, 30, 0.95)',
                        }
                    }
                }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 1.5,
                        maxWidth: 200
                    }}
                >
                    {presetColors.map((color) => (
                        <IconButton
                            key={color}
                            onClick={() => handleColorSelect(color)}
                            sx={{
                                width: 40,
                                height: 40,
                                backgroundColor: color,
                                border: textColor === color ? '3px solid' : '1px solid',
                                borderColor: textColor === color ? 'primary.main' : 'divider',
                                '&:hover': {
                                    backgroundColor: color,
                                    opacity: 0.8,
                                    border: '2px solid',
                                    borderColor: 'primary.main'
                                }
                            }}
                            aria-label={`Select color ${color}`}
                        />
                    ))}
                </Box>
            </Popover>
        </>
    );
};

