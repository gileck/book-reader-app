import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing upload form state
 * Handles file/URL mode, validation, and form data
 */
export const useUploadForm = () => {
    const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
    const [file, setFile] = useState<File | null>(null);
    const [pdfUrl, setPdfUrl] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Handle file selection
     */
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setError(null);
        } else {
            setError('Please select a valid PDF file');
        }
    }, []);

    /**
     * Handle mode toggle between file and URL
     */
    const handleModeToggle = useCallback((mode: 'file' | 'url') => {
        setUploadMode(mode);
        setError(null);
        
        // Clear data of the inactive mode
        if (mode === 'file') {
            setPdfUrl('');
        } else {
            setFile(null);
        }
    }, []);

    /**
     * Validate form before submission
     */
    const validate = useCallback((): boolean => {
        if (uploadMode === 'file' && !file) {
            setError('Please select a PDF file');
            return false;
        }
        
        if (uploadMode === 'url' && !pdfUrl.trim()) {
            setError('Please enter a PDF URL');
            return false;
        }

        // Validate URL format
        if (uploadMode === 'url') {
            try {
                const url = new URL(pdfUrl.trim());
                if (!['http:', 'https:'].includes(url.protocol)) {
                    setError('URL must start with http:// or https://');
                    return false;
                }
            } catch {
                setError('Please enter a valid URL');
                return false;
            }
        }

        return true;
    }, [uploadMode, file, pdfUrl]);

    /**
     * Reset form to initial state
     */
    const reset = useCallback(() => {
        setFile(null);
        setPdfUrl('');
        setError(null);
    }, []);

    /**
     * Clear error
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    /**
     * Get file name for display
     */
    const getFileName = useCallback((): string | undefined => {
        if (uploadMode === 'file') {
            return file?.name;
        } else {
            return pdfUrl.trim() || undefined;
        }
    }, [uploadMode, file, pdfUrl]);

    /**
     * Check if form is valid for submission
     */
    const isValid = uploadMode === 'file' ? !!file : !!pdfUrl.trim();

    return {
        // State
        uploadMode,
        file,
        pdfUrl,
        error,
        fileInputRef,
        isValid,
        
        // Actions
        setUploadMode,
        setFile,
        setPdfUrl,
        setError,
        handleFileSelect,
        handleModeToggle,
        validate,
        reset,
        clearError,
        getFileName
    };
};

