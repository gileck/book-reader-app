import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from '../../router';
import { useAuth } from '../../context/AuthContext';
import styles from './UploadBook.module.css';

// Hooks
import { useUploadManager } from './hooks/useUploadManager';
import { useSSEUpload } from './hooks/useSSEUpload';
import { useUploadForm } from './hooks/useUploadForm';
import type { SSEEvent } from './hooks/useUploadManager';

// Components
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import { UploadList } from './components/UploadList';
import { UploadForm } from './components/UploadForm';
import { BookPreviewDialog } from './components/BookPreviewDialog';
import { ValidationErrorDialog } from './components/ValidationErrorDialog';
import { ConfirmDialog, type ConfirmDialogType } from './components/ConfirmDialog';

/**
 * Main upload book page component
 * Manages book upload workflow: file/URL upload → parsing → validation → library
 */
export const UploadBook = () => {
    const { user } = useAuth();
    const { navigate } = useRouter();

    // Custom hooks for state management
    const uploadManager = useUploadManager(user?.id);
    const sseUpload = useSSEUpload();
    const uploadForm = useUploadForm();

    // UI state
    const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ type: ConfirmDialogType; uploadId: string } | null>(null);

    // Get selected upload
    const selectedUpload = uploadManager.uploads.find(u => u.uploadId === selectedUploadId);

    /**
     * Handle upload start - creates optimistic UI and starts SSE stream
     */
    const handleStartUpload = async () => {
        if (!user) return;

        // Validate form
        if (!uploadForm.validate()) {
            return;
        }

        // Close form and reset error
        setShowUploadForm(false);
        uploadForm.clearError();

        // Clean up any old awaiting-approval uploads before starting a new one
        // to prevent confusion with multiple uploads in the same state
        const oldAwaitingUploads = uploadManager.uploads.filter(
            u => u.status === 'awaiting-approval'
        );
        for (const oldUpload of oldAwaitingUploads) {
            console.log(`🧹 Cleaning up old awaiting-approval upload: ${oldUpload.uploadId}`);
            await uploadManager.actions.deleteUpload(oldUpload.uploadId);
        }

        // Create optimistic temporary upload item for immediate feedback
        const tempUploadId = `temp-${Date.now()}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        uploadManager.actions.addOptimisticUpload({
            uploadId: tempUploadId,
            status: 'uploading',
            createdAt: now,
            expiresAt: expiresAt,
            fileName: uploadForm.getFileName(),
            currentStep: 'Uploading PDF...',
            progress: 0,
            continueOnValidationError: uploadForm.continueOnValidationError
        });
        setSelectedUploadId(tempUploadId);

        try {
            let realUploadId: string | null = null;

            // Start SSE upload with event handler
            await sseUpload.startUpload(
                {
                    file: uploadForm.file,
                    pdfUrl: uploadForm.pdfUrl,
                    uploadMode: uploadForm.uploadMode,
                    fileName: uploadForm.getFileName(),
                    continueOnValidationError: uploadForm.continueOnValidationError
                },
                (event: SSEEvent) => {
                    // Handle SSE event and get real uploadId
                    // Only pass tempUploadId for the first event (when realUploadId is not set yet)
                    const uploadId = uploadManager.actions.handleSSEEvent(
                        event, 
                        realUploadId ? undefined : tempUploadId
                    );
                    
                    // Update realUploadId when we get it
                    if (uploadId && !realUploadId) {
                        realUploadId = uploadId;
                        setSelectedUploadId(uploadId);
                    }
                    
                    // Force immediate UI update on completion
                    if (event.type === 'complete' && realUploadId) {
                        flushSync(() => {
                            uploadManager.actions.updateUpload(realUploadId!, {
                                status: 'success',
                                currentStep: undefined,
                                currentStepNumber: undefined,
                                progress: 100
                            });
                        });
                        // Don't auto-select - let user click to view preview/errors
                        setSelectedUploadId(null);
                    }
                    
                    return uploadId;
                }
            );

            // Reset form
            uploadForm.reset();

        } catch (err) {
            console.error('Upload error:', err);
            uploadForm.setError(err instanceof Error ? err.message : 'Upload failed');
            
            // Remove temporary upload on error
            uploadManager.actions.removeUpload(tempUploadId);
            setSelectedUploadId(null);
        }
    };

    /**
     * Handle error approval
     */
    const handleApproveErrors = async (uploadId: string) => {
        await uploadManager.actions.approveErrors(uploadId);
        // Don't clear selectedUploadId - keep the same upload selected
        // so user can continue approving errors for subsequent validation steps
    };

    /**
     * Handle finalize upload and navigate to book
     */
    const handleFinalizeUpload = async (uploadId: string) => {
        const bookId = await uploadManager.actions.finalizeUpload(uploadId);
        if (bookId) {
            navigate(`/?bookId=${bookId}`);
        }
    };

    /**
     * Handle delete upload with confirmation
     */
    const handleDeleteUpload = (uploadId: string) => {
        setConfirmDialog({ type: 'delete', uploadId });
    };

    /**
     * Handle restart upload (delete and show form)
     */
    const handleRestartUpload = async (uploadId: string) => {
        const success = await uploadManager.actions.deleteUpload(uploadId);
        if (success) {
            setShowUploadForm(true);
        }
    };

    /**
     * Handle stop parsing with confirmation
     */
    const handleStopParsing = (uploadId: string) => {
        setConfirmDialog({ type: 'stop', uploadId });
    };

    /**
     * Handle confirm dialog action
     */
    const handleConfirmAction = async (uploadId: string) => {
        if (!confirmDialog) return;

        if (confirmDialog.type === 'stop') {
            const success = await uploadManager.actions.stopParsing(uploadId);
            if (success && selectedUploadId === uploadId) {
                setSelectedUploadId(null);
            }
        } else if (confirmDialog.type === 'delete') {
            await uploadManager.actions.deleteUpload(uploadId);
            if (selectedUploadId === uploadId) {
                setSelectedUploadId(null);
            }
        }

        setConfirmDialog(null);
    };

    // Loading state
    if (uploadManager.isLoading) {
        return <LoadingState />;
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1>Book Uploads</h1>
                <p>Manage your book uploads</p>
            </div>

            {/* Upload List or Empty State */}
            {uploadManager.uploads.length > 0 ? (
                <UploadList
                    uploads={uploadManager.uploads}
                    selectedId={selectedUploadId}
                    loadingActions={uploadManager.loadingActions}
                    onSelectUpload={setSelectedUploadId}
                    onFinalizeUpload={handleFinalizeUpload}
                    onDeleteUpload={handleDeleteUpload}
                    onRestartUpload={handleRestartUpload}
                    onStopParsing={handleStopParsing}
                />
            ) : (
                !showUploadForm && <EmptyState />
            )}

            {/* New Upload Button */}
            {!showUploadForm && (
                <button
                    className={styles.newUploadButton}
                    onClick={() => setShowUploadForm(true)}
                >
                    <span style={{ fontSize: '24px', marginRight: '8px' }}>📤</span>
                    Upload New Book
                </button>
            )}

            {/* Upload Form */}
            {showUploadForm && (
                <UploadForm
                    uploadMode={uploadForm.uploadMode}
                    file={uploadForm.file}
                    pdfUrl={uploadForm.pdfUrl}
                    error={uploadForm.error}
                    isUploading={sseUpload.isUploading}
                    isValid={uploadForm.isValid}
                    continueOnValidationError={uploadForm.continueOnValidationError}
                    fileInputRef={uploadForm.fileInputRef as React.RefObject<HTMLInputElement>}
                    onModeToggle={uploadForm.handleModeToggle}
                    onFileSelect={uploadForm.handleFileSelect}
                    onUrlChange={uploadForm.setPdfUrl}
                    onContinueOnErrorToggle={uploadForm.setContinueOnValidationError}
                    onSubmit={handleStartUpload}
                    onClose={() => {
                        setShowUploadForm(false);
                        uploadForm.clearError();
                    }}
                />
            )}

            {/* Validation Error Dialog */}
            {/* For continue mode: NEVER show automatically - only when user explicitly clicks */}
            {/* For normal mode: show automatically when awaiting-approval or failed */}
            {selectedUpload && (
                (selectedUpload.status === 'awaiting-approval' && 
                 selectedUpload.validationErrors && 
                 !selectedUpload.continueOnValidationError) || // Normal mode: show automatically
                (selectedUpload.status === 'failed' && 
                 ((selectedUpload.validationErrors && selectedUpload.validationErrors.length > 0) || 
                  (selectedUpload.error && selectedUpload.error.toLowerCase().includes('validation'))))
            ) && (
                <ValidationErrorDialog
                    errors={selectedUpload.validationErrors && selectedUpload.validationErrors.length > 0 
                        ? selectedUpload.validationErrors 
                        : [{
                            step: selectedUpload.currentStep || 'Parser',
                            message: selectedUpload.error || 'Validation failed. The parser could not extract detailed error information.'
                        }]}
                    onApprove={() => handleApproveErrors(selectedUpload.uploadId)}
                    onCancel={() => setSelectedUploadId(null)}
                    isFailed={selectedUpload.status === 'failed'}
                    isLoading={uploadManager.loadingActions[selectedUpload.uploadId] || false}
                    isSummary={false}
                />
            )}

            {/* Errors Display Dialog (view-only, no approval) */}
            {selectedUpload?.status === 'success' && selectedUpload.validationErrors && selectedUpload.validationErrors.length > 0 && (
                <ValidationErrorDialog
                    errors={selectedUpload.validationErrors}
                    onApprove={() => setSelectedUploadId(null)} // Just close
                    onCancel={() => setSelectedUploadId(null)}
                    isFailed={false}
                    isLoading={false}
                    isSummary={true}
                    viewOnly={true} // New prop for view-only mode
                />
            )}

            {/* Book Preview Dialog */}
            {selectedUpload?.status === 'success' && !selectedUpload.validationErrors && (
                <BookPreviewDialog
                    uploadId={selectedUpload.uploadId}
                    onFinalize={() => handleFinalizeUpload(selectedUpload.uploadId)}
                    onCancel={() => setSelectedUploadId(null)}
                    onLoadingChange={(loading) => {
                        uploadManager.actions.setLoadingAction(selectedUpload.uploadId, loading);
                    }}
                />
            )}

            {/* Confirmation Dialog */}
            {confirmDialog && (
                <ConfirmDialog
                    type={confirmDialog.type}
                    uploadId={confirmDialog.uploadId}
                    isLoading={uploadManager.loadingActions[confirmDialog.uploadId] || false}
                    onConfirm={handleConfirmAction}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </div>
    );
};
