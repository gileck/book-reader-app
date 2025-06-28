import React from 'react';
import { Alert, AlertTitle, Box, Button, Collapse, IconButton } from '@mui/material';
import { Close as CloseIcon, Refresh as RefreshIcon, Warning as WarningIcon } from '@mui/icons-material';
import type { TtsErrorDetail } from '../../apis/tts/types';

interface TtsErrorNotificationProps {
    error: TtsErrorDetail | null;
    onDismiss: () => void;
    onRetry?: () => void;
}

export const TtsErrorNotification: React.FC<TtsErrorNotificationProps> = ({
    error,
    onDismiss,
    onRetry
}) => {
    if (!error) return null;

    const getErrorSeverity = (code: string) => {
        switch (code) {
            case 'AUTH_ERROR':
            case 'INIT_ERROR':
                return 'error' as const;
            case 'RATE_LIMIT_ERROR':
            case 'SERVICE_UNAVAILABLE':
                return 'warning' as const;
            case 'NETWORK_ERROR':
            case 'VALIDATION_ERROR':
                return 'info' as const;
            default:
                return 'warning' as const;
        }
    };

    const getErrorIcon = (code: string) => {
        switch (code) {
            case 'AUTH_ERROR':
            case 'INIT_ERROR':
                return <WarningIcon />;
            case 'NETWORK_ERROR':
                return <RefreshIcon />;
            default:
                return <WarningIcon />;
        }
    };

    const showRetryButton = ['NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'RATE_LIMIT_ERROR'].includes(error.code);

    return (
        <Collapse in={!!error}>
            <Box sx={{ mb: 2 }}>
                <Alert
                    severity={getErrorSeverity(error.code)}
                    icon={getErrorIcon(error.code)}
                    action={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {showRetryButton && onRetry && (
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={onRetry}
                                    startIcon={<RefreshIcon />}
                                >
                                    Retry
                                </Button>
                            )}
                            <IconButton
                                aria-label="close"
                                color="inherit"
                                size="small"
                                onClick={onDismiss}
                            >
                                <CloseIcon fontSize="inherit" />
                            </IconButton>
                        </Box>
                    }
                >
                    <AlertTitle>Audio Generation Failed</AlertTitle>
                    {error.message}
                    {error.provider && (
                        <Box component="span" sx={{ display: 'block', mt: 1, fontSize: '0.875em', opacity: 0.8 }}>
                            Provider: {error.provider.charAt(0).toUpperCase() + error.provider.slice(1)}
                        </Box>
                    )}
                </Alert>
            </Box>
        </Collapse>
    );
}; 