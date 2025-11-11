import React from 'react';
import styles from '../UploadBook.module.css';

interface ValidationError {
    message: string;
    step: string;
}

interface ValidationErrorDialogProps {
    errors: ValidationError[];
    onApprove: () => void;
    onCancel: () => void;
    isFailed?: boolean; // New prop to indicate if this is a failed upload
    isLoading?: boolean; // Loading state for approve action
    isSummary?: boolean; // Is this a summary of all accumulated errors?
}

export const ValidationErrorDialog: React.FC<ValidationErrorDialogProps> = ({
    errors,
    onApprove,
    onCancel,
    isFailed = false,
    isLoading = false,
    isSummary = false
}) => {
    return (
        <div className={styles.dialogOverlay}>
            <div className={styles.dialog}>
                <div className={styles.dialogHeader}>
                    <div className={styles.warningIcon}>{isFailed ? '❌' : '⚠️'}</div>
                    <h2 className={styles.dialogTitle}>
                        {isFailed ? 'Parser Failed' : isSummary ? 'All Validation Errors' : 'Validation Issues Found'}
                    </h2>
                    <p className={styles.dialogSubtitle}>
                        {errors.length} {errors.length === 1 ? 'issue' : 'issues'} {isSummary ? 'found across all parsing steps' : 'detected during parsing'}
                    </p>
                </div>
                
                <p className={styles.dialogText}>
                    {isFailed 
                        ? 'The parser encountered errors and could not complete. Review the details below.'
                        : isSummary
                        ? 'The parser completed successfully but found these validation issues across all steps. These are typically minor formatting inconsistencies that won\'t affect your reading experience. Review and approve to continue.'
                        : 'These are typically minor formatting inconsistencies that won\'t affect your reading experience. Review the details below and choose to continue or cancel.'
                    }
                </p>
                
                <div className={styles.errorList}>
                    {errors.slice(0, 10).map((error, index) => (
                        <div key={index} className={styles.errorItem}>
                            <div className={styles.errorHeader}>
                                <span className={styles.errorBadge}>{error.step}</span>
                                <span className={styles.errorNumber}>#{index + 1}</span>
                            </div>
                            <p className={styles.errorItemMessage}>{error.message}</p>
                        </div>
                    ))}
                    {errors.length > 10 && (
                        <div className={styles.moreErrorsCard}>
                            <p className={styles.moreErrors}>
                                + {errors.length - 10} more {errors.length - 10 === 1 ? 'issue' : 'issues'}
                            </p>
                        </div>
                    )}
                </div>
                
                <div className={styles.dialogActions}>
                    {isFailed ? (
                        // For failed uploads, only show a close button
                        <button className={styles.approveButton} onClick={onCancel}>
                            Close
                        </button>
                    ) : (
                        // For awaiting-approval, show cancel and approve buttons
                        <>
                            <button 
                                className={styles.cancelButton} 
                                onClick={onCancel}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button 
                                className={styles.approveButton} 
                                onClick={onApprove}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className={styles.buttonSpinner} />
                                        Approving...
                                    </>
                                ) : (
                                    'Approve & Continue'
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

