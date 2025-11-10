import React from 'react';
import styles from '../UploadBook.module.css';

interface UploadFormProps {
    uploadMode: 'file' | 'url';
    file: File | null;
    pdfUrl: string;
    error: string | null;
    isUploading: boolean;
    isValid: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onModeToggle: (mode: 'file' | 'url') => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUrlChange: (url: string) => void;
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
    fileInputRef,
    onModeToggle,
    onFileSelect,
    onUrlChange,
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

