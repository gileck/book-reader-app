import React, { useState, useEffect } from 'react';
import * as uploadApi from '@/apis/upload/client';
import type { ParserMetadata } from '@/apis/upload/types';
import styles from '../UploadBook.module.css';

interface BookPreviewDialogProps {
    uploadId: string;
    onFinalize: () => void;
    onCancel: () => void;
    onLoadingChange?: (loading: boolean) => void;
}

/**
 * Dialog component for previewing parser output before adding to library
 * Shows book metadata, statistics, and table of contents
 */
export const BookPreviewDialog: React.FC<BookPreviewDialogProps> = ({ 
    uploadId, 
    onFinalize, 
    onCancel, 
    onLoadingChange 
}) => {
    const [metadata, setMetadata] = useState<ParserMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
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

    const handleFinalize = async () => {
        setFinalizing(true);
        onLoadingChange?.(true);
        try {
            await onFinalize();
        } finally {
            // Don't reset finalizing state here - parent will unmount this component
            // after navigation
        }
    };

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
                            {/* Cover Image */}
                            {metadata.coverImageUrl && (
                                <div className={styles.coverImageContainer}>
                                    <img 
                                        src={metadata.coverImageUrl} 
                                        alt={`Cover for ${metadata.title}`}
                                        className={styles.coverImage}
                                        onError={(e) => {
                                            // Hide image if it fails to load
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                            
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
                    <button 
                        className={styles.previewCancelButton} 
                        onClick={onCancel}
                        disabled={finalizing}
                    >
                        Cancel
                    </button>
                    <button 
                        className={styles.previewConfirmButton} 
                        onClick={handleFinalize}
                        disabled={finalizing}
                    >
                        {finalizing ? (
                            <>
                                <span className={styles.spinner} style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                Adding to Library...
                            </>
                        ) : (
                            <>
                                <span>✓</span> Add to Library
                            </>
                        )}
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

