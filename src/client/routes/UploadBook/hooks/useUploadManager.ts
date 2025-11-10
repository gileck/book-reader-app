import { useState, useEffect, useCallback, useRef } from 'react';
import * as uploadApi from '@/apis/upload/client';

export interface ValidationError {
    message: string;
    step: string;
}

export interface UploadItem {
    uploadId: string;
    status: 'uploading' | 'parsing' | 'awaiting-approval' | 'success' | 'failed' | 'timeout';
    createdAt: Date;
    expiresAt: Date;
    fileName?: string;
    currentStep?: string;
    currentStepNumber?: number;
    totalSteps?: number;
    progress?: number;
    error?: string;
    validationErrors?: ValidationError[];
}

export interface SSEEvent {
    type: string;
    uploadId?: string;
    message?: string;
    step?: string;
    stepNumber?: number;
    totalSteps?: number;
    progress?: number;
    errors?: ValidationError[];
}

/**
 * Custom hook for managing upload state and operations
 * Follows the Settings Hook Pattern from react-hook-patterns.mdc
 */
export const useUploadManager = (userId: string | undefined) => {
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);
    
    // Use ref pattern for current values to avoid stale closures in callbacks
    const uploadsRef = useRef(uploads);
    
    // Keep ref in sync with state
    useEffect(() => {
        uploadsRef.current = uploads;
    }, [uploads]);
    
    /**
     * Load uploads from API
     */
    const loadUploads = useCallback(async () => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

        try {
            // First, cleanup any expired uploads
            try {
                const cleanupResult = await uploadApi.cleanupExpiredUploads({});
                if (cleanupResult.data.deletedCount > 0) {
                    console.log(`🧹 Cleaned up ${cleanupResult.data.deletedCount} expired uploads`);
                }
            } catch (cleanupErr) {
                console.error('Failed to cleanup expired uploads:', cleanupErr);
                // Continue loading uploads even if cleanup fails
            }

            // Load uploads
            const result = await uploadApi.listUploads({});
            if (result.data.error) {
                console.error('Error loading uploads:', result.data.error);
                setIsLoading(false);
                return;
            }

            setUploads(result.data.uploads || []);
            setIsLoading(false);
        } catch (err) {
            console.error('Failed to load uploads:', err);
            setIsLoading(false);
        }
    }, [userId]);

    /**
     * Initial load on mount
     */
    useEffect(() => {
        loadUploads();
    }, [loadUploads]);

    /**
     * Add a temporary optimistic upload item
     */
    const addOptimisticUpload = useCallback((upload: UploadItem) => {
        setUploads(prev => [upload, ...prev]);
    }, []);

    /**
     * Remove upload by ID
     */
    const removeUpload = useCallback((uploadId: string) => {
        setUploads(prev => prev.filter(u => u.uploadId !== uploadId));
    }, []);

    /**
     * Update upload by ID
     */
    const updateUpload = useCallback((uploadId: string, updates: Partial<UploadItem>) => {
        setUploads(prev => prev.map(u => 
            u.uploadId === uploadId ? { ...u, ...updates } : u
        ));
    }, []);

    /**
     * Replace upload (used when replacing temp upload with real one)
     */
    const replaceUpload = useCallback((oldId: string, newUpload: UploadItem) => {
        setUploads(prev => {
            const filtered = prev.filter(u => u.uploadId !== oldId);
            return [newUpload, ...filtered];
        });
    }, []);

    /**
     * Handle SSE events and update upload state
     */
    const handleSSEEvent = useCallback((event: SSEEvent, tempUploadId?: string) => {
        const uploadId = event.uploadId;
        
        // Get uploadId from first event and replace temp upload
        if (uploadId && tempUploadId) {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
            replaceUpload(tempUploadId, {
                uploadId,
                status: 'parsing',
                createdAt: now,
                expiresAt: expiresAt,
                fileName: uploadsRef.current.find(u => u.uploadId === tempUploadId)?.fileName,
                currentStep: event.message || 'Starting parser...',
                progress: event.progress || 5
            });
            // Return uploadId after replacement - don't process this event further
            // as we already set the initial state in replaceUpload
            return uploadId;
        }
        
        if (!uploadId) {
            return null;
        }
        
        // Update upload status from SSE event data
        if (event.type === 'upload' || event.type === 'start' || event.type === 'step-start' || event.type === 'step-complete' || event.type === 'step-progress' || event.type === 'finalizing') {
            updateUpload(uploadId, {
                status: 'parsing',
                currentStep: event.message || event.step,
                currentStepNumber: event.stepNumber,
                totalSteps: event.totalSteps,
                progress: event.progress
            });
        }
        
        // Handle validation errors
        if (event.type === 'validation-error') {
            updateUpload(uploadId, {
                status: 'awaiting-approval',
                currentStep: event.step,
                validationErrors: event.errors
            });
        }
        
        // Handle completion
        if (event.type === 'complete') {
            updateUpload(uploadId, {
                status: 'success',
                currentStep: undefined,
                currentStepNumber: undefined,
                progress: 100
            });
        }
        
        // Handle errors
        if (event.type === 'error') {
            updateUpload(uploadId, {
                status: 'failed',
                error: event.message
            });
        }
        
        return uploadId;
    }, [updateUpload, replaceUpload]);

    /**
     * Approve validation errors
     */
    const approveErrors = useCallback(async (uploadId: string) => {
        setLoadingActions(prev => ({ ...prev, [uploadId]: true }));
        try {
            const upload = uploadsRef.current.find(u => u.uploadId === uploadId);
            if (!upload || !upload.validationErrors) {
                throw new Error('No validation errors found');
            }

            const errors = upload.validationErrors.map(err => ({
                step: err.step,
                chunkId: ''
            }));

            const result = await uploadApi.approveErrors({ uploadId, errors });
            if (result.data.error) {
                throw new Error(result.data.error);
            }

            // Don't reload uploads - the SSE stream is still active and will update the state
            // Calling loadUploads() here causes a race condition and can wipe out the upload list
            return true;
        } catch (err) {
            console.error('Approve errors failed:', err);
            setError('Failed to approve errors');
            return false;
        } finally {
            setLoadingActions(prev => ({ ...prev, [uploadId]: false }));
        }
    }, []);

    /**
     * Finalize upload and add to library
     */
    const finalizeUpload = useCallback(async (uploadId: string): Promise<string | null> => {
        setLoadingActions(prev => ({ ...prev, [uploadId]: true }));
        try {
            const result = await uploadApi.finalizeUpload({ uploadId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }

            return result.data.bookId || null;
        } catch (err) {
            console.error('Finalize failed:', err);
            setError('Failed to finalize upload');
            return null;
        } finally {
            setLoadingActions(prev => ({ ...prev, [uploadId]: false }));
        }
    }, []);

    /**
     * Delete upload
     */
    const deleteUpload = useCallback(async (uploadId: string) => {
        setLoadingActions(prev => ({ ...prev, [uploadId]: true }));
        try {
            const result = await uploadApi.deleteUpload({ uploadId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }

            removeUpload(uploadId);
            return true;
        } catch (err) {
            console.error('Delete error:', err);
            setError('Failed to delete upload');
            return false;
        } finally {
            setLoadingActions(prev => ({ ...prev, [uploadId]: false }));
        }
    }, [removeUpload]);

    /**
     * Stop parsing (delete upload)
     */
    const stopParsing = useCallback(async (uploadId: string) => {
        return deleteUpload(uploadId);
    }, [deleteUpload]);

    /**
     * Set loading state for a specific action
     */
    const setLoadingAction = useCallback((uploadId: string, loading: boolean) => {
        setLoadingActions(prev => ({ ...prev, [uploadId]: loading }));
    }, []);

    /**
     * Clear error
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        // Data
        uploads,
        isLoading,
        loadingActions,
        error,
        
        // Actions
        actions: {
            loadUploads,
            addOptimisticUpload,
            removeUpload,
            updateUpload,
            replaceUpload,
            handleSSEEvent,
            approveErrors,
            finalizeUpload,
            deleteUpload,
            stopParsing,
            setLoadingAction,
            clearError
        }
    };
};

