import React from 'react';
import { Box, IconButton, Typography, Paper } from '@mui/material';
import { Add, Remove, Fullscreen, FullscreenExit } from '@mui/icons-material';

interface FullscreenTextControlsProps {
    /** Current font size multiplier (0.8 - 2.0) */
    fontSize: number;
    /** Callback when font size changes */
    onFontSizeChange: (size: number) => void;
    /** Whether fullscreen mode is currently active */
    isFullscreen: boolean;
    /** Callback to toggle fullscreen mode */
    onToggleFullscreen: () => void;
}

/**
 * FullscreenTextControls - Floating control panel for fullscreen reading mode
 * 
 * Displays minimal controls at the bottom center of the screen in fullscreen mode:
 * - Font size decrease/increase buttons (range: 0.8x - 2.0x)
 * - Current font size display
 * - Exit fullscreen button
 * 
 * Features:
 * - iOS-inspired design with backdrop blur
 * - Responsive sizing and positioning
 * - High z-index (1300) to stay above all content
 * - Proper ARIA labels for accessibility
 * 
 * @example
 * ```tsx
 * <FullscreenTextControls
 *   fontSize={1.2}
 *   onFontSizeChange={(size) => updateSettings({ fontSize: size })}
 *   isFullscreen={true}
 *   onToggleFullscreen={() => setIsFullscreen(false)}
 * />
 * ```
 */
export const FullscreenTextControls: React.FC<FullscreenTextControlsProps> = ({
    fontSize,
    onFontSizeChange,
    isFullscreen,
    onToggleFullscreen
}) => {
    const handleDecrease = () => {
        const newSize = Math.max(0.8, Math.round((fontSize - 0.1) * 10) / 10);
        onFontSizeChange(newSize);
    };

    const handleIncrease = () => {
        const newSize = Math.min(2.0, Math.round((fontSize + 0.1) * 10) / 10);
        onFontSizeChange(newSize);
    };

    return (
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
                '@media (prefers-color-scheme: dark)': {
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }
            }}
        >
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

            {/* Font Size Display */}
            <Typography
                variant="body2"
                sx={{
                    minWidth: 50,
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: '0.875rem'
                }}
            >
                {fontSize.toFixed(1)}x
            </Typography>

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
    );
};

