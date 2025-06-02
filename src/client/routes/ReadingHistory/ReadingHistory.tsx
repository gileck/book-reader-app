import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    CircularProgress,
    Alert,
    Chip,
    LinearProgress
} from '@mui/material';
import {
    History as HistoryIcon,
    MenuBook as BookIcon,
    Schedule as TimeIcon,
    TrendingUp as ProgressIcon
} from '@mui/icons-material';
import { getBooks } from '@/apis/books/client';
import { getReadingProgress, getReadingStats } from '@/apis/readingProgress/client';
import { BookClient } from '@/apis/books/types';
import { ReadingProgressClient, ReadingProgressStats } from '@/apis/readingProgress/types';
import { useRouter } from '../../router';

interface BookWithProgress {
    book: BookClient;
    progress?: ReadingProgressClient;
    stats?: ReadingProgressStats;
}

export const ReadingHistory: React.FC = () => {
    const [booksWithProgress, setBooksWithProgress] = useState<BookWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { navigate } = useRouter();

    useEffect(() => {
        loadReadingHistory();
    }, []);

    const loadReadingHistory = async () => {
        try {
            setLoading(true);

            // Get all books
            const booksResult = await getBooks({});
            if (!booksResult.data?.books) {
                setError('Failed to load books');
                return;
            }

            const books = booksResult.data.books;
            const booksWithProgressData: BookWithProgress[] = [];

            // For each book, try to get reading progress
            for (const book of books) {
                const bookWithProgress: BookWithProgress = { book };

                try {
                    // Get reading progress for this book
                    const progressResult = await getReadingProgress({
                        userId: 'user-1', // TODO: Get actual user ID from context
                        bookId: book._id
                    });

                    if (progressResult.data?.readingProgress) {
                        bookWithProgress.progress = progressResult.data.readingProgress;

                        // Also get detailed stats
                        const statsResult = await getReadingStats({
                            userId: 'user-1', // TODO: Get actual user ID from context
                            bookId: book._id
                        });

                        if (statsResult.data?.stats) {
                            bookWithProgress.stats = statsResult.data.stats;
                        }
                    }
                } catch (err) {
                    // Continue if we can't get progress for this book
                    console.warn(`Failed to get progress for book ${book._id}:`, err);
                }

                booksWithProgressData.push(bookWithProgress);
            }

            // Sort by last read date (books with progress first, then by last read)
            booksWithProgressData.sort((a, b) => {
                if (a.progress && !b.progress) return -1;
                if (!a.progress && b.progress) return 1;
                if (a.progress && b.progress) {
                    return new Date(b.progress.lastReadAt).getTime() - new Date(a.progress.lastReadAt).getTime();
                }
                return 0;
            });

            setBooksWithProgress(booksWithProgressData);
        } catch {
            setError('Error loading reading history');
        } finally {
            setLoading(false);
        }
    };

    const handleContinueReading = (bookWithProgress: BookWithProgress) => {
        if (bookWithProgress.progress) {
            navigate(`/reader?bookId=${bookWithProgress.book._id}&chapter=${bookWithProgress.progress.currentChapter}&chunk=${bookWithProgress.progress.currentChunk}`);
        } else {
            navigate(`/reader?bookId=${bookWithProgress.book._id}&chapter=1`);
        }
    };

    const formatTime = (minutes: number): string => {
        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box p={3}>
            <Typography variant="h4" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                Reading History
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {booksWithProgress.length === 0 ? (
                <Card>
                    <CardContent>
                        <Typography variant="h6" align="center" color="text.secondary">
                            No reading history yet
                        </Typography>
                        <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 1 }}>
                            Start reading some books to see your reading history here
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Box
                    display="grid"
                    gridTemplateColumns={{
                        xs: '1fr',
                        md: 'repeat(2, 1fr)',
                        lg: 'repeat(3, 1fr)'
                    }}
                    gap={3}
                >
                    {booksWithProgress.map((bookWithProgress) => {
                        const { book, progress, stats } = bookWithProgress;
                        const hasProgress = !!progress;
                        const bookProgress = stats?.bookProgress || 0;
                        const isCompleted = bookProgress >= 100;

                        return (
                            <Card key={book._id} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardContent sx={{ flex: 1 }}>
                                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                                        <BookIcon color="primary" />
                                        <Typography variant="h6" component="h3" sx={{ flex: 1 }}>
                                            {book.title}
                                        </Typography>
                                        {isCompleted && (
                                            <Chip
                                                label="Completed"
                                                color="success"
                                                size="small"
                                            />
                                        )}
                                    </Box>

                                    {book.author && (
                                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                            by {book.author}
                                        </Typography>
                                    )}

                                    {hasProgress ? (
                                        <Box mt={2}>
                                            {/* Progress Bar */}
                                            <Box mb={2}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Progress
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {bookProgress}%
                                                    </Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={bookProgress}
                                                    sx={{
                                                        height: 6,
                                                        borderRadius: 3,
                                                        backgroundColor: '#f0f0f0',
                                                        '& .MuiLinearProgress-bar': {
                                                            backgroundColor: isCompleted ? '#4caf50' : '#4285f4',
                                                            borderRadius: 3
                                                        }
                                                    }}
                                                />
                                            </Box>

                                            {/* Reading Stats */}
                                            <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                                                <Chip
                                                    icon={<BookIcon />}
                                                    label={`Chapter ${progress.currentChapter}`}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                                {stats && (
                                                    <Chip
                                                        icon={<TimeIcon />}
                                                        label={formatTime(stats.totalReadingTime)}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                )}
                                                {stats && stats.chaptersCompleted > 0 && (
                                                    <Chip
                                                        icon={<ProgressIcon />}
                                                        label={`${stats.chaptersCompleted}/${stats.totalChapters} chapters`}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                )}
                                            </Box>

                                            <Typography variant="caption" color="text.secondary">
                                                Last read: {formatDate(progress.lastReadAt.toString())}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Box mt={2}>
                                            <Typography variant="body2" color="text.secondary">
                                                Not started yet
                                            </Typography>
                                        </Box>
                                    )}
                                </CardContent>

                                <CardActions>
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        onClick={() => handleContinueReading(bookWithProgress)}
                                    >
                                        {hasProgress ? 'Continue Reading' : 'Start Reading'}
                                    </Button>
                                </CardActions>
                            </Card>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}; 