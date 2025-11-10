import React from 'react';
import styles from '../UploadBook.module.css';

interface ParserProgressProps {
    progress: number;
    currentStep: string;
    totalSteps?: number;
    status?: 'uploading' | 'parsing';
}

const getStepName = (step: string): string => {
    const stepNames: Record<string, string> = {
        'step-1': 'Text Extraction',
        'step-2-1': 'Chapter Detection',
        'step-2-2': 'Chapter Content Extraction',
        'step-2-3': 'Chapter Name Cleaning',
        'step-3': 'Page Extraction',
        'step-3-1': 'Link Detection',
        'step-3-2': 'Image Extraction',
        'step-4': 'Paragraph Detection',
        'step-5': 'Sentence Detection',
        'step-5-1': 'Image Markers to Chunks',
        'step-5-2': 'Link Chunk References',
        'step-6': 'Metadata Extraction'
    };
    return stepNames[step] || step;
};

export const ParserProgress: React.FC<ParserProgressProps> = ({
    progress,
    currentStep
}) => {
    return (
        <div className={styles.compactProgressSection}>
            {currentStep && (
                <p className={styles.compactStepLabel}>
                    {getStepName(currentStep)}
                </p>
            )}
            
            <div className={styles.progressBar}>
                <div 
                    className={styles.progressFill} 
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            <p className={styles.compactProgressText}>
                {Math.round(progress)}% complete
            </p>
        </div>
    );
};

