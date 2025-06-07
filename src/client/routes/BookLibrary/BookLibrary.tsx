import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from '../../router';
import { getBooks, deleteBook } from '../../../apis/books/client';
import { getReadingProgress } from '../../../apis/readingProgress/client';
import { BookClient } from '../../../apis/books/types';
import { ReadingProgressClient } from '../../../apis/readingProgress/types';
import './BookLibrary.css';

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
        navigate(`/reader?bookId=${bookId}`);
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
            <div className="book-library">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading your library...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="book-library">
                <div className="error-container">
                    <h2>Error loading library</h2>
                    <p>{error}</p>
                    <button className="btn-primary" onClick={loadBooksWithProgress}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="book-library">
            <header className="library-header">
                <h1>My Library</h1>
                <div className="library-controls">
                    <div className="sort-dropdown">
                        <label htmlFor="sort-select" className="sr-only">Sort books</label>
                        <select
                            id="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'title' | 'progress' | 'lastRead')}
                            className="sort-select"
                        >
                            <option value="title">Sort by Title</option>
                            <option value="progress">Sort by Progress</option>
                            <option value="lastRead">Sort by Last Read</option>
                        </select>
                    </div>
                </div>
            </header>

            {/* All Books Grid */}
            <section className="all-books">
                <h2>Your Books</h2>
                {books.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📚</div>
                        <h3>No books in your library</h3>
                        <p>Add some books to get started with your reading journey.</p>
                    </div>
                ) : (
                    <div className="books-grid">
                        {sortedBooks.map((book) => (
                            <div key={book._id} className={`book-card ${book.isActive ? 'book-card-active' : ''}`}>
                                <div className="book-card-inner">
                                    <div className="book-cover-container">
                                        {book.coverImage ? (
                                            <Image
                                                src={book.coverImage}
                                                alt={`${book.title} cover`}
                                                className="book-cover"
                                                fill
                                                style={{ objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div className="book-cover-placeholder">
                                                <span>📖</span>
                                            </div>
                                        )}

                                        {/* Progress indicator */}
                                        {book.progress && book.progress.bookProgress > 0 && (
                                            <div className="progress-indicator">
                                                <div
                                                    className="progress-bar"
                                                    style={{ width: `${book.progress.bookProgress}%` }}
                                                ></div>
                                            </div>
                                        )}

                                        {/* Options button */}
                                        <button
                                            className="book-options-btn"
                                            onClick={() => toggleOptionsMenu(book._id)}
                                            aria-label="Book options"
                                        >
                                            ⋯
                                        </button>

                                        {/* Options menu */}
                                        {showOptionsMenu === book._id && (
                                            <>
                                                <div className="options-menu-overlay" onClick={closeOptionsMenu}></div>
                                                <div className="options-menu">
                                                    <button
                                                        className="options-menu-item primary"
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
                                                            className="options-menu-item"
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
                                                        className="options-menu-item danger"
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

                                    <div className="book-info">
                                        <div className="book-meta">
                                            <span className={`status-badge ${getReadingStatus(book.progress).toLowerCase().replace(' ', '-')}`}>
                                                {getReadingStatus(book.progress)}
                                            </span>
                                            {book.progress && book.progress.bookProgress > 0 && (
                                                <span className="progress-text">
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
                <div className="modal-overlay" onClick={() => {
                    setShowDeleteConfirm(null);
                    closeOptionsMenu();
                }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Remove Book</h3>
                        <p>Are you sure you want to remove this book from your library? This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setShowDeleteConfirm(null);
                                    closeOptionsMenu();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-danger"
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