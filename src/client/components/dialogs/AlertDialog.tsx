import React from 'react';
import styles from './Dialog.module.css';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertDialogProps {
    type?: AlertType;
    title?: string;
    message: string;
    onClose: () => void;
}

/**
 * Custom alert dialog component to replace native browser alerts
 * Provides a consistent, styled alert experience across the app
 */
export const AlertDialog: React.FC<AlertDialogProps> = ({
    type = 'info',
    title,
    message,
    onClose
}) => {
    const config = {
        success: {
            icon: '✅',
            defaultTitle: 'Success',
            buttonClass: styles.alertButtonSuccess
        },
        error: {
            icon: '❌',
            defaultTitle: 'Error',
            buttonClass: styles.alertButtonError
        },
        warning: {
            icon: '⚠️',
            defaultTitle: 'Warning',
            buttonClass: styles.alertButtonWarning
        },
        info: {
            icon: 'ℹ️',
            defaultTitle: 'Info',
            buttonClass: styles.alertButtonInfo
        }
    };

    const { icon, defaultTitle, buttonClass } = config[type];
    const displayTitle = title || defaultTitle;

    return (
        <div className={styles.dialogOverlay} onClick={onClose}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.dialogIcon}>{icon}</div>
                <h2 className={styles.dialogTitle}>{displayTitle}</h2>
                <p className={styles.dialogMessage}>{message}</p>
                <div className={styles.dialogActions}>
                    <button
                        className={`${styles.alertButton} ${buttonClass}`}
                        onClick={onClose}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

