import React from 'react';
import styles from '../styles';

interface UploadFormProps {
    uploadMode: 'file' | 'url';
    file: File | null;
    pdfUrl: string;
    error: string | null;
    isUploading: boolean;
    isValid: boolean;
    continueOnValidationError: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onModeToggle: (mode: 'file' | 'url') => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUrlChange: (url: string) => void;
    onContinueOnErrorToggle: (enabled: boolean) => void;
    onSubmit: () => void;
    onClose: () => void;
}

/**
 * Upload form component for file or URL upload
 * Handles mode toggle, file selection, and form submission
 */
export const UploadForm: React.FC<UploadFormProps> = ({
    uploadMode,
    file,
    pdfUrl,
    error,
    isUploading,
    isValid,
    continueOnValidationError,
    fileInputRef,
    onModeToggle,
    onFileSelect,
    onUrlChange,
    onContinueOnErrorToggle,
    onSubmit,
    onClose
}) => {
    return (
        <div className={styles.uploadForm}>
            <div className={styles.formHeader}>
                <h2>Upload New Book</h2>
                <button
                    className={styles.closeButton}
                    onClick={onClose}
                >
                    ✕
                </button>
            </div>

            <div className={styles.formBody}>
                <div className={styles.modeToggle}>
                    <button
                        className={`${styles.modeButton} ${uploadMode === 'file' ? styles.active : ''}`}
                        onClick={() => onModeToggle('file')}
                    >
                        📄 Upload File
                    </button>
                    <button
                        className={`${styles.modeButton} ${uploadMode === 'url' ? styles.active : ''}`}
                        onClick={() => onModeToggle('url')}
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
                            onChange={onFileSelect}
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
                            onChange={(e) => onUrlChange(e.target.value)}
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

                <div className={styles.checkboxSection}>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={continueOnValidationError}
                            onChange={(e) => onContinueOnErrorToggle(e.target.checked)}
                            className={styles.checkbox}
                        />
                        <span className={styles.checkboxText}>
                            Continue on validation errors
                        </span>
                    </label>
                    <p className={styles.checkboxDescription}>
                        Don&apos;t stop parsing when validation errors occur. All errors will be shown at the end.
                    </p>
                </div>

                <button
                    className={styles.uploadButton}
                    onClick={onSubmit}
                    disabled={isUploading || !isValid}
                >
                    {isUploading ? '⏳ UPLOADING...' : 'START UPLOAD'}
                </button>
            </div>
        </div>
    );
};

