import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from '../../router';
import { getBooks, deleteBook } from '../../../apis/books/client';
import { getReadingProgress } from '../../../apis/readingProgress/client';
import { BookClient } from '../../../apis/books/types';
import { ReadingProgressClient } from '../../../apis/readingProgress/types';
import styles from './BookLibrary.module.css';
import { IMAGES_BASE_PATH } from '@/common/constants';

interface BookWithProgress extends BookClient {
    progress?: ReadingProgressClient;
    isActive?: boolean;
}

const userId = '675e8c84f891e8b9da2b8c28'; // Hard-coded for now

export const BookLibrary = () => {
    const { navigate } = useRouter();
    const [books, setBooks] = useState<BookWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'title' | 'progress' | 'lastRead'>('title');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showOptionsMenu, setShowOptionsMenu] = useState<string | null>(null);
    const [deletingBook, setDeletingBook] = useState<string | null>(null);

    useEffect(() => {
        loadBooksWithProgress();
    }, []);

    const loadBooksWithProgress = async () => {
        try {
            setLoading(true);
            setError(null);

            const booksResult = await getBooks({});
            if (!booksResult.data) {
                throw new Error('Failed to load books');
            }

            const storedActiveBookId = localStorage.getItem('activeBookId');

            const booksWithProgress: BookWithProgress[] = await Promise.all(
                booksResult.data.books.map(async (book) => {
                    try {
                        const progressResult = await getReadingProgress({
                            userId,
                            bookId: book._id
                        });

                        return {
                            ...book,
                            progress: progressResult.data?.readingProgress || undefined,
                            isActive: book._id === storedActiveBookId
                        };
                    } catch (error) {
                        console.warn(`Failed to load progress for book ${book._id}:`, error);
                        return {
                            ...book,
                            isActive: book._id === storedActiveBookId
                        };
                    }
                })
            );

            setBooks(booksWithProgress);
        } catch (error) {
            console.error('Error loading books:', error);
            setError(error instanceof Error ? error.message : 'Failed to load books');
        } finally {
            setLoading(false);
        }
    };

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

    const toggleOptionsMenu = (bookId: string) => {
        setShowOptionsMenu(showOptionsMenu === bookId ? null : bookId);
    };

    const closeOptionsMenu = () => {
        setShowOptionsMenu(null);
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
        switch (sortBy) {
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
                <h1>My Library</h1>
                <div className={styles.libraryControls}>
                    <div className={styles.sortDropdown}>
                        <label htmlFor="sort-select" className="sr-only">Sort books</label>
                        <select
                            id="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'title' | 'progress' | 'lastRead')}
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
                                                    book.coverImage
                                                        ? `${IMAGES_BASE_PATH}${book.coverImage}`.replace(/\s+/g, '')
                                                        : '/placeholder.png'
                                                }
                                                alt={`${book.title} cover`}
                                                className={styles.bookCover}
                                                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
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

                                        {/* Options button */}
                                        <button
                                            className={styles.bookOptionsBtn}
                                            onClick={() => toggleOptionsMenu(book._id)}
                                            aria-label="Book options"
                                        >
                                            ⋯
                                        </button>

                                        {/* Options menu */}
                                        {showOptionsMenu === book._id && (
                                            <>
                                                <div className={styles.optionsMenuOverlay} onClick={closeOptionsMenu}></div>
                                                <div className={styles.optionsMenu}>
                                                    <button
                                                        className={`${styles.optionsMenuItem} ${styles.primary}`}
                                                        onClick={() => {
                                                            handleOpenBook(book._id);
                                                            closeOptionsMenu();
                                                        }}
                                                    >
                                                        <span>📖</span>
                                                        {book.progress ? 'Continue Reading' : 'Start Reading'}
                                                    </button>
                                                    {!book.isActive && (
                                                        <button
                                                            className={styles.optionsMenuItem}
                                                            onClick={() => {
                                                                handleSetActiveBook(book._id);
                                                                closeOptionsMenu();
                                                            }}
                                                        >
                                                            <span>⭐</span>
                                                            Set as Active Book
                                                        </button>
                                                    )}
                                                    <button
                                                        className={`${styles.optionsMenuItem} ${styles.danger}`}
                                                        onClick={() => {
                                                            handleRemoveBook(book._id);
                                                            closeOptionsMenu();
                                                        }}
                                                    >
                                                        <span>🗑️</span>
                                                        Remove Book
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className={styles.bookInfo}>
                                        <div className={styles.bookMeta}>
                                            <span className={`${styles.statusBadge} ${styles[getReadingStatus(book.progress).toLowerCase().replace(' ', '-') as keyof typeof styles] || ''}`}>
                                                {getReadingStatus(book.progress)}
                                            </span>
                                            {book.progress && book.progress.bookProgress > 0 && (
                                                <span className={styles.progressText}>
                                                    {Math.round(book.progress.bookProgress)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

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