import React from 'react';
import { Box, IconButton, alpha, useTheme } from '@mui/material';
import { Close, Fullscreen, FullscreenExit, Settings, DeleteSweep } from '@mui/icons-material';
import { PanelHeaderProps } from './types';

export const PanelHeader: React.FC<PanelHeaderProps> = ({
    onClose,
    onToggleFullScreen,
    onClearHistory,
    onOpenSettings,
    fullScreen
}) => {
    const theme = useTheme();

    const iconButtonStyle = {
        borderRadius: fullScreen ? '12px' : '8px',
        width: fullScreen ? 44 : 36,
        height: fullScreen ? 44 : 36,
        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
        '&:hover': {
            backgroundColor: alpha(theme.palette.action.hover, 0.08),
            transform: 'scale(1.05)',
            color: theme.palette.text.primary
        },
        '&:active': {
            transform: 'scale(0.95)'
        }
    };

    return (
        <Box sx={{ display: 'flex', gap: fullScreen ? 1 : 0.5 }}>
            <IconButton
                size={fullScreen ? 'medium' : 'small'}
                onClick={onOpenSettings}
                sx={{
                    ...iconButtonStyle,
                    color: theme.palette.text.secondary
                }}
            >
                <Settings fontSize={fullScreen ? 'medium' : 'small'} />
            </IconButton>
            <IconButton
                size={fullScreen ? 'medium' : 'small'}
                onClick={onClearHistory}
                sx={{
                    ...iconButtonStyle,
                    color: theme.palette.text.secondary
                }}
            >
                <DeleteSweep fontSize={fullScreen ? 'medium' : 'small'} />
            </IconButton>
            <IconButton
                size={fullScreen ? 'medium' : 'small'}
                onClick={onToggleFullScreen}
                sx={{
                    ...iconButtonStyle,
                    color: theme.palette.text.secondary
                }}
            >
                {fullScreen ? 
                    <FullscreenExit fontSize={fullScreen ? 'medium' : 'small'} /> : 
                    <Fullscreen fontSize={fullScreen ? 'medium' : 'small'} />
                }
            </IconButton>
            <IconButton
                size={fullScreen ? 'medium' : 'small'}
                onClick={onClose}
                sx={{
                    ...iconButtonStyle,
                    color: theme.palette.text.secondary
                }}
            >
                <Close fontSize={fullScreen ? 'medium' : 'small'} />
            </IconButton>
        </Box>
    );
}; 