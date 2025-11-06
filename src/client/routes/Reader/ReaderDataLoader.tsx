import React from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { useReaderData } from './hooks/useReaderData';
import { useSettings } from '../../settings/SettingsContext';
import { useRouter } from '../../router';
import { ReaderUI } from './ReaderUI';

export const ReaderDataLoader = () => {
    const { data, loading, error } = useReaderData();
    const { userSettingsLoaded, effectiveOffline } = useSettings();
    const { navigate } = useRouter();

    // CRITICAL: Wait for BOTH book data AND user settings before rendering
    // This prevents TTS preloading with undefined/wrong voice values
    if (loading || !userSettingsLoaded) {
        return (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh" gap={2}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">
                    {loading ? 'Loading book...' : 'Loading settings...'}
                </Typography>
            </Box>
        );
    }

    // Error state
    if (error) {
        const isOfflineError = error.includes('not available offline') || 
                               error.includes('connect to the internet') ||
                               error.includes('download this content');
        
        return (
            <Box 
                display="flex" 
                flexDirection="column" 
                justifyContent="center" 
                alignItems="center" 
                minHeight="100vh"
                gap={3}
                px={3}
            >
                {isOfflineError && (
                    <CloudOffIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
                )}
                
                <Typography 
                    color="error" 
                    variant="h6" 
                    align="center"
                    sx={{ maxWidth: 600 }}
                >
                    {error}
                </Typography>
                
                {isOfflineError && effectiveOffline && (
                    <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        align="center"
                        sx={{ maxWidth: 500 }}
                    >
                        This chapter hasn&apos;t been downloaded for offline reading yet. 
                        You can either go back or disable offline mode to load it from the internet.
                    </Typography>
                )}
                
                <Button
                    variant="contained"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/book-library')}
                    size="large"
                >
                    Go Back to Library
                </Button>
            </Box>
        );
    }

    // Data not loaded yet (shouldn't happen, but guard)
    if (!data) {
        return null;
    }

    // Both data and settings are loaded - safe to render
    return (
        <ReaderUI
            initialBook={data.book}
            initialChapter={data.chapter}
            initialChapterNumber={data.currentChapterNumber}
            initialChunkIndex={data.currentChunkIndex}
        />
    );
};
