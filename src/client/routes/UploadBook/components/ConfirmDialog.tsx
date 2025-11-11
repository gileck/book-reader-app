import React from 'react';
import styles from '../styles';

export type ConfirmDialogType = 'stop' | 'delete';

interface ConfirmDialogProps {
    type: ConfirmDialogType;
    uploadId: string;
    isLoading?: boolean;
    onConfirm: (uploadId: string) => void;
    onCancel: () => void;
}

/**
 * Reusable confirmation dialog component
 * Replaces native browser confirm dialogs with custom styled dialogs
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    type,
    uploadId,
    isLoading = false,
    onConfirm,
    onCancel
}) => {
    const config = {
        stop: {
            icon: '⛔',
            title: 'Stop Parsing?',
            message: 'This will cancel the upload and delete the PDF. You\'ll need to start over if you want to upload this book.',
            cancelText: 'Keep Parsing',
            confirmText: 'Stop & Delete',
            loadingText: 'Stopping...'
        },
        delete: {
            icon: '🗑️',
            title: 'Delete Upload?',
            message: 'This will permanently delete this upload and its PDF file. This action cannot be undone.',
            cancelText: 'Cancel',
            confirmText: 'Delete',
            loadingText: 'Deleting...'
        }
    };

    const { icon, title, message, cancelText, confirmText, loadingText } = config[type];

    return (
        <div className={styles.dialogOverlay}>
            <div className={styles.stopDialog}>
                <div className={styles.stopDialogIcon}>{icon}</div>
                <h2 className={styles.stopDialogTitle}>{title}</h2>
                <p className={styles.stopDialogMessage}>{message}</p>
                <div className={styles.stopDialogActions}>
                    <button
                        className={styles.stopDialogCancel}
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        className={styles.stopDialogConfirm}
                        onClick={() => onConfirm(uploadId)}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span className={styles.buttonSpinner} />
                                {loadingText}
                            </>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

