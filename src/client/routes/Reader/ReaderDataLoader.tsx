import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useReaderData } from './hooks/useReaderData';
import { ReaderUI } from './ReaderUI';

export const ReaderDataLoader = () => {
    const { data, loading, error } = useReaderData();

    // Loading state
    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
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

    // Render UI with loaded data
    console.log('📦 [ReaderDataLoader] Passing data to ReaderUI:', {
        currentChunkIndex: data.currentChunkIndex,
        currentChapterNumber: data.currentChapterNumber
    });
    
    return (
        <ReaderUI
            initialBook={data.book}
            initialChapter={data.chapter}
            initialChapterNumber={data.currentChapterNumber}
            initialChunkIndex={data.currentChunkIndex}
        />
    );
};

