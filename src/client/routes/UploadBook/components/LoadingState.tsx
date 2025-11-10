import React from 'react';
import styles from '../UploadBook.module.css';

/**
 * Loading state component shown while fetching uploads
 */
export const LoadingState: React.FC = () => {
    return (
        <div className={styles.container}>
            <div className={styles.loadingSection}>
                <div className={styles.spinner} />
                <p>Loading uploads...</p>
            </div>
        </div>
    );
};

