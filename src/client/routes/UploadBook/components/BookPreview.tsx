import React from 'react';
import styles from '../styles';

interface BookPreviewProps {
    metadata: {
        title: string;
        author: string;
        description?: string;
        chapters: Array<{
            chapterNumber: number;
            title: string;
            wordCount?: number;
        }>;
    };
    onFinalize: () => void;
    onCancel: () => void;
    finalizing: boolean;
}

export const BookPreview: React.FC<BookPreviewProps> = ({
    metadata,
    onFinalize,
    onCancel,
    finalizing
}) => {
    return (
        <div className={styles.previewSection}>
            <div className={styles.successIcon}>✓</div>
            <h2>Parsing Complete!</h2>
            
            <div className={styles.metadataCard}>
                <h3>{metadata.title}</h3>
                <p className={styles.author}>by {metadata.author}</p>
                
                {metadata.description && (
                    <p className={styles.description}>{metadata.description}</p>
                )}
                
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span className={styles.statLabel}>Chapters</span>
                        <span className={styles.statValue}>{metadata.chapters.length}</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statLabel}>Words</span>
                        <span className={styles.statValue}>
                            {metadata.chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0).toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>
            
            {metadata.chapters.length > 0 && (
                <div className={styles.chaptersCard}>
                    <h4>Table of Contents</h4>
                    <div className={styles.chaptersList}>
                        {metadata.chapters.slice(0, 10).map((chapter) => (
                            <div key={chapter.chapterNumber} className={styles.chapterItem}>
                                <span className={styles.chapterNumber}>
                                    {chapter.chapterNumber}
                                </span>
                                <span className={styles.chapterTitle}>{chapter.title}</span>
                                {chapter.wordCount && (
                                    <span className={styles.chapterWords}>
                                        {chapter.wordCount.toLocaleString()} words
                                    </span>
                                )}
                            </div>
                        ))}
                        {metadata.chapters.length > 10 && (
                            <p className={styles.moreChapters}>
                                ...and {metadata.chapters.length - 10} more chapter(s)
                            </p>
                        )}
                    </div>
                </div>
            )}
            
            <div className={styles.previewActions}>
                <button className={styles.cancelButton} onClick={onCancel} disabled={finalizing}>
                    Cancel
                </button>
                <button 
                    className={styles.finalizeButton} 
                    onClick={onFinalize}
                    disabled={finalizing}
                >
                    {finalizing ? 'Adding to Library...' : 'Add to Library'}
                </button>
            </div>
        </div>
    );
};

