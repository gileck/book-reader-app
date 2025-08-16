import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from '../../router';
import { getBooks, deleteBook, updateBook, uploadCoverImage } from '../../../apis/books/client';
import { getReadingProgress } from '../../../apis/readingProgress/client';
import { BookClient } from '../../../apis/books/types';
import { ReadingProgressClient } from '../../../apis/readingProgress/types';
import styles from './BookLibrary.module.css';
import { IMAGES_BASE_PATH } from '@/common/constants';
import { Dialog, DialogTitle, DialogContent, Button, IconButton, Box, TextField } from '@mui/material';
import { Close as CloseIcon, PlayArrow, Delete, Edit, Upload, Image } from '@mui/icons-material';
import { useSettings } from '../../settings/SettingsContext';
import { useAuth } from '../../context/AuthContext';

interface BookWithProgress extends BookClient {
    progress?: ReadingProgressClient;
    isActive?: boolean;
}


export const BookLibrary = () => {
    const { navigate } = useRouter();
    const { settings, updateSettings } = useSettings();
    const { user, isAuthenticated, isInitialLoading } = useAuth();
    const [books, setBooks] = useState<BookWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [progressLoading, setProgressLoading] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showOptionsMenu, setShowOptionsMenu] = useState<string | null>(null);
    const [showEditDialog, setShowEditDialog] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', author: '', coverImage: '', imageBaseURL: '', chapterStartNumber: 1 });
    const [deletingBook, setDeletingBook] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [savingBook, setSavingBook] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadBooksWithProgress = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Phase 1: Load and display books immediately
            const booksResult = await getBooks({});
            if (!booksResult.data) {
                throw new Error('Failed to load books');
            }

            const storedActiveBookId = localStorage.getItem('activeBookId');

            // Display books immediately without progress
            const booksWithoutProgress: BookWithProgress[] = booksResult.data.books.map(book => ({
                ...book,
                isActive: book._id === storedActiveBookId
            }));

            setBooks(booksWithoutProgress);
            setLoading(false);

            // Phase 2: Load reading progress for all books in parallel
            const bookIds = booksResult.data.books.map(book => book._id);
            setProgressLoading(new Set(bookIds));

            // Load progress for all books in parallel
            const progressPromises = booksResult.data.books.map(async (book) => {
                try {
                    if (!user?.id) {
                        console.warn('User not available for progress loading');
                        return;
                    }

                    const progressResult = await getReadingProgress({
                        userId: user.id,
                        bookId: book._id
                    });

                    // Update this specific book's progress
                    setBooks(prevBooks =>
                        prevBooks.map(prevBook =>
                            prevBook._id === book._id
                                ? { ...prevBook, progress: progressResult.data?.readingProgress || undefined }
                                : prevBook
                        )
                    );

                    // Remove from loading set
                    setProgressLoading(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(book._id);
                        return newSet;
                    });

                } catch (error) {
                    console.warn(`Failed to load progress for book ${book._id}:`, error);

                    // Remove from loading set even on error
                    setProgressLoading(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(book._id);
                        return newSet;
                    });
                }
            });

            // Wait for all progress calls to complete (optional, for cleanup)
            await Promise.all(progressPromises);

        } catch (error) {
            console.error('Error loading books:', error);
            setError(error instanceof Error ? error.message : 'Failed to load books');
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (isAuthenticated && user) {
            loadBooksWithProgress();
        }
    }, [isAuthenticated, user, loadBooksWithProgress]);

    const handleOpenBook = (bookId: string) => {
        navigate(`/?bookId=${bookId}`);
    };

    const handleSetActiveBook = (bookId: string) => {
        localStorage.setItem('activeBookId', bookId);
        setBooks(books.map(book => ({
            ...book,
            isActive: book._id === bookId
        })));
    };

    const handleRemoveBook = (bookId: string) => {
        setShowDeleteConfirm(bookId);
    };

    const confirmRemoveBook = async (bookId: string) => {
        try {
            setDeletingBook(bookId);
            setError(null);

            // Call the API to delete the book and all associated data
            const result = await deleteBook({ bookId });

            if (result.data?.success) {
                // Remove from local state only if API call succeeded
                setBooks(books.filter(book => book._id !== bookId));

                // If the removed book was active, clear active book
                const activeBookId = localStorage.getItem('activeBookId');
                if (activeBookId === bookId) {
                    localStorage.removeItem('activeBookId');
                }
            } else {
                throw new Error('Failed to delete book');
            }
        } catch (error) {
            console.error('Error removing book:', error);
            setError(error instanceof Error ? error.message : 'Failed to remove book');
        } finally {
            setDeletingBook(null);
            setShowDeleteConfirm(null);
        }
    };

    const closeOptionsMenu = () => {
        setShowOptionsMenu(null);
    };

    const handleEditBook = (bookId: string) => {
        const book = books.find(b => b._id === bookId);
        if (book) {
            setEditForm({
                title: book.title,
                author: book.author || '',
                coverImage: book.coverImage || '',
                imageBaseURL: book.imageBaseURL || '',
                chapterStartNumber: book.chapterStartNumber ?? 1
            });
            setShowEditDialog(bookId);
        }
    };

    const closeEditDialog = () => {
        setShowEditDialog(null);
        setEditForm({ title: '', author: '', coverImage: '', imageBaseURL: '', chapterStartNumber: 1 });
        setSaveSuccess(false);
        setSaveError(null);
    };

    const saveBookEdit = async () => {
        if (!showEditDialog) return;

        try {
            setSavingBook(true);
            setSaveError(null);
            setSaveSuccess(false);

            const result = await updateBook(showEditDialog, {
                title: editForm.title,
                author: editForm.author,
                coverImage: editForm.coverImage,
                imageBaseURL: editForm.imageBaseURL,
                chapterStartNumber: editForm.chapterStartNumber
            });

            if (result.data) {
                // Update only the specific book in local state
                setBooks(books.map(book =>
                    book._id === showEditDialog
                        ? { ...book, ...result.data }
                        : book
                ));
                setSaveSuccess(true);

                // Close dialog after showing success message briefly
                setTimeout(() => {
                    closeEditDialog();
                }, 1500);
            } else {
                setSaveError('Failed to update book - no data returned');
            }
        } catch (error) {
            console.error('Error updating book:', error);
            setSaveError(error instanceof Error ? error.message : 'Failed to update book');
        } finally {
            setSavingBook(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && showEditDialog) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const imageData = e.target?.result as string;
                await uploadImageData(imageData);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePasteImage = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                            const imageData = e.target?.result as string;
                            await uploadImageData(imageData);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
            alert('No image found in clipboard');
        } catch (error) {
            console.error('Error accessing clipboard:', error);
            alert('Failed to paste image from clipboard');
        }
    };

    const uploadImageData = async (imageData: string) => {
        if (!showEditDialog) return;

        try {
            setUploadingImage(true);
            const result = await uploadCoverImage(showEditDialog, { imageData });

            if (result.data?.success) {
                setEditForm(prev => ({ ...prev, coverImage: result.data!.coverImageUrl }));
            } else {
                console.error('Failed to upload image');
                alert('Failed to upload image');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image');
        } finally {
            setUploadingImage(false);
        }
    };

    const uploadImageFromUrl = async () => {
        if (!showEditDialog || !editForm.coverImage) return;

        try {
            setUploadingImage(true);
            const result = await uploadCoverImage(showEditDialog, { imageUrl: editForm.coverImage });

            if (result.data?.success) {
                setEditForm(prev => ({ ...prev, coverImage: result.data!.coverImageUrl }));
            } else {
                console.error('Failed to upload image from URL');
                alert('Failed to upload image from URL');
            }
        } catch (error) {
            console.error('Error uploading image from URL:', error);
            alert('Failed to upload image from URL');
        } finally {
            setUploadingImage(false);
        }
    };

    const getProgressPercentage = (progress?: ReadingProgressClient): number => {
        return progress?.bookProgress || 0;
    };

    const getReadingStatus = (progress?: ReadingProgressClient): string => {
        if (!progress) return 'Not Started';
        if (progress.bookProgress >= 100) return 'Completed';
        if (progress.bookProgress > 0) return 'Reading';
        return 'Not Started';
    };

    const sortedBooks = [...books].sort((a, b) => {
        switch (settings.librarySortBy) {
            case 'progress':
                return getProgressPercentage(b.progress) - getProgressPercentage(a.progress);
            case 'lastRead':
                if (!a.progress && !b.progress) return 0;
                if (!a.progress) return 1;
                if (!b.progress) return -1;
                return new Date(b.progress.lastReadAt).getTime() - new Date(a.progress.lastReadAt).getTime();
            default:
                return a.title.localeCompare(b.title);
        }
    });

    const formatDateDDMMYYYY = (dateInput: string | Date): string => {
        const date = new Date(dateInput);
        if (Number.isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const timeAgo = (dateInput: string | Date): string => {
        const date = new Date(dateInput);
        if (Number.isNaN(date.getTime())) return '';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours < 24) {
            const hours = Math.max(1, diffHours);
            return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        }
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) {
            return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
        }
        const diffMonths = Math.floor(diffDays / 30);
        if (diffMonths < 12) {
            return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
        }
        const diffYears = Math.floor(diffDays / 365);
        return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
    };

    // Handle authentication states
    if (isInitialLoading) {
        return (
            <div className={styles.bookLibrary}>
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return (
            <div className={styles.bookLibrary}>
                <div className={styles.errorContainer}>
                    <h2>Authentication Required</h2>
                    <p>Please log in to view your book library.</p>
                    <button className={styles.btnPrimary} onClick={() => navigate('/login')}>
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={styles.bookLibrary}>
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p>Loading your library...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.bookLibrary}>
                <div className={styles.errorContainer}>
                    <h2>Error loading library</h2>
                    <p>{error}</p>
                    <button className={styles.btnPrimary} onClick={loadBooksWithProgress}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.bookLibrary}>
            <header className={styles.libraryHeader}>
                <div className={styles.libraryControls}>
                    <div className={styles.sortDropdown}>
                        <label htmlFor="sort-select" className="sr-only">Sort books</label>
                        <select
                            id="sort-select"
                            value={settings.librarySortBy}
                            onChange={(e) => updateSettings({ librarySortBy: e.target.value as 'title' | 'progress' | 'lastRead' })}
                            className={styles.sortSelect}
                        >
                            <option value="title">Sort by Title</option>
                            <option value="progress">Sort by Progress</option>
                            <option value="lastRead">Sort by Last Read</option>
                        </select>
                    </div>
                </div>
            </header>

            {/* All Books Grid */}
            <section className={styles.allBooks}>
                <h2>Your Books</h2>
                {books.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📚</div>
                        <h3>No books in your library</h3>
                        <p>Add some books to get started with your reading journey.</p>
                    </div>
                ) : (
                    <div className={styles.booksGrid}>
                        {sortedBooks.map((book) => (
                            <div key={book._id} className={`${styles.bookCard} ${book.isActive ? styles.bookCardActive : ''}`}>
                                <div className={styles.bookCardInner}>
                                    <div className={styles.bookCoverContainer}>
                                        {book.coverImage ? (
                                            <img
                                                src={
                                                    book.coverImage && book.coverImage.startsWith('http') ?
                                                        book.coverImage : `${IMAGES_BASE_PATH}/${book.coverImage.startsWith('/') ? book.coverImage.slice(1) : book.coverImage}`.replace(/\s+/g, '')
                                                }
                                                alt={`${book.title} cover`}
                                                className={styles.bookCover}
                                            />
                                        ) : (
                                            <div className={styles.bookCoverPlaceholder}>
                                                <span>📖</span>
                                            </div>
                                        )}

                                        {/* Progress indicator */}
                                        {book.progress && book.progress.bookProgress > 0 && (
                                            <div className={styles.progressIndicator}>
                                                <div
                                                    className={styles.progressBar}
                                                    style={{ width: `${book.progress.bookProgress}%` }}
                                                ></div>
                                            </div>
                                        )}

                                        {/* Progress loading indicator */}
                                        {progressLoading.has(book._id) && (
                                            <div className={styles.progressLoadingIndicator}>
                                                <div className={styles.progressSpinner}></div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.bookInfo}>
                                        <div className={styles.bookHeader}>
                                            <div className={styles.bookTitleSection}>
                                                <h3 className={styles.bookTitle}>{book.title}</h3>
                                                <p className={styles.bookAuthor}>{book.author || 'Unknown Author'}</p>
                                                <p className={styles.bookDateAdded}>
                                                    Added {formatDateDDMMYYYY(book.createdAt)}
                                                    {book.progress?.lastReadAt && (
                                                        <>
                                                            <br />
                                                            Last read {timeAgo(book.progress.lastReadAt)}
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                            <div className={styles.bookActions}>
                                                <button
                                                    className={`${styles.bookActionBtn} ${styles.play}`}
                                                    onClick={() => handleOpenBook(book._id)}
                                                    aria-label={book.progress ? 'Continue reading' : 'Start reading'}
                                                >
                                                    ▶
                                                </button>
                                                <button
                                                    className={`${styles.bookActionBtn} ${styles.menu}`}
                                                    onClick={() => setShowOptionsMenu(showOptionsMenu === book._id ? null : book._id)}
                                                    aria-label="Book options"
                                                >
                                                    ⋯
                                                </button>
                                            </div>
                                        </div>

                                        {book.progress && book.progress.bookProgress > 0 && (
                                            <div className={styles.progressSection}>
                                                <div className={styles.bookMeta}>
                                                    <span className={`${styles.statusBadge} ${styles[getReadingStatus(book.progress).toLowerCase().replace(' ', '-') as keyof typeof styles] || ''}`}>
                                                        {getReadingStatus(book.progress)}
                                                    </span>
                                                </div>

                                                <div className={styles.progressBar}>
                                                    <div
                                                        className={styles.progressFill}
                                                        style={{ width: `${book.progress.bookProgress}%` }}
                                                    ></div>
                                                </div>
                                                <div className={styles.progressDetails}>
                                                    <span>Chapter {book.progress.currentChapter || 1} of {book.totalChapters || 'N/A'}</span>
                                                    <span>{Math.round(book.progress.bookProgress)}% complete</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Show progress loading indicator if still loading */}
                                        {progressLoading.has(book._id) && !book.progress && (
                                            <div className={styles.progressSection}>
                                                <div className={styles.progressLoadingText}>
                                                    <span>Loading reading progress...</span>
                                                    <div className={styles.progressSpinner}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>


                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Options Menu Dialog */}
            <Dialog
                open={!!showOptionsMenu}
                onClose={closeOptionsMenu}
                sx={{
                    '& .MuiDialog-paper': {
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)'
                }}>
                    Book Options
                    <IconButton
                        onClick={closeOptionsMenu}
                        sx={{
                            color: 'var(--color-text-primary)',
                            backgroundColor: 'var(--color-background-secondary)',
                            '&:hover': {
                                backgroundColor: 'var(--color-border)',
                                transform: 'scale(1.05)'
                            }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ padding: 'var(--spacing-2xl)' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <Button
                            variant="contained"
                            startIcon={<PlayArrow />}
                            onClick={() => {
                                if (showOptionsMenu) {
                                    handleOpenBook(showOptionsMenu);
                                    closeOptionsMenu();
                                }
                            }}
                            sx={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'white',
                                fontSize: '18px',
                                fontWeight: 500,
                                padding: 'var(--spacing-lg)',
                                borderRadius: 'var(--border-radius-lg)',
                                minHeight: '60px',
                                boxShadow: 'var(--shadow-xs)',
                                '&:hover': {
                                    backgroundColor: 'var(--color-primary)',
                                    opacity: 0.9,
                                    transform: 'translateY(-2px)',
                                    boxShadow: 'var(--shadow-md)'
                                }
                            }}
                        >
                            {books.find(b => b._id === showOptionsMenu)?.progress ? 'Continue Reading' : 'Start Reading'}
                        </Button>

                        <Button
                            variant="outlined"
                            startIcon={<Edit />}
                            onClick={() => {
                                if (showOptionsMenu) {
                                    handleEditBook(showOptionsMenu);
                                    closeOptionsMenu();
                                }
                            }}
                            sx={{
                                backgroundColor: 'var(--color-background-secondary)',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border)',
                                fontSize: '18px',
                                fontWeight: 500,
                                padding: 'var(--spacing-lg)',
                                borderRadius: 'var(--border-radius-lg)',
                                minHeight: '60px',
                                boxShadow: 'var(--shadow-xs)',
                                '&:hover': {
                                    backgroundColor: 'var(--color-border)',
                                    borderColor: 'var(--color-border)',
                                    transform: 'translateY(-2px)',
                                    boxShadow: 'var(--shadow-md)'
                                }
                            }}
                        >
                            Edit Book
                        </Button>

                        {!books.find(b => b._id === showOptionsMenu)?.isActive && (
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    if (showOptionsMenu) {
                                        handleSetActiveBook(showOptionsMenu);
                                        closeOptionsMenu();
                                    }
                                }}
                                sx={{
                                    backgroundColor: 'var(--color-background-secondary)',
                                    color: 'var(--color-text-primary)',
                                    borderColor: 'var(--color-border)',
                                    fontSize: '18px',
                                    fontWeight: 500,
                                    padding: 'var(--spacing-lg)',
                                    borderRadius: 'var(--border-radius-lg)',
                                    minHeight: '60px',
                                    boxShadow: 'var(--shadow-xs)',
                                    '&:hover': {
                                        backgroundColor: 'var(--color-border)',
                                        borderColor: 'var(--color-border)',
                                        transform: 'translateY(-2px)',
                                        boxShadow: 'var(--shadow-md)'
                                    }
                                }}
                            >
                                Set as Active Book
                            </Button>
                        )}

                        <Button
                            variant="contained"
                            startIcon={<Delete />}
                            onClick={() => {
                                if (showOptionsMenu) {
                                    handleRemoveBook(showOptionsMenu);
                                    closeOptionsMenu();
                                }
                            }}
                            sx={{
                                backgroundColor: 'var(--color-error)',
                                color: 'white',
                                fontSize: '18px',
                                fontWeight: 500,
                                padding: 'var(--spacing-lg)',
                                borderRadius: 'var(--border-radius-lg)',
                                minHeight: '60px',
                                boxShadow: 'var(--shadow-xs)',
                                '&:hover': {
                                    backgroundColor: 'var(--color-error)',
                                    opacity: 0.9,
                                    transform: 'translateY(-2px)',
                                    boxShadow: 'var(--shadow-md)'
                                }
                            }}
                        >
                            Remove Book
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Edit Book Dialog */}
            <Dialog
                open={!!showEditDialog}
                onClose={closeEditDialog}
                maxWidth="sm"
                fullWidth
                sx={{
                    '& .MuiDialog-paper': {
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '20px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)'
                }}>
                    Edit Book
                    <IconButton
                        onClick={closeEditDialog}
                        sx={{
                            color: 'var(--color-text-primary)',
                            backgroundColor: 'var(--color-background-secondary)',
                            '&:hover': {
                                backgroundColor: 'var(--color-border)',
                                transform: 'scale(1.05)'
                            }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ padding: 'var(--spacing-xl)' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                        <TextField
                            label="Title"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            fullWidth
                            variant="outlined"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'var(--color-surface)',
                                    '& fieldset': {
                                        borderColor: 'var(--color-border)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'var(--color-primary)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'var(--color-primary)',
                                    },
                                },
                                '& .MuiInputLabel-root': {
                                    color: 'var(--color-text-secondary)',
                                },
                                '& .MuiOutlinedInput-input': {
                                    color: 'var(--color-text-primary)',
                                }
                            }}
                        />

                        <TextField
                            label="Author"
                            value={editForm.author}
                            onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                            fullWidth
                            variant="outlined"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'var(--color-surface)',
                                    '& fieldset': {
                                        borderColor: 'var(--color-border)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'var(--color-primary)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'var(--color-primary)',
                                    },
                                },
                                '& .MuiInputLabel-root': {
                                    color: 'var(--color-text-secondary)',
                                },
                                '& .MuiOutlinedInput-input': {
                                    color: 'var(--color-text-primary)',
                                }
                            }}
                        />

                        <TextField
                            label="Image Base URL"
                            value={editForm.imageBaseURL}
                            onChange={(e) => setEditForm({ ...editForm, imageBaseURL: e.target.value })}
                            fullWidth
                            variant="outlined"
                            helperText="Base URL for book images (used for relative image paths)"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'var(--color-surface)',
                                    '& fieldset': {
                                        borderColor: 'var(--color-border)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'var(--color-primary)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'var(--color-primary)',
                                    },
                                },
                                '& .MuiInputLabel-root': {
                                    color: 'var(--color-text-secondary)',
                                },
                                '& .MuiOutlinedInput-input': {
                                    color: 'var(--color-text-primary)',
                                },
                                '& .MuiFormHelperText-root': {
                                    color: 'var(--color-text-secondary)',
                                }
                            }}
                        />

                        <TextField
                            label="Chapter Start Number"
                            type="number"
                            value={editForm.chapterStartNumber}
                            onChange={(e) => setEditForm({ ...editForm, chapterStartNumber: isNaN(parseInt(e.target.value)) ? 1 : parseInt(e.target.value) })}
                            fullWidth
                            variant="outlined"
                            helperText="Set to 0 for books with Introduction chapters, 1 for regular books"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'var(--color-surface)',
                                    '& fieldset': {
                                        borderColor: 'var(--color-border)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'var(--color-primary)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'var(--color-primary)',
                                    },
                                },
                                '& .MuiInputLabel-root': {
                                    color: 'var(--color-text-secondary)',
                                },
                                '& .MuiOutlinedInput-input': {
                                    color: 'var(--color-text-primary)',
                                },
                                '& .MuiFormHelperText-root': {
                                    color: 'var(--color-text-secondary)',
                                }
                            }}
                        />

                        <Box>
                            <TextField
                                label="Cover Image URL"
                                value={editForm.coverImage}
                                onChange={(e) => setEditForm({ ...editForm, coverImage: e.target.value })}
                                fullWidth
                                variant="outlined"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        backgroundColor: 'var(--color-surface)',
                                        '& fieldset': {
                                            borderColor: 'var(--color-border)',
                                        },
                                        '&:hover fieldset': {
                                            borderColor: 'var(--color-primary)',
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: 'var(--color-primary)',
                                        },
                                    },
                                    '& .MuiInputLabel-root': {
                                        color: 'var(--color-text-secondary)',
                                    },
                                    '& .MuiOutlinedInput-input': {
                                        color: 'var(--color-text-primary)',
                                    }
                                }}
                            />

                            <Box sx={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<Upload />}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingImage}
                                    sx={{
                                        color: 'var(--color-text-primary)',
                                        borderColor: 'var(--color-border)',
                                        '&:hover': {
                                            backgroundColor: 'var(--color-background-secondary)',
                                            borderColor: 'var(--color-border)',
                                        }
                                    }}
                                >
                                    Upload File
                                </Button>

                                <Button
                                    variant="outlined"
                                    startIcon={<Image />} // eslint-disable-line jsx-a11y/alt-text
                                    onClick={handlePasteImage}
                                    disabled={uploadingImage}
                                    sx={{
                                        color: 'var(--color-text-primary)',
                                        borderColor: 'var(--color-border)',
                                        '&:hover': {
                                            backgroundColor: 'var(--color-background-secondary)',
                                            borderColor: 'var(--color-border)',
                                        }
                                    }}
                                >
                                    Paste Image
                                </Button>

                                {editForm.coverImage && (
                                    <Button
                                        variant="outlined"
                                        onClick={uploadImageFromUrl}
                                        disabled={uploadingImage}
                                        sx={{
                                            color: 'var(--color-text-primary)',
                                            borderColor: 'var(--color-border)',
                                            '&:hover': {
                                                backgroundColor: 'var(--color-background-secondary)',
                                                borderColor: 'var(--color-border)',
                                            }
                                        }}
                                    >
                                        Upload from URL
                                    </Button>
                                )}
                            </Box>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                        </Box>

                        {/* Success/Error Messages */}
                        {saveSuccess && (
                            <Box sx={{
                                padding: 'var(--spacing-md)',
                                backgroundColor: 'var(--color-success)',
                                color: 'white',
                                borderRadius: 'var(--border-radius-md)',
                                textAlign: 'center',
                                fontWeight: 500
                            }}>
                                ✓ Book updated successfully!
                            </Box>
                        )}

                        {saveError && (
                            <Box sx={{
                                padding: 'var(--spacing-md)',
                                backgroundColor: 'var(--color-error)',
                                color: 'white',
                                borderRadius: 'var(--border-radius-md)',
                                textAlign: 'center',
                                fontWeight: 500
                            }}>
                                ✗ {saveError}
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
                            <Button
                                variant="outlined"
                                onClick={closeEditDialog}
                                disabled={savingBook}
                                sx={{
                                    color: 'var(--color-text-primary)',
                                    borderColor: 'var(--color-border)',
                                    '&:hover': {
                                        backgroundColor: 'var(--color-background-secondary)',
                                        borderColor: 'var(--color-border)',
                                    }
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={saveBookEdit}
                                disabled={savingBook || saveSuccess}
                                sx={{
                                    backgroundColor: saveSuccess ? 'var(--color-success)' : 'var(--color-primary)',
                                    color: 'white',
                                    '&:hover': {
                                        backgroundColor: saveSuccess ? 'var(--color-success)' : 'var(--color-primary)',
                                        opacity: 0.9,
                                    }
                                }}
                            >
                                {savingBook ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
                            </Button>
                        </Box>
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className={styles.modalOverlay} onClick={() => {
                    setShowDeleteConfirm(null);
                    closeOptionsMenu();
                }}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3>Remove Book</h3>
                        <p>Are you sure you want to remove this book from your library? This action cannot be undone.</p>
                        <div className={styles.modalActions}>
                            <button
                                className={styles.btnSecondary}
                                onClick={() => {
                                    setShowDeleteConfirm(null);
                                    closeOptionsMenu();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.btnDanger}
                                onClick={() => confirmRemoveBook(showDeleteConfirm)}
                                disabled={deletingBook === showDeleteConfirm}
                            >
                                {deletingBook === showDeleteConfirm ? 'Removing...' : 'Remove Book'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}; 