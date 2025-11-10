import React from 'react';
import styles from '../UploadBook.module.css';

/**
 * Empty state component shown when no uploads exist
 */
export const EmptyState: React.FC = () => {
    return (
        <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>📚</div>
            <h2 className={styles.emptyStateTitle}>No Uploads Yet</h2>
            <p className={styles.emptyStateText}>
                Get started by uploading your first PDF book. Our parser will extract chapters, metadata, and make it ready to read.
            </p>
        </div>
    );
};

