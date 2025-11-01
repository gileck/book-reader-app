import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useReaderData } from './hooks/useReaderData';
import { useSettings } from '../../settings/SettingsContext';
import { ReaderUI } from './ReaderUI';

export const ReaderDataLoader = () => {
    const { data, loading, error } = useReaderData();
    const { userSettingsLoaded } = useSettings();

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
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <Typography color="error" variant="h6">
                    {error}
                </Typography>
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
