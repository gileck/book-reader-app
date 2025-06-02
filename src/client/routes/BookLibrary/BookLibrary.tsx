import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    CircularProgress,
    Chip,
    IconButton,
    Menu,
    MenuItem,
    LinearProgress
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useRouter } from '../../router';
import { getBooks } from '../../../apis/books/client';
import { getReadingProgress } from '../../../apis/readingProgress/client';
import { BookClient } from '../../../apis/books/types';
import { ReadingProgressClient } from '../../../apis/readingProgress/types';

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
    const [menuAnchor, setMenuAnchor] = useState<{ [key: string]: HTMLElement | null }>({});

    useEffect(() => {
        loadBooksWithProgress();
    }, []);

    const loadBooksWithProgress = async () => {
        try {
            setLoading(true);
            setError(null);

            // Get all books
            const booksResult = await getBooks({});
            if (!booksResult.data) {
                throw new Error('Failed to load books');
            }

            // Get active book from localStorage
            const storedActiveBookId = localStorage.getItem('activeBookId');

            // Load reading progress for each book
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

    const handleStartReading = (bookId: string) => {
        navigate(`/reader?bookId=${bookId}`);
    };

    const handleContinueReading = (bookId: string) => {
        navigate(`/reader?bookId=${bookId}`);
    };

    const handleSetActiveBook = (bookId: string) => {
        localStorage.setItem('activeBookId', bookId);
        setBooks(books.map(book => ({
            ...book,
            isActive: book._id === bookId
        })));
        handleCloseMenu(bookId);
    };

    const handleOpenMenu = (bookId: string, event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchor({ ...menuAnchor, [bookId]: event.currentTarget });
    };

    const handleCloseMenu = (bookId: string) => {
        setMenuAnchor({ ...menuAnchor, [bookId]: null });
    };

    const getReadingStatusChip = (book: BookWithProgress) => {
        if (!book.progress) {
            return <Chip label="Not Started" color="default" size="small" />;
        }

        if (book.progress.bookProgress >= 100) {
            return <Chip label="Completed" color="success" size="small" />;
        }

        if (book.progress.bookProgress > 0) {
            return <Chip label="In Progress" color="primary" size="small" />;
        }

        return <Chip label="Not Started" color="default" size="small" />;
    };

    const formatProgress = (progress?: ReadingProgressClient) => {
        if (!progress) return 'No progress';

        if (progress.bookProgress >= 100) {
            return 'Completed';
        }

        return `Chapter ${progress.currentChapter} • ${Math.round(progress.bookProgress)}% complete`;
    };

    const formatLastRead = (progress?: ReadingProgressClient) => {
        if (!progress) return '';

        const lastRead = new Date(progress.lastReadAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastRead.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return lastRead.toLocaleDateString();
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box textAlign="center" mt={4}>
                <Typography color="error" variant="h6">
                    {error}
                </Typography>
                <Button onClick={loadBooksWithProgress} sx={{ mt: 2 }}>
                    Retry
                </Button>
            </Box>
        );
    }

    const activeBook = books.find(book => book.isActive);
    const otherBooks = books.filter(book => !book.isActive);

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Book Library
            </Typography>

            {/* Active Book Section */}
            {activeBook && (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" component="h2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StarIcon color="primary" />
                        Active Book
                    </Typography>
                    <Card sx={{ backgroundColor: 'primary.50', border: '2px solid', borderColor: 'primary.main' }}>
                        {activeBook.coverImage && (
                            <Box
                                component="img"
                                src={activeBook.coverImage}
                                alt={`${activeBook.title} cover`}
                                sx={{
                                    height: 200,
                                    objectFit: 'cover',
                                    width: '100%'
                                }}
                            />
                        )}
                        <CardContent>
                            <Typography variant="h6" component="h3" gutterBottom>
                                {activeBook.title}
                            </Typography>
                            {activeBook.author && (
                                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                                    by {activeBook.author}
                                </Typography>
                            )}
                            {activeBook.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {activeBook.description}
                                </Typography>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                {getReadingStatusChip(activeBook)}
                                <Typography variant="body2" color="text.secondary">
                                    {formatProgress(activeBook.progress)}
                                </Typography>
                                {activeBook.progress && (
                                    <Typography variant="body2" color="text.secondary">
                                        Last read: {formatLastRead(activeBook.progress)}
                                    </Typography>
                                )}
                            </Box>
                            {activeBook.progress && activeBook.progress.bookProgress > 0 && (
                                <LinearProgress
                                    variant="determinate"
                                    value={activeBook.progress.bookProgress}
                                    sx={{ mb: 2 }}
                                />
                            )}
                        </CardContent>
                        <CardActions>
                            <Button
                                variant="contained"
                                startIcon={<PlayArrowIcon />}
                                onClick={() => activeBook.progress ? handleContinueReading(activeBook._id) : handleStartReading(activeBook._id)}
                            >
                                {activeBook.progress ? 'Continue Reading' : 'Start Reading'}
                            </Button>
                        </CardActions>
                    </Card>
                </Box>
            )}

            {/* Other Books Section */}
            <Typography variant="h5" component="h2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MenuBookIcon />
                {activeBook ? 'Other Books' : 'All Books'}
            </Typography>

            {otherBooks.length === 0 && !activeBook && (
                <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                    No books found in your library.
                </Typography>
            )}

            <Box sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)'
                },
                gap: 3
            }}>
                {otherBooks.map((book) => (
                    <Card key={book._id} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {book.coverImage && (
                            <Box
                                component="img"
                                src={book.coverImage}
                                alt={`${book.title} cover`}
                                sx={{
                                    height: 200,
                                    objectFit: 'cover',
                                    width: '100%'
                                }}
                            />
                        )}
                        <CardContent sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
                                    {book.title}
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={(event) => handleOpenMenu(book._id, event)}
                                >
                                    <MoreVertIcon />
                                </IconButton>
                                <Menu
                                    anchorEl={menuAnchor[book._id] || null}
                                    open={Boolean(menuAnchor[book._id])}
                                    onClose={() => handleCloseMenu(book._id)}
                                >
                                    <MenuItem onClick={() => handleSetActiveBook(book._id)}>
                                        <StarBorderIcon sx={{ mr: 1 }} />
                                        Set as Active Book
                                    </MenuItem>
                                </Menu>
                            </Box>
                            {book.author && (
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    by {book.author}
                                </Typography>
                            )}
                            {book.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {book.description.length > 100
                                        ? `${book.description.substring(0, 100)}...`
                                        : book.description
                                    }
                                </Typography>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                {getReadingStatusChip(book)}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                {formatProgress(book.progress)}
                            </Typography>
                            {book.progress && (
                                <Typography variant="body2" color="text.secondary">
                                    Last read: {formatLastRead(book.progress)}
                                </Typography>
                            )}
                            {book.progress && book.progress.bookProgress > 0 && (
                                <LinearProgress
                                    variant="determinate"
                                    value={book.progress.bookProgress}
                                    sx={{ mt: 1 }}
                                />
                            )}
                        </CardContent>
                        <CardActions>
                            <Button
                                variant="outlined"
                                startIcon={<PlayArrowIcon />}
                                onClick={() => book.progress ? handleContinueReading(book._id) : handleStartReading(book._id)}
                                fullWidth
                            >
                                {book.progress ? 'Continue' : 'Start Reading'}
                            </Button>
                        </CardActions>
                    </Card>
                ))}
            </Box>
        </Box>
    );
}; 