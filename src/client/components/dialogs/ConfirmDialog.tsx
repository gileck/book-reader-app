import React from 'react';
import styles from './Dialog.module.css';

export type ConfirmType = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
    type?: ConfirmType;
    icon?: string;
    title: string;
    message: string;
    cancelText?: string;
    confirmText?: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Custom confirmation dialog component to replace native browser confirms
 * Provides a consistent, styled confirmation experience across the app
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    type = 'info',
    icon,
    title,
    message,
    cancelText = 'Cancel',
    confirmText = 'Confirm',
    isLoading = false,
    onConfirm,
    onCancel
}) => {
    const config = {
        danger: {
            defaultIcon: '⛔',
            confirmButtonClass: styles.confirmButtonDanger
        },
        warning: {
            defaultIcon: '⚠️',
            confirmButtonClass: styles.confirmButtonWarning
        },
        info: {
            defaultIcon: 'ℹ️',
            confirmButtonClass: styles.confirmButtonInfo
        }
    };

    const { defaultIcon, confirmButtonClass } = config[type];
    const displayIcon = icon || defaultIcon;

    return (
        <div className={styles.dialogOverlay} onClick={onCancel}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.dialogIcon}>{displayIcon}</div>
                <h2 className={styles.dialogTitle}>{title}</h2>
                <p className={styles.dialogMessage}>{message}</p>
                <div className={styles.dialogActions}>
                    <button
                        className={styles.cancelButton}
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        className={`${styles.confirmButton} ${confirmButtonClass}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading && <span className={styles.spinner} />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

