import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listS3Files, listVercelFiles, deleteS3File, deleteVercelFile } from '../../../apis/fileStorage/client';
import type { StorageFile } from '../../../apis/fileStorage/types';
import { AlertDialog, ConfirmDialog } from '../../components/dialogs';
import styles from './FileStorage.module.css';

type StorageType = 's3' | 'vercel';
type SortBy = 'name' | 'size' | 'type' | 'date';
type SortOrder = 'asc' | 'desc';

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
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showResultAlert, setShowResultAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState<'success' | 'error'>('success');

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

    const handleDeleteSelected = () => {
        if (selectedFiles.size === 0) return;
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        setShowDeleteConfirm(false);
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

            // Show result
            if (errorCount === 0) {
                setAlertType('success');
                setAlertMessage(`Successfully deleted ${successCount} file(s)`);
            } else {
                setAlertType('error');
                setAlertMessage(`Deleted ${successCount} file(s), ${errorCount} failed`);
            }
            setShowResultAlert(true);
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
        const allItems = [...folders, ...regularFiles];
        if (selectedFiles.size === allItems.length) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(allItems.map(f => f.key)));
        }
    };

    const handleSortChange = (newSortBy: SortBy) => {
        if (sortBy === newSortBy) {
            // Toggle order if clicking same sort
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // New sort field, default to ascending
            setSortBy(newSortBy);
            setSortOrder('asc');
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

    // Filter and sort files, separated into folders and files
    const { folders, regularFiles } = React.useMemo(() => {
        // First filter by search query
        const filtered = files.filter(file => 
            file.key.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Separate into folders and files
        const foldersArray: StorageFile[] = [];
        const filesArray: StorageFile[] = [];

        for (const item of filtered) {
            if (item.isFolder) {
                foldersArray.push(item);
            } else {
                filesArray.push(item);
            }
        }

        // Sort function
        const sortItems = (items: StorageFile[]) => {
            items.sort((a, b) => {
                let comparison = 0;

                switch (sortBy) {
                    case 'name':
                        const aName = a.key.split('/').filter(p => p).pop() || a.key;
                        const bName = b.key.split('/').filter(p => p).pop() || b.key;
                        comparison = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
                        break;
                    
                    case 'size':
                        comparison = a.size - b.size;
                        break;
                    
                    case 'type':
                        // For files, sort by extension
                        if (!a.isFolder && !b.isFolder) {
                            const aExt = a.key.split('.').pop() || '';
                            const bExt = b.key.split('.').pop() || '';
                            comparison = aExt.localeCompare(bExt);
                        }
                        break;
                    
                    case 'date':
                        comparison = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime();
                        break;
                }

                return sortOrder === 'asc' ? comparison : -comparison;
            });
        };

        // Sort both arrays
        sortItems(foldersArray);
        sortItems(filesArray);

        return { folders: foldersArray, regularFiles: filesArray };
    }, [files, searchQuery, sortBy, sortOrder]);

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

            {/* Search and Sort Bar */}
            <div className={styles.searchSortContainer}>
                <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
                
                <div className={styles.sortControls}>
                    <span className={styles.sortLabel}>Sort by:</span>
                    <button
                        onClick={() => handleSortChange('name')}
                        className={`${styles.sortButton} ${sortBy === 'name' ? styles.sortButtonActive : ''}`}
                    >
                        Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                        onClick={() => handleSortChange('size')}
                        className={`${styles.sortButton} ${sortBy === 'size' ? styles.sortButtonActive : ''}`}
                    >
                        Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                        onClick={() => handleSortChange('type')}
                        className={`${styles.sortButton} ${sortBy === 'type' ? styles.sortButtonActive : ''}`}
                    >
                        Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                        onClick={() => handleSortChange('date')}
                        className={`${styles.sortButton} ${sortBy === 'date' ? styles.sortButtonActive : ''}`}
                    >
                        Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                </div>
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
                            checked={selectedFiles.size === (folders.length + regularFiles.length) && (folders.length + regularFiles.length) > 0}
                            onChange={handleSelectAll}
                            className={styles.checkbox}
                        />
                        <span className={styles.headerText}>
                            {folders.length + regularFiles.length} item(s)
                        </span>
                    </div>

                    {/* Empty State */}
                    {folders.length === 0 && regularFiles.length === 0 && (
                        <div className={styles.emptyState}>
                            <p>No files found</p>
                        </div>
                    )}

                    {/* Folders Section */}
                    {folders.length > 0 && (
                        <>
                            <div className={styles.groupHeader}>
                                <span className={styles.groupIcon}>📁</span>
                                <span className={styles.groupTitle}>Folders</span>
                                <span className={styles.groupCount}>({folders.length})</span>
                            </div>
                            {folders.map((folder) => (
                                <div
                                    key={folder.key}
                                    className={`${styles.fileItem} ${selectedFiles.has(folder.key) ? styles.fileItemSelected : ''}`}
                                    onClick={() => handleFolderClick(folder.key)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedFiles.has(folder.key)}
                                        onChange={() => handleToggleFile(folder.key)}
                                        onClick={(e) => e.stopPropagation()}
                                        className={styles.checkbox}
                                    />
                                    <div className={styles.fileInfo}>
                                        <div className={styles.fileName}>
                                            📁 {folder.key.split('/').filter(p => p).pop() || folder.key}
                                        </div>
                                        <div className={styles.fileDetails}>
                                            <span>{formatSize(folder.size)}</span>
                                            <span className={styles.separator}>•</span>
                                            <span>{formatDate(folder.lastModified)}</span>
                                            {folder.fileCount !== undefined && (
                                                <>
                                                    <span className={styles.separator}>•</span>
                                                    <span>{folder.fileCount} files</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.folderArrow}>›</div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Files Section */}
                    {regularFiles.length > 0 && (
                        <>
                            <div className={styles.groupHeader}>
                                <span className={styles.groupIcon}>📄</span>
                                <span className={styles.groupTitle}>Files</span>
                                <span className={styles.groupCount}>({regularFiles.length})</span>
                            </div>
                            {regularFiles.map((file) => (
                                <div
                                    key={file.key}
                                    className={`${styles.fileItem} ${selectedFiles.has(file.key) ? styles.fileItemSelected : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedFiles.has(file.key)}
                                        onChange={() => handleToggleFile(file.key)}
                                        className={styles.checkbox}
                                    />
                                    <div className={styles.fileInfo}>
                                        <div className={styles.fileName}>
                                            📄 {file.key.split('/').filter(p => p).pop() || file.key}
                                        </div>
                                        <div className={styles.fileDetails}>
                                            <span>{formatSize(file.size)}</span>
                                            <span className={styles.separator}>•</span>
                                            <span>{formatDate(file.lastModified)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <ConfirmDialog
                    type="danger"
                    icon="🗑️"
                    title="Delete Files?"
                    message={`Are you sure you want to delete ${selectedFiles.size} selected file(s)? This action cannot be undone.`}
                    cancelText="Cancel"
                    confirmText="Delete"
                    isLoading={deleting}
                    onConfirm={confirmDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}

            {/* Result Alert Dialog */}
            {showResultAlert && (
                <AlertDialog
                    type={alertType}
                    message={alertMessage}
                    onClose={() => setShowResultAlert(false)}
                />
            )}
        </div>
    );
};

