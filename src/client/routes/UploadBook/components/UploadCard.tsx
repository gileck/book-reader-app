import React from 'react';
import { ParserProgress } from './ParserProgress';
import type { UploadItem } from '../hooks/useUploadManager';
import styles from '../UploadBook.module.css';

interface UploadCardProps {
    upload: UploadItem;
    isSelected: boolean;
    isLoading: boolean;
    onSelectUpload: (uploadId: string) => void;
    onFinalizeUpload: (uploadId: string) => void;
    onDeleteUpload: (uploadId: string) => void;
    onRestartUpload: (uploadId: string) => void;
    onStopParsing: (uploadId: string) => void;
}

/**
 * Individual upload card component
 * Displays upload status, progress, and contextual actions
 */
export const UploadCard: React.FC<UploadCardProps> = ({
    upload,
    isSelected,
    isLoading,
    onSelectUpload,
    onFinalizeUpload,
    onDeleteUpload,
    onRestartUpload,
    onStopParsing
}) => {
    const getStatusIcon = (status: UploadItem['status']) => {
        switch (status) {
            case 'uploading': return '⏳';
            case 'parsing': return '⚙️';
            case 'awaiting-approval': return '⚠️';
            case 'success': return '✅';
            case 'failed': return '❌';
            default: return '⏳';
        }
    };

    const getStatusText = (status: UploadItem['status']) => {
        switch (status) {
            case 'uploading': return 'Initializing';
            case 'parsing': return 'Parsing Book';
            case 'awaiting-approval': return 'Needs Review';
            case 'success': return 'Ready to Add';
            case 'failed': return 'Upload Failed';
            default: return 'Processing';
        }
    };

    return (
        <div 
            className={`${styles.uploadCard} ${isSelected ? styles.selected : ''}`}
        >
            <div className={styles.uploadCardHeader}>
                <div className={`${styles.uploadStatusBadge} ${styles[upload.status.replace('-', '')]}`}>
                    <span className={styles.uploadStatusIcon}>
                        {getStatusIcon(upload.status)}
                    </span>
                    <span className={styles.uploadStatusText}>
                        {getStatusText(upload.status)}
                    </span>
                </div>
                <div className={styles.uploadTime}>
                    {new Date(upload.createdAt).toLocaleString()}
                </div>
            </div>

            {/* File Name and Upload ID */}
            <div className={styles.uploadMetadata}>
                {upload.fileName && (
                    <div className={styles.uploadFileName}>
                        <span className={styles.uploadMetadataLabel}>📄</span>
                        <span className={styles.uploadMetadataValue}>{upload.fileName}</span>
                    </div>
                )}
                <div className={styles.uploadId}>
                    <span className={styles.uploadMetadataLabel}>ID:</span>
                    <span className={styles.uploadMetadataValue}>{upload.uploadId}</span>
                </div>
            </div>

            <div className={styles.uploadCardBody}>
                {/* Uploading Status */}
                {upload.status === 'uploading' && (
                    <>
                        <div className={styles.uploadProgress}>
                            <ParserProgress
                                currentStep="Initializing upload..."
                                progress={upload.progress || 5}
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

                {/* Parsing Status */}
                {upload.status === 'parsing' && (
                    <>
                        {upload.currentStep && (
                            <div className={styles.uploadProgress}>
                                <ParserProgress
                                    currentStep={upload.currentStep}
                                    progress={upload.progress || 0}
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
                                    onStopParsing(upload.uploadId);
                                }}
                            >
                                <span className={styles.stopIcon}>⛔</span>
                                <span className={styles.stopText}>STOP PARSING</span>
                            </button>
                        </div>
                    </>
                )}

                {/* Failed Status */}
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

                {/* Actions for awaiting-approval, success, and failed statuses */}
                {(upload.status === 'awaiting-approval' || upload.status === 'success' || upload.status === 'failed') && (
                    <div className={styles.uploadActions}>
                        {/* Awaiting Approval Actions */}
                        {upload.status === 'awaiting-approval' && (
                            <>
                                <button
                                    className={styles.approveButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectUpload(upload.uploadId);
                                    }}
                                >
                                    <span>👀</span> REVIEW ERRORS
                                </button>
                                <button
                                    className={styles.deleteButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteUpload(upload.uploadId);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? '⏳' : '🗑️'} DELETE
                                </button>
                            </>
                        )}

                        {/* Success Actions */}
                        {upload.status === 'success' && (
                            <>
                                <button
                                    className={styles.approveButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectUpload(upload.uploadId);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>⏳ LOADING...</>
                                    ) : (
                                        <><span>📋</span> VIEW SUMMARY</>
                                    )}
                                </button>
                                <button
                                    className={styles.finalizeButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFinalizeUpload(upload.uploadId);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? '⏳ ADDING...' : '📚 ADD TO LIBRARY'}
                                </button>
                                <button
                                    className={styles.deleteButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteUpload(upload.uploadId);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? '⏳' : '🗑️'} DELETE
                                </button>
                            </>
                        )}

                        {/* Failed Actions */}
                        {upload.status === 'failed' && (
                            <>
                                {(upload.validationErrors && upload.validationErrors.length > 0) || 
                                 (upload.error && upload.error.toLowerCase().includes('validation')) ? (
                                    <>
                                        <button
                                            className={styles.approveButton}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectUpload(upload.uploadId);
                                            }}
                                        >
                                            <span>👀</span> REVIEW ERRORS
                                        </button>
                                        <button
                                            className={styles.restartButton}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRestartUpload(upload.uploadId);
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
                                            onRestartUpload(upload.uploadId);
                                        }}
                                    >
                                        <span>🔄</span> TRY AGAIN
                                    </button>
                                )}
                                <button
                                    className={styles.deleteButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteUpload(upload.uploadId);
                                    }}
                                    disabled={isLoading}
                                >
                                    {isLoading ? '⏳' : '🗑️'} DELETE
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

