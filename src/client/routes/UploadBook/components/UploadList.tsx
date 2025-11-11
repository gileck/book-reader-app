import React from 'react';
import { UploadCard } from './UploadCard';
import type { UploadItem } from '../hooks/useUploadManager';
import styles from '../styles';

interface UploadListProps {
    uploads: UploadItem[];
    selectedId: string | null;
    loadingActions: Record<string, boolean>;
    loadingPreviewFor: string | null;
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
    loadingPreviewFor,
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
                    isLoadingPreview={loadingPreviewFor === upload.uploadId}
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

