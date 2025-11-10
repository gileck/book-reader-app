import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from '../../router';
import { useAuth } from '../../context/AuthContext';
import styles from './UploadBook.module.css';
import { ValidationErrorDialog } from './components/ValidationErrorDialog';
import { ParserProgress } from './components/ParserProgress';
import * as uploadApi from '@/apis/upload/client';
import type { ParserMetadata } from '@/apis/upload/types';

interface ValidationError {
    message: string;
    step: string;
}

interface UploadItem {
    uploadId: string;
    status: 'uploading' | 'parsing' | 'awaiting-approval' | 'success' | 'failed' | 'timeout';
    createdAt: Date;
    fileName?: string;
    currentStep?: string;
    currentStepNumber?: number;
    totalSteps?: number;
    progress?: number;
    error?: string;
    validationErrors?: ValidationError[];
}

export const UploadBook = () => {
    const { user } = useAuth();
    const { navigate } = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
    const [file, setFile] = useState<File | null>(null);
    const [pdfUrl, setPdfUrl] = useState('');
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showStopConfirm, setShowStopConfirm] = useState<string | null>(null); // uploadId to stop
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null); // uploadId to delete
    const [isUploading, setIsUploading] = useState(false);
    const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({}); // Track loading state per upload

    // Get selected upload
    const selectedUpload = uploads.find(u => u.uploadId === selectedUploadId);

    // Load uploads from API
    const loadUploads = async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        try {
            const result = await uploadApi.listUploads({});
            if (result.data.error) {
                console.error('Error loading uploads:', result.data.error);
                setIsLoading(false);
                return;
            }

            // Set uploads even if it's an empty array
            setUploads(result.data.uploads || []);
            setIsLoading(false);
        } catch (err) {
            console.error('Failed to load uploads:', err);
            setIsLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        loadUploads();
    }, [user]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setError(null);
        } else {
            setError('Please select a valid PDF file');
        }
    };

    const handleModeToggle = (mode: 'file' | 'url') => {
        setUploadMode(mode);
        setError(null);
        
        if (mode === 'file') {
            setPdfUrl('');
        } else {
            setFile(null);
        }
    };

    const handleStartUpload = async () => {
        if (!user) return;
        
        if (uploadMode === 'file' && !file) {
            setError('Please select a PDF file');
            return;
        }
        if (uploadMode === 'url' && !pdfUrl.trim()) {
            setError('Please enter a PDF URL');
            return;
        }

        if (uploadMode === 'url') {
            try {
                const url = new URL(pdfUrl.trim());
                if (!['http:', 'https:'].includes(url.protocol)) {
                    setError('URL must start with http:// or https://');
                    return;
                }
            } catch {
                setError('Please enter a valid URL');
                return;
            }
        }

        setError(null);
        setIsUploading(true);
        setShowUploadForm(false); // Close form immediately

        // Create optimistic temporary upload item for immediate feedback
        const tempUploadId = `temp-${Date.now()}`;
        const tempUpload: UploadItem = {
            uploadId: tempUploadId,
            status: 'uploading',
            createdAt: new Date(),
            fileName: uploadMode === 'file' ? file?.name : pdfUrl.trim(),
            currentStep: 'Uploading PDF...',
            progress: 0
        };
        
        // Add temporary upload to list immediately
        setUploads(prev => [tempUpload, ...prev]);
        setSelectedUploadId(tempUploadId);

        try {
            let requestBody: { pdfBase64?: string; pdfUrl?: string; fileName?: string };

            if (uploadMode === 'file' && file) {
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const base64 = await base64Promise;
                requestBody = {
                    pdfBase64: base64,
                    fileName: file.name
                };
            } else {
                requestBody = {
                    pdfUrl: pdfUrl.trim()
                };
            }

            const response = await fetch('/api/upload/parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }) as Response;

            console.log('📞 Upload request completed, status:', response.status);
            console.log('📞 Response headers:', {
                contentType: response.headers.get('content-type'),
                cacheControl: response.headers.get('cache-control'),
                connection: response.headers.get('connection')
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            console.log('📞 Starting SSE stream reading...');

            // Process SSE stream
            const streamReader = response.body!.getReader();
            const decoder = new TextDecoder();
            let uploadId: string | null = null;

            console.log('📞 Stream reader created, entering read loop...');

            while (true) {
                const { done, value } = await streamReader.read();
                
                console.log('📞 Stream chunk received:', { done, valueSize: value?.length });
                
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.substring(6));
                        
                        // Log all SSE events for debugging
                        console.log('📡 SSE Event:', data);
                        
                        // Get uploadId from first event
                        if (data.uploadId && !uploadId) {
                            uploadId = data.uploadId;
                            
                            // Remove temp upload and add the real one from the server
                            setUploads(prev => {
                                const filtered = prev.filter(u => u.uploadId !== tempUploadId);
                                return [{
                                    uploadId: uploadId!, // Non-null assertion since we just checked above
                                    status: 'parsing' as const,
                                    createdAt: new Date(),
                                    fileName: uploadMode === 'file' ? file?.name : pdfUrl.trim(),
                                    currentStep: 'Starting parser...',
                                    progress: 5
                                }, ...filtered];
                            });
                            setSelectedUploadId(uploadId);
                        }
                        
                        // Update upload status from SSE event data
                        if (uploadId && (data.type === 'step-start' || data.type === 'step-complete' || data.type === 'step-progress' || data.type === 'finalizing')) {
                            setUploads(prev => prev.map(u => {
                                if (u.uploadId !== uploadId) return u;
                                return {
                                    ...u,
                                    status: 'parsing' as const,
                                    currentStep: data.message || data.step,
                                    currentStepNumber: data.stepNumber,
                                    totalSteps: data.totalSteps,
                                    progress: data.progress
                                };
                            }));
                        }
                        
                        // Handle validation errors
                        if (uploadId && data.type === 'validation-error') {
                            setUploads(prev => prev.map(u => {
                                if (u.uploadId !== uploadId) return u;
                                return {
                                    ...u,
                                    status: 'awaiting-approval' as const,
                                    currentStep: data.step,
                                    validationErrors: data.errors
                                };
                            }));
                        }
                        
                        // Handle completion
                        if (uploadId && data.type === 'complete') {
                            console.log('✅ Received complete event, updating UI to success status');
                            flushSync(() => {
                                setUploads(prev => prev.map(u => {
                                    if (u.uploadId !== uploadId) return u;
                                    return {
                                        ...u,
                                        status: 'success' as const,
                                        currentStep: undefined,
                                        currentStepNumber: undefined,
                                        progress: 100
                                    };
                                }));
                            });
                            console.log('✅ UI updated to success status');
                        }
                        
                        // Handle errors
                        if (uploadId && data.type === 'error') {
                            setUploads(prev => prev.map(u => {
                                if (u.uploadId !== uploadId) return u;
                                return {
                                    ...u,
                                    status: 'failed' as const,
                                    error: data.message
                                };
                            }));
                        }
                    }
                }
            }

            // No need to reload - SSE events already updated the UI!
            // await loadUploads();
            
            // Reset form
            setFile(null);
            setPdfUrl('');
            setIsUploading(false);

        } catch (err) {
            console.error('Upload error:', err);
            setError(err instanceof Error ? err.message : 'Upload failed');
            setIsUploading(false);
            
            // Remove temporary upload on error
            setUploads(prev => prev.filter(u => u.uploadId !== tempUploadId));
            setSelectedUploadId(null);
        }
    };

    const handleApproveErrors = async (uploadId: string) => {
        setLoadingActions(prev => ({ ...prev, [uploadId]: true }));
        try {
            // Get validation errors from the selected upload
            const upload = uploads.find(u => u.uploadId === uploadId);
            if (!upload || !upload.validationErrors) {
                throw new Error('No validation errors found');
            }

            // Convert validation errors to the expected format
            const errors = upload.validationErrors.map(err => ({
                step: err.step,
                chunkId: '' // Backend doesn't actually use this for now
            }));

            const result = await uploadApi.approveErrors({ uploadId, errors });
            if (result.data.error) {
                throw new Error(result.data.error);
            }

            // Reload to see updated status
            await loadUploads();
            setSelectedUploadId(null);
        } catch (err) {
            console.error('Approve errors failed:', err);
            setError('Failed to approve errors');
        } finally {
            setLoadingActions(prev => ({ ...prev, [uploadId]: false }));
        }
    };

    const handleFinalizeUpload = async (uploadId: string) => {
        setLoadingActions(prev => ({ ...prev, [uploadId]: true }));
        try {
            const result = await uploadApi.finalizeUpload({ uploadId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }

            if (result.data.bookId) {
                // Navigate to Reader with bookId query parameter
                navigate(`/?bookId=${result.data.bookId}`);
            }
        } catch (err) {
            console.error('Finalize failed:', err);
            setError('Failed to finalize upload');
        } finally {
            setLoadingActions(prev => ({ ...prev, [uploadId]: false }));
        }
    };

    const handleDeleteUpload = async (uploadId: string) => {
        setLoadingActions(prev => ({ ...prev, [uploadId]: true }));
        try {
            const result = await uploadApi.deleteUpload({ uploadId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }

            // Remove from list
            setUploads(prev => prev.filter(u => u.uploadId !== uploadId));
            if (selectedUploadId === uploadId) {
                setSelectedUploadId(null);
            }
            setShowDeleteConfirm(null);
        } catch (err) {
            console.error('Delete error:', err);
        } finally {
            setLoadingActions(prev => ({ ...prev, [uploadId]: false }));
        }
    };

    const handleRestartUpload = async (uploadId: string) => {
        // Delete and show upload form
        await handleDeleteUpload(uploadId);
        setShowUploadForm(true);
    };

    const handleStopParsing = async (uploadId: string) => {
        setLoadingActions(prev => ({ ...prev, [uploadId]: true }));
        try {
            // Delete the upload to stop the parser
            const result = await uploadApi.deleteUpload({ uploadId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }

            // Remove from list
            setUploads(prev => prev.filter(u => u.uploadId !== uploadId));
            if (selectedUploadId === uploadId) {
                setSelectedUploadId(null);
            }
            setShowStopConfirm(null);
        } catch (err) {
            console.error('Stop parsing error:', err);
            setError('Failed to stop parsing');
        } finally {
            setLoadingActions(prev => ({ ...prev, [uploadId]: false }));
        }
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingSection}>
                    <div className={styles.spinner} />
                    <p>Loading uploads...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Book Uploads</h1>
                <p>Manage your book uploads</p>
            </div>

            {/* Upload List */}
            {uploads.length > 0 && (
                <div className={styles.uploadsList}>
                    {uploads.map((upload) => (
                        <div 
                            key={upload.uploadId} 
                            className={`${styles.uploadCard} ${selectedUploadId === upload.uploadId ? styles.selected : ''}`}
                        >
                            <div className={styles.uploadCardHeader}>
                                <div className={`${styles.uploadStatusBadge} ${styles[upload.status.replace('-', '')]}`}>
                                    <span className={styles.uploadStatusIcon}>
                                        {upload.status === 'uploading' && '⏳'}
                                        {upload.status === 'parsing' && '⚙️'}
                                        {upload.status === 'awaiting-approval' && '⚠️'}
                                        {upload.status === 'success' && '✅'}
                                        {upload.status === 'failed' && '❌'}
                                    </span>
                                    <span className={styles.uploadStatusText}>
                                        {upload.status === 'uploading' && 'Initializing'}
                                        {upload.status === 'parsing' && 'Parsing Book'}
                                        {upload.status === 'awaiting-approval' && 'Needs Review'}
                                        {upload.status === 'success' && 'Ready to Add'}
                                        {upload.status === 'failed' && 'Upload Failed'}
                                    </span>
                                </div>
                                <div className={styles.uploadTime}>
                                    {new Date(upload.createdAt).toLocaleString()}
                                </div>
                            </div>

                            <div className={styles.uploadCardBody}>
                                {upload.status === 'uploading' && (
                                    <>
                                        <div className={styles.uploadProgress}>
                                            <ParserProgress
                                                currentStep="Initializing upload..."
                                                progress={upload.progress || 5}
                                                totalSteps={12}
                                                status="uploading"
                                            />
                                        </div>
                                        <div className={styles.parsingMessage}>
                                            <p className={styles.parsingMessageText}>
                                                ⏳ Initializing upload...
                                            </p>
                                            <p className={styles.parsingMessageSubtext}>
                                                Preparing your PDF for processing
                                            </p>
                                        </div>
                                    </>
                                )}

                                {upload.status === 'parsing' && (
                                    <>
                                        {upload.currentStep && (
                                            <div className={styles.uploadProgress}>
                                                <ParserProgress
                                                    currentStep={upload.currentStep}
                                                    progress={upload.progress || 0}
                                                    totalSteps={upload.totalSteps || 12}
                                                    status="parsing"
                                                />
                                            </div>
                                        )}
                                        <div className={styles.compactParsingMessage}>
                                            <p className={styles.compactParsingMessageText}>
                                                ⏱️ This may take a few minutes. You can leave and come back later.
                                            </p>
                                        </div>
                                        <div className={styles.uploadActions}>
                                            <button
                                                className={styles.stopButton}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowStopConfirm(upload.uploadId);
                                                }}
                                            >
                                                <span className={styles.stopIcon}>⛔</span>
                                                <span className={styles.stopText}>STOP PARSING</span>
                                            </button>
                                        </div>
                                    </>
                                )}

                                {upload.status === 'failed' && upload.error && (
                                    <div className={styles.uploadError}>
                                        <div className={styles.uploadErrorTitle}>
                                            <span>⚠️</span>
                                            PARSER ERROR
                                        </div>
                                        <div className={styles.uploadErrorMessage}>
                                            {upload.error}
                                        </div>
                                        {upload.validationErrors && upload.validationErrors.length > 0 && (
                                            <div className={styles.errorHint}>
                                                💡 This upload has validation errors that need review
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(upload.status === 'awaiting-approval' || upload.status === 'success' || upload.status === 'failed') && (
                                    <div className={styles.uploadActions}>
                                        {upload.status === 'awaiting-approval' && (
                                            <>
                                                <button
                                                    className={styles.approveButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedUploadId(upload.uploadId);
                                                    }}
                                                >
                                                    <span>👀</span> REVIEW ERRORS
                                                </button>
                                                <button
                                                    className={styles.deleteButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowDeleteConfirm(upload.uploadId);
                                                    }}
                                                    disabled={loadingActions[upload.uploadId]}
                                                >
                                                    {loadingActions[upload.uploadId] ? '⏳' : '🗑️'} DELETE
                                                </button>
                                            </>
                                        )}

                                        {upload.status === 'success' && (
                                            <>
                                                <button
                                                    className={styles.approveButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedUploadId(upload.uploadId);
                                                    }}
                                                    disabled={loadingActions[upload.uploadId]}
                                                >
                                                    {loadingActions[upload.uploadId] ? (
                                                        <>⏳ LOADING...</>
                                                    ) : (
                                                        <><span>📋</span> VIEW SUMMARY</>
                                                    )}
                                                </button>
                                                <button
                                                    className={styles.finalizeButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleFinalizeUpload(upload.uploadId);
                                                    }}
                                                    disabled={loadingActions[upload.uploadId]}
                                                >
                                                    {loadingActions[upload.uploadId] ? '⏳ ADDING...' : '📚 ADD TO LIBRARY'}
                                                </button>
                                                <button
                                                    className={styles.deleteButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowDeleteConfirm(upload.uploadId);
                                                    }}
                                                    disabled={loadingActions[upload.uploadId]}
                                                >
                                                    {loadingActions[upload.uploadId] ? '⏳' : '🗑️'} DELETE
                                                </button>
                                            </>
                                        )}

                                        {upload.status === 'failed' && (
                                            <>
                                                {/* Show Review Errors if validation errors exist OR if error message mentions validation */}
                                                {(upload.validationErrors && upload.validationErrors.length > 0) || 
                                                 (upload.error && upload.error.toLowerCase().includes('validation')) ? (
                                                    <>
                                                        <button
                                                            className={styles.approveButton}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedUploadId(upload.uploadId);
                                                            }}
                                                        >
                                                            <span>👀</span> REVIEW ERRORS
                                                        </button>
                                                        <button
                                                            className={styles.restartButton}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRestartUpload(upload.uploadId);
                                                            }}
                                                        >
                                                            <span>🔄</span> START OVER
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className={styles.restartButton}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRestartUpload(upload.uploadId);
                                                        }}
                                                    >
                                                        <span>🔄</span> TRY AGAIN
                                                    </button>
                                                )}
                                                <button
                                                    className={styles.deleteButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowDeleteConfirm(upload.uploadId);
                                                    }}
                                                    disabled={loadingActions[upload.uploadId]}
                                                >
                                                    {loadingActions[upload.uploadId] ? '⏳' : '🗑️'} DELETE
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && uploads.length === 0 && !showUploadForm && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>📚</div>
                    <h2 className={styles.emptyStateTitle}>No Uploads Yet</h2>
                    <p className={styles.emptyStateText}>
                        Get started by uploading your first PDF book. Our parser will extract chapters, metadata, and make it ready to read.
                    </p>
                </div>
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
                <div className={styles.uploadForm}>
                    <div className={styles.formHeader}>
                        <h2>Upload New Book</h2>
                        <button
                            className={styles.closeButton}
                            onClick={() => {
                                setShowUploadForm(false);
                                setError(null);
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <div className={styles.formBody}>
                        <div className={styles.modeToggle}>
                            <button
                                className={`${styles.modeButton} ${uploadMode === 'file' ? styles.active : ''}`}
                                onClick={() => handleModeToggle('file')}
                            >
                                📄 Upload File
                            </button>
                            <button
                                className={`${styles.modeButton} ${uploadMode === 'url' ? styles.active : ''}`}
                                onClick={() => handleModeToggle('url')}
                            >
                                🔗 From URL
                            </button>
                        </div>

                        {uploadMode === 'file' ? (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                                <button
                                    className={styles.selectFileButton}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {file ? file.name : 'Select PDF File'}
                                </button>
                            </>
                        ) : (
                            <div className={styles.urlInputContainer}>
                                <label htmlFor="pdf-url-input" className="sr-only">
                                    PDF URL
                                </label>
                                <input
                                    id="pdf-url-input"
                                    type="url"
                                    placeholder="https://example.com/book.pdf"
                                    value={pdfUrl}
                                    onChange={(e) => setPdfUrl(e.target.value)}
                                    className={styles.urlInput}
                                    aria-label="Enter PDF URL"
                                />
                            </div>
                        )}

                        {error && (
                            <div className={styles.errorSectionMessage}>
                                {error}
                            </div>
                        )}

                        <button
                            className={styles.uploadButton}
                            onClick={handleStartUpload}
                            disabled={isUploading || (uploadMode === 'file' ? !file : !pdfUrl.trim())}
                        >
                            {isUploading ? '⏳ UPLOADING...' : 'START UPLOAD'}
                        </button>
                    </div>
                </div>
            )}

            {/* Validation Error Dialog */}
            {((selectedUpload?.status === 'awaiting-approval' && selectedUpload.validationErrors) ||
              (selectedUpload?.status === 'failed' && ((selectedUpload.validationErrors && selectedUpload.validationErrors.length > 0) || 
              (selectedUpload.error && selectedUpload.error.toLowerCase().includes('validation'))))) && (
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
                />
            )}

            {/* Book Preview Dialog */}
            {selectedUpload?.status === 'success' && (
                <BookPreviewDialog
                    uploadId={selectedUpload.uploadId}
                    onFinalize={() => handleFinalizeUpload(selectedUpload.uploadId)}
                    onCancel={() => setSelectedUploadId(null)}
                    onLoadingChange={(loading) => {
                        setLoadingActions(prev => ({
                            ...prev,
                            [selectedUpload.uploadId]: loading
                        }));
                    }}
                />
            )}

            {/* Stop Parsing Confirmation Dialog */}
            {showStopConfirm && (
                <div className={styles.dialogOverlay}>
                    <div className={styles.stopDialog}>
                        <div className={styles.stopDialogIcon}>⛔</div>
                        <h2 className={styles.stopDialogTitle}>Stop Parsing?</h2>
                        <p className={styles.stopDialogMessage}>
                            This will cancel the upload and delete the PDF. You&apos;ll need to start over if you want to upload this book.
                        </p>
                        <div className={styles.stopDialogActions}>
                            <button
                                className={styles.stopDialogCancel}
                                onClick={() => setShowStopConfirm(null)}
                                disabled={loadingActions[showStopConfirm]}
                            >
                                Keep Parsing
                            </button>
                            <button
                                className={styles.stopDialogConfirm}
                                onClick={() => handleStopParsing(showStopConfirm)}
                                disabled={loadingActions[showStopConfirm]}
                            >
                                {loadingActions[showStopConfirm] ? '⏳ Stopping...' : 'Stop & Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className={styles.dialogOverlay}>
                    <div className={styles.stopDialog}>
                        <div className={styles.stopDialogIcon}>🗑️</div>
                        <h2 className={styles.stopDialogTitle}>Delete Upload?</h2>
                        <p className={styles.stopDialogMessage}>
                            This will permanently delete this upload and its PDF file. This action cannot be undone.
                        </p>
                        <div className={styles.stopDialogActions}>
                            <button
                                className={styles.stopDialogCancel}
                                onClick={() => setShowDeleteConfirm(null)}
                                disabled={loadingActions[showDeleteConfirm]}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.stopDialogConfirm}
                                onClick={() => handleDeleteUpload(showDeleteConfirm)}
                                disabled={loadingActions[showDeleteConfirm]}
                            >
                                {loadingActions[showDeleteConfirm] ? '⏳ Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Book Preview Dialog Component
const BookPreviewDialog: React.FC<{
    uploadId: string;
    onFinalize: () => void;
    onCancel: () => void;
    onLoadingChange?: (loading: boolean) => void;
}> = ({ uploadId, onFinalize, onCancel, onLoadingChange }) => {
    const [metadata, setMetadata] = useState<ParserMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDebugDialog, setShowDebugDialog] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            onLoadingChange?.(true);
            try {
                const result = await uploadApi.getMetadata({ uploadId });
                if (result.data.error) {
                    setError(result.data.error);
                } else if (result.data.metadata) {
                    setMetadata(result.data.metadata);
                } else {
                    setError('No metadata available');
                }
            } catch (err) {
                console.error('Failed to load metadata:', err);
                setError('Failed to load metadata');
            } finally {
                setLoading(false);
                onLoadingChange?.(false);
            }
        };
        loadData();
    }, [uploadId]); // onLoadingChange is intentionally excluded to avoid infinite loops

    if (loading) {
        return (
            <div className={styles.dialogOverlay}>
                <div className={styles.dialog}>
                    <div className={styles.spinner} />
                </div>
            </div>
        );
    }

    if (error || !metadata) {
        return (
            <div className={styles.dialogOverlay}>
                <div className={styles.previewDialog}>
                    <div className={styles.previewHeader}>
                        <div className={styles.previewSuccessIcon} style={{ background: 'linear-gradient(135deg, #FF9500 0%, #FF3B30 100%)' }}>
                            ⚠️
                        </div>
                        <h2 className={styles.previewTitle}>Unable to Load Summary</h2>
                        <p className={styles.previewSubtitle}>
                            {error || 'Metadata is not available for this upload'}
                        </p>
                    </div>
                    <div className={styles.previewActions}>
                        <button className={styles.previewCancelButton} onClick={onCancel}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.dialogOverlay}>
            <div className={styles.previewDialog}>
                <div className={styles.previewHeader}>
                    <div className={styles.previewSuccessIcon}>✓</div>
                    <h2 className={styles.previewTitle}>Parser Output Summary</h2>
                    <p className={styles.previewSubtitle}>Review the extracted book data before adding to your library</p>
                </div>

                {metadata && (
                    <div className={styles.previewContent}>
                        {/* Book Info Card */}
                        <div className={styles.bookInfoCard}>
                            <h3 className={styles.bookTitle}>{metadata.title}</h3>
                            {metadata.author && (
                                <p className={styles.bookAuthor}>by {metadata.author}</p>
                            )}
                            {metadata.description && (
                                <p className={styles.bookDescription}>{metadata.description}</p>
                            )}

                            {/* Stats Grid */}
                            <div className={styles.statsGrid}>
                                <div className={styles.statItem}>
                                    <span className={styles.statIcon}>📚</span>
                                    <span className={styles.statValue}>{metadata.chapterCount || metadata.chapters.length}</span>
                                    <span className={styles.statLabel}>Chapters</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statIcon}>📝</span>
                                    <span className={styles.statValue}>
                                        {metadata.totalWordCount?.toLocaleString() || '0'}
                                    </span>
                                    <span className={styles.statLabel}>Words</span>
                                </div>
                                {metadata.language && (
                                    <div className={styles.statItem}>
                                        <span className={styles.statIcon}>🌐</span>
                                        <span className={styles.statValue}>{metadata.language.toUpperCase()}</span>
                                        <span className={styles.statLabel}>Language</span>
                                    </div>
                                )}
                                {metadata.totalSentences && (
                                    <div className={styles.statItem}>
                                        <span className={styles.statIcon}>💬</span>
                                        <span className={styles.statValue}>{metadata.totalSentences.toLocaleString()}</span>
                                        <span className={styles.statLabel}>Sentences</span>
                                    </div>
                                )}
                                {metadata.totalParagraphs && (
                                    <div className={styles.statItem}>
                                        <span className={styles.statIcon}>¶</span>
                                        <span className={styles.statValue}>{metadata.totalParagraphs.toLocaleString()}</span>
                                        <span className={styles.statLabel}>Paragraphs</span>
                                    </div>
                                )}
                                {metadata.totalImages && (
                                    <div className={styles.statItem}>
                                        <span className={styles.statIcon}>🖼️</span>
                                        <span className={styles.statValue}>{metadata.totalImages.toLocaleString()}</span>
                                        <span className={styles.statLabel}>Images</span>
                                    </div>
                                )}
                                {metadata.totalLinks && (
                                    <div className={styles.statItem}>
                                        <span className={styles.statIcon}>🔗</span>
                                        <span className={styles.statValue}>{metadata.totalLinks.toLocaleString()}</span>
                                        <span className={styles.statLabel}>Links</span>
                                    </div>
                                )}
                                {metadata.averageWordsPerChapter && (
                                    <div className={styles.statItem}>
                                        <span className={styles.statIcon}>📊</span>
                                        <span className={styles.statValue}>{Math.round(metadata.averageWordsPerChapter).toLocaleString()}</span>
                                        <span className={styles.statLabel}>Avg Words/Ch</span>
                                    </div>
                                )}
                                {metadata.averageWordsPerParagraph && (
                                    <div className={styles.statItem}>
                                        <span className={styles.statIcon}>📏</span>
                                        <span className={styles.statValue}>{Math.round(metadata.averageWordsPerParagraph).toLocaleString()}</span>
                                        <span className={styles.statLabel}>Avg Words/¶</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Chapters List */}
                        <div className={styles.chaptersCard}>
                            <h4 className={styles.chaptersTitle}>
                                <span>📖</span>
                                Table of Contents ({metadata.chapters.length} chapters)
                            </h4>
                            <div className={styles.chaptersList}>
                                {metadata.chapters.slice(0, 10).map((chapter) => (
                                    <div key={chapter.number} className={styles.chapterItem}>
                                        <span className={styles.chapterNumber}>Ch. {chapter.number}</span>
                                        <span className={styles.chapterTitle}>{chapter.title}</span>
                                    </div>
                                ))}
                                {metadata.chapters.length > 10 && (
                                    <div className={styles.moreChapters}>
                                        + {metadata.chapters.length - 10} more chapters
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Debug Info - Show S3 Key */}
                        {metadata.parserOutputS3Key && (
                            <div className={styles.debugCard}>
                                <h4 className={styles.debugTitle}>
                                    <span>🔍</span>
                                    Debug Info
                                </h4>
                                <div className={styles.debugContent}>
                                    <div className={styles.debugItem}>
                                        <span className={styles.debugLabel}>Parser Output:</span>
                                        <code className={styles.debugValue}>{metadata.parserOutputS3Key}</code>
                                    </div>
                                    <div className={styles.debugButtons}>
                                        <button 
                                            className={styles.debugButton}
                                            onClick={() => {
                                                console.log('Parser Output S3 Key:', metadata.parserOutputS3Key);
                                                console.log('Full Metadata:', metadata);
                                                setShowDebugDialog(true);
                                            }}
                                        >
                                            📋 View Details
                                        </button>
                                        {metadata.parserOutputUrl && (
                                            <a 
                                                href={metadata.parserOutputUrl}
                                                download="parser-output.json"
                                                className={styles.debugDownloadButton}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                ⬇️ Download JSON
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.previewActions}>
                    <button className={styles.previewCancelButton} onClick={onCancel}>
                        Cancel
                    </button>
                    <button className={styles.previewConfirmButton} onClick={onFinalize}>
                        <span>✓</span> Add to Library
                    </button>
                </div>
            </div>

            {/* Debug Info Dialog */}
            {showDebugDialog && metadata && (
                <div className={styles.dialogOverlay} onClick={() => setShowDebugDialog(false)}>
                    <div className={styles.stopDialog} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.stopDialogIcon}>🔍</div>
                        <h2 className={styles.stopDialogTitle}>Debug Information</h2>
                        <div className={styles.debugDialogContent}>
                            <div className={styles.debugDialogSection}>
                                <p className={styles.debugDialogLabel}>Parser Output Location:</p>
                                <code className={styles.debugDialogCode}>{metadata.parserOutputS3Key}</code>
                            </div>
                            
                            {metadata.parserOutputUrl && (
                                <div className={styles.debugDialogSection}>
                                    <p className={styles.debugDialogLabel}>Download URL (valid for 1 hour):</p>
                                    <div className={styles.debugUrlContainer}>
                                        <code className={styles.debugDialogCode}>{metadata.parserOutputUrl}</code>
                                        <div className={styles.debugUrlActions}>
                                            <button
                                                className={styles.debugCopyButton}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(metadata.parserOutputUrl || '');
                                                }}
                                            >
                                                📋 Copy
                                            </button>
                                            <a
                                                href={metadata.parserOutputUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.debugOpenButton}
                                            >
                                                🔗 Open
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div className={styles.debugDialogSection}>
                                <p className={styles.debugDialogLabel}>Total Word Count:</p>
                                <code className={styles.debugDialogCode}>{metadata.totalWordCount || 0} words</code>
                            </div>
                            <div className={styles.debugDialogSection}>
                                <p className={styles.debugDialogLabel}>Average Words Per Chapter:</p>
                                <code className={styles.debugDialogCode}>
                                    {metadata.averageWordsPerChapter?.toLocaleString() || 'N/A'}
                                </code>
                            </div>
                            <p className={styles.debugDialogHint}>
                                ℹ️ Full metadata object has been logged to the browser console
                            </p>
                        </div>
                        <div className={styles.stopDialogActions}>
                            <button
                                className={styles.stopDialogCancel}
                                onClick={() => setShowDebugDialog(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
