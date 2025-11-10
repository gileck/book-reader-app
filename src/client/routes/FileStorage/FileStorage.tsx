import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listS3Files, listVercelFiles, deleteS3File, deleteVercelFile } from '../../../apis/fileStorage/client';
import type { StorageFile } from '../../../apis/fileStorage/types';
import styles from './FileStorage.module.css';

type StorageType = 's3' | 'vercel';

/**
 * File Storage Management Page
 * Displays and manages files from S3 and Vercel Blob storage
 */
export const FileStorage = () => {
    const { user } = useAuth();
    const [storageType, setStorageType] = useState<StorageType>('s3');
    const [files, setFiles] = useState<StorageFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalFiles, setTotalFiles] = useState(0);
    const [totalSize, setTotalSize] = useState(0);
    const [totalFolders, setTotalFolders] = useState(0);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPrefix, setCurrentPrefix] = useState<string>('');

    // Load files when storage type or prefix changes
    useEffect(() => {
        loadFiles();
    }, [storageType, currentPrefix]);

    // Reset prefix when switching storage types
    useEffect(() => {
        setCurrentPrefix('');
    }, [storageType]);

    const loadFiles = async () => {
        setLoading(true);
        setError(null);
        setSelectedFiles(new Set());

        try {
            if (storageType === 's3') {
                const result = await listS3Files({ prefix: currentPrefix });
                if (result.data) {
                    setFiles(result.data.files);
                    setTotalFiles(result.data.stats.totalFiles);
                    setTotalSize(result.data.stats.totalSize);
                    setTotalFolders(result.data.stats.totalFolders);
                }
            } else {
                const result = await listVercelFiles({ prefix: currentPrefix });
                if (result.data) {
                    setFiles(result.data.files);
                    setTotalFiles(result.data.stats.totalFiles);
                    setTotalSize(result.data.stats.totalSize);
                    setTotalFolders(result.data.stats.totalFolders);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedFiles.size === 0) return;
        
        if (!confirm(`Delete ${selectedFiles.size} selected file(s)?`)) {
            return;
        }

        setDeleting(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            for (const fileKey of Array.from(selectedFiles)) {
                try {
                    if (storageType === 's3') {
                        await deleteS3File({ key: fileKey });
                    } else {
                        const file = files.find(f => f.key === fileKey);
                        if (file?.url) {
                            await deleteVercelFile({ url: file.url });
                        }
                    }
                    successCount++;
                } catch (err) {
                    console.error(`Failed to delete ${fileKey}:`, err);
                    errorCount++;
                }
            }

            // Reload files after deletion
            await loadFiles();

            if (errorCount === 0) {
                alert(`Successfully deleted ${successCount} file(s)`);
            } else {
                alert(`Deleted ${successCount} file(s), ${errorCount} failed`);
            }
        } finally {
            setDeleting(false);
        }
    };

    const handleToggleFile = (key: string) => {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedFiles(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedFiles.size === filteredFiles.length) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(filteredFiles.map(f => f.key)));
        }
    };

    const handleFolderClick = (folderKey: string) => {
        setCurrentPrefix(folderKey);
        setSearchQuery(''); // Clear search when navigating
    };

    const handleBreadcrumbClick = (index: number) => {
        const parts = currentPrefix.split('/').filter(p => p);
        const newPrefix = parts.slice(0, index + 1).join('/') + (index >= 0 ? '/' : '');
        setCurrentPrefix(newPrefix);
        setSearchQuery(''); // Clear search when navigating
    };

    const getBreadcrumbs = () => {
        if (!currentPrefix) return [];
        return currentPrefix.split('/').filter(p => p);
    };

    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const formatDate = (date: Date): string => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Filter files based on search query
    const filteredFiles = files.filter(file => 
        file.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!user) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <p>Please log in to view file storage</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>File Storage</h1>
                <button onClick={loadFiles} className={styles.refreshButton} disabled={loading}>
                    {loading ? '↻' : '⟳'}
                </button>
            </div>

            {/* Storage Type Selector */}
            <div className={styles.segmentedControl}>
                <button
                    className={`${styles.segmentButton} ${storageType === 's3' ? styles.segmentButtonActive : ''}`}
                    onClick={() => setStorageType('s3')}
                >
                    S3 Storage
                </button>
                <button
                    className={`${styles.segmentButton} ${storageType === 'vercel' ? styles.segmentButtonActive : ''}`}
                    onClick={() => setStorageType('vercel')}
                >
                    Vercel Blob
                </button>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statValue}>{totalFiles.toLocaleString()}</div>
                    <div className={styles.statLabel}>Total Files</div>
                </div>
                {totalFolders > 0 && (
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{totalFolders.toLocaleString()}</div>
                        <div className={styles.statLabel}>Folders</div>
                    </div>
                )}
                <div className={styles.statCard}>
                    <div className={styles.statValue}>{formatSize(totalSize)}</div>
                    <div className={styles.statLabel}>Total Size</div>
                </div>
            </div>

            {/* Breadcrumb Navigation */}
            {currentPrefix && (
                <div className={styles.breadcrumbContainer}>
                    <button 
                        onClick={() => setCurrentPrefix('')}
                        className={styles.breadcrumbButton}
                    >
                        🏠 Root
                    </button>
                    {getBreadcrumbs().map((part, index) => (
                        <React.Fragment key={index}>
                            <span className={styles.breadcrumbSeparator}>›</span>
                            <button
                                onClick={() => handleBreadcrumbClick(index)}
                                className={styles.breadcrumbButton}
                            >
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Search Bar */}
            <div className={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {/* Selection Actions */}
            {selectedFiles.size > 0 && (
                <div className={styles.selectionActions}>
                    <span className={styles.selectionCount}>
                        {selectedFiles.size} selected
                    </span>
                    <button
                        onClick={handleDeleteSelected}
                        disabled={deleting}
                        className={styles.deleteButton}
                    >
                        {deleting ? 'Deleting...' : 'Delete Selected'}
                    </button>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className={styles.errorBanner}>
                    <span>⚠️ {error}</span>
                    <button onClick={loadFiles} className={styles.retryButton}>
                        Retry
                    </button>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className={styles.loadingState}>
                    <div className={styles.spinner}></div>
                    <p>Loading files...</p>
                </div>
            )}

            {/* Files List */}
            {!loading && !error && (
                <div className={styles.fileList}>
                    {/* List Header */}
                    <div className={styles.listHeader}>
                        <input
                            type="checkbox"
                            checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                            onChange={handleSelectAll}
                            className={styles.checkbox}
                        />
                        <span className={styles.headerText}>
                            {filteredFiles.length} file(s)
                        </span>
                    </div>

                    {/* Empty State */}
                    {filteredFiles.length === 0 && (
                        <div className={styles.emptyState}>
                            <p>No files found</p>
                        </div>
                    )}

                    {/* File Items */}
                    {filteredFiles.map((file) => (
                        <div
                            key={file.key}
                            className={`${styles.fileItem} ${selectedFiles.has(file.key) ? styles.fileItemSelected : ''}`}
                            onClick={() => file.isFolder && handleFolderClick(file.key)}
                            style={{ cursor: file.isFolder ? 'pointer' : 'default' }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedFiles.has(file.key)}
                                onChange={() => handleToggleFile(file.key)}
                                onClick={(e) => e.stopPropagation()}
                                className={styles.checkbox}
                            />
                            <div className={styles.fileInfo}>
                                <div className={styles.fileName}>
                                    {file.isFolder ? '📁' : '📄'} {file.key.split('/').filter(p => p).pop() || file.key}
                                </div>
                                <div className={styles.fileDetails}>
                                    <span>{formatSize(file.size)}</span>
                                    <span className={styles.separator}>•</span>
                                    <span>{formatDate(file.lastModified)}</span>
                                    {file.isFolder && file.fileCount !== undefined && (
                                        <>
                                            <span className={styles.separator}>•</span>
                                            <span>{file.fileCount} files</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            {file.isFolder && (
                                <div className={styles.folderArrow}>›</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

