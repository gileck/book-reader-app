import React from 'react';
import { ReaderDataLoader } from './ReaderDataLoader';

/**
 * Reader - Main orchestrator component
 * 
 * This component delegates to ReaderDataLoader which:
 * 1. Fetches all initial data (book, chapter, reading progress) in parallel
 * 2. Shows loading spinner while data is being fetched
 * 3. Renders ReaderUI with loaded data once ready
 * 
 * This architecture ensures:
 * - No race conditions (data loads before UI renders)
 * - Audio controller starts at correct position immediately
 * - Cleaner separation between data loading and UI rendering
 */
export const Reader = () => {
    return <ReaderDataLoader />;
}; 