import React from 'react';
import { UploadCard } from './UploadCard';
import type { UploadItem } from '../hooks/useUploadManager';
import styles from '../UploadBook.module.css';

interface UploadListProps {
    uploads: UploadItem[];
    selectedId: string | null;
    loadingActions: Record<string, boolean>;
    onSelectUpload: (uploadId: string) => void;
    onViewValidationErrors: (uploadId: string) => void;
    onFinalizeUpload: (uploadId: string) => void;
    onDeleteUpload: (uploadId: string) => void;
    onRestartUpload: (uploadId: string) => void;
    onStopParsing: (uploadId: string) => void;
}

/**
 * List container component for upload cards
 */
export const UploadList: React.FC<UploadListProps> = ({
    uploads,
    selectedId,
    loadingActions,
    onSelectUpload,
    onViewValidationErrors,
    onFinalizeUpload,
    onDeleteUpload,
    onRestartUpload,
    onStopParsing
}) => {
    return (
        <div className={styles.uploadsList}>
            {uploads.map((upload) => (
                <UploadCard
                    key={upload.uploadId}
                    upload={upload}
                    isSelected={selectedId === upload.uploadId}
                    isLoading={loadingActions[upload.uploadId] || false}
                    onSelectUpload={onSelectUpload}
                    onViewValidationErrors={onViewValidationErrors}
                    onFinalizeUpload={onFinalizeUpload}
                    onDeleteUpload={onDeleteUpload}
                    onRestartUpload={onRestartUpload}
                    onStopParsing={onStopParsing}
                />
            ))}
        </div>
    );
};

