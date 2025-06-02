import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    CircularProgress,
    Alert,
    Avatar,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    BookmarkBorder as BookmarkIcon,
    MenuBook as BookIcon,
    AccessTime as TimeIcon
} from '@mui/icons-material';
import { getBookmarksByBook, deleteBookmark, updateBookmark } from '@/apis/bookmarks/client';
import { BookmarkClient } from '@/apis/bookmarks/types';
import { getBooks } from '@/apis/books/client';
import { BookClient } from '@/apis/books/types';
import { useRouter } from '../../router';

export const Bookmarks: React.FC = () => {
    const [bookmarks, setBookmarks] = useState<BookmarkClient[]>([]);
    const [books, setBooks] = useState<BookClient[]>([]);
    const [selectedBookId, setSelectedBookId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [loadingBookmarks, setLoadingBookmarks] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editDialog, setEditDialog] = useState<{ open: boolean, bookmark: BookmarkClient | null }>({
        open: false,
        bookmark: null
    });
    const [editName, setEditName] = useState('');
    const { navigate } = useRouter();

    useEffect(() => {
        loadBooks();
    }, []);

    useEffect(() => {
        if (selectedBookId) {
            loadBookmarks();
        } else {
            setBookmarks([]);
        }
    }, [selectedBookId]);

    const loadBooks = async () => {
        try {
            setLoading(true);
            const result = await getBooks({});
            if (result.data?.books) {
                setBooks(result.data.books);
                // Auto-select first book if available
                if (result.data.books.length > 0) {
                    setSelectedBookId(result.data.books[0]._id);
                }
            } else {
                setError('Failed to load books');
            }
        } catch {
            setError('Error loading books');
        } finally {
            setLoading(false);
        }
    };

    const loadBookmarks = async () => {
        if (!selectedBookId) return;

        try {
            setLoadingBookmarks(true);
            const result = await getBookmarksByBook({ bookId: selectedBookId });
            if (result.data) {
                setBookmarks(result.data.bookmarks);
            } else {
                setError('Failed to load bookmarks');
            }
        } catch {
            setError('Error loading bookmarks');
        } finally {
            setLoadingBookmarks(false);
        }
    };

    const handleDeleteBookmark = async (bookmarkId: string) => {
        try {
            const result = await deleteBookmark({ bookmarkId });
            if (result.data?.success) {
                setBookmarks(prev => prev.filter(b => b._id !== bookmarkId));
            } else {
                setError('Failed to delete bookmark');
            }
        } catch {
            setError('Error deleting bookmark');
        }
    };

    const handleEditBookmark = (bookmark: BookmarkClient) => {
        setEditDialog({ open: true, bookmark });
        setEditName(bookmark.customName || '');
    };

    const handleSaveEdit = async () => {
        if (!editDialog.bookmark) return;

        try {
            const result = await updateBookmark(editDialog.bookmark._id, {
                customName: editName || undefined
            });
            if (result.data?.bookmark) {
                setBookmarks(prev => prev.map(b =>
                    b._id === editDialog.bookmark!._id ? result.data!.bookmark! : b
                ));
                setEditDialog({ open: false, bookmark: null });
                setEditName('');
            } else {
                setError('Failed to update bookmark');
            }
        } catch {
            setError('Error updating bookmark');
        }
    };

    const handleGoToBookmark = (bookmark: BookmarkClient) => {
        navigate(`/reader?bookId=${bookmark.bookId}&chapter=${bookmark.chapterNumber}&chunk=${bookmark.chunkIndex}`);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const selectedBook = books.find(book => book._id === selectedBookId);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                p: { xs: 2, sm: 3 },
                maxWidth: 1200,
                mx: 'auto'
            }}
        >
            {/* Header Section */}
            <Box sx={{ mb: 4 }}>
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1
                    }}
                >
                    <BookmarkIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    My Bookmarks
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Your saved reading positions and favorite passages
                </Typography>

                {/* Book Selector */}
                {books.length > 0 && (
                    <FormControl sx={{ minWidth: 300, mb: 2 }}>
                        <InputLabel id="book-select-label">Select a Book</InputLabel>
                        <Select
                            labelId="book-select-label"
                            value={selectedBookId}
                            label="Select a Book"
                            onChange={(e) => setSelectedBookId(e.target.value)}
                            sx={{
                                borderRadius: 2,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2
                                }
                            }}
                        >
                            {books.map((book) => (
                                <MenuItem key={book._id} value={book._id}>
                                    <Box>
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                            {book.title}
                                        </Typography>
                                        {book.author && (
                                            <Typography variant="caption" color="text.secondary">
                                                by {book.author}
                                            </Typography>
                                        )}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}

                {selectedBook && (
                    <Box
                        sx={{
                            p: 2,
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                            borderRadius: 2,
                            mb: 2
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {selectedBook.title}
                        </Typography>
                        {selectedBook.author && (
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                by {selectedBook.author}
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>

            {error && (
                <Alert
                    severity="error"
                    sx={{
                        mb: 3,
                        borderRadius: 2
                    }}
                >
                    {error}
                </Alert>
            )}

            {books.length === 0 ? (
                <Card
                    sx={{
                        borderRadius: 4,
                        boxShadow: (theme) =>
                            theme.palette.mode === 'dark'
                                ? '0 1px 3px rgba(0,0,0,0.72)'
                                : '0 1px 3px rgba(0,0,0,0.12)',
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <BookIcon
                            sx={{
                                fontSize: 64,
                                color: 'text.disabled',
                                mb: 2
                            }}
                        />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No books available
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            You need to have books in your library to create bookmarks
                        </Typography>
                    </CardContent>
                </Card>
            ) : !selectedBookId ? (
                <Card
                    sx={{
                        borderRadius: 4,
                        boxShadow: (theme) =>
                            theme.palette.mode === 'dark'
                                ? '0 1px 3px rgba(0,0,0,0.72)'
                                : '0 1px 3px rgba(0,0,0,0.12)',
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <BookmarkIcon
                            sx={{
                                fontSize: 64,
                                color: 'text.disabled',
                                mb: 2
                            }}
                        />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Select a book to view bookmarks
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Choose a book from the dropdown above to see its bookmarks
                        </Typography>
                    </CardContent>
                </Card>
            ) : loadingBookmarks ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
                    <CircularProgress />
                </Box>
            ) : bookmarks.length === 0 ? (
                <Card
                    sx={{
                        borderRadius: 4,
                        boxShadow: (theme) =>
                            theme.palette.mode === 'dark'
                                ? '0 1px 3px rgba(0,0,0,0.72)'
                                : '0 1px 3px rgba(0,0,0,0.12)',
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <BookmarkIcon
                            sx={{
                                fontSize: 64,
                                color: 'text.disabled',
                                mb: 2
                            }}
                        />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No bookmarks in this book
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Start reading &ldquo;{selectedBook?.title}&rdquo; to create bookmarks
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Box
                    display="grid"
                    gridTemplateColumns={{
                        xs: '1fr',
                        sm: 'repeat(auto-fill, minmax(380px, 1fr))'
                    }}
                    gap={3}
                >
                    {bookmarks.map((bookmark) => (
                        <Card
                            key={bookmark._id}
                            sx={{
                                borderRadius: 4,
                                boxShadow: (theme) =>
                                    theme.palette.mode === 'dark'
                                        ? '0 1px 3px rgba(0,0,0,0.72)'
                                        : '0 1px 3px rgba(0,0,0,0.12)',
                                border: '1px solid',
                                borderColor: 'divider',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: (theme) =>
                                        theme.palette.mode === 'dark'
                                            ? '0 4px 12px rgba(0,0,0,0.56)'
                                            : '0 4px 12px rgba(0,0,0,0.15)'
                                },
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%'
                            }}
                        >
                            <CardContent sx={{ p: 3, flex: 1 }}>
                                {/* Header with Avatar and Title */}
                                <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
                                    <Avatar
                                        sx={{
                                            bgcolor: 'primary.main',
                                            width: 48,
                                            height: 48
                                        }}
                                    >
                                        <BookmarkIcon />
                                    </Avatar>
                                    <Box flex={1} minWidth={0}>
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                fontWeight: 600,
                                                mb: 0.5,
                                                wordBreak: 'break-word'
                                            }}
                                        >
                                            {bookmark.customName || `Bookmark ${bookmark.chapterNumber}`}
                                        </Typography>
                                        <Chip
                                            icon={<BookIcon />}
                                            label={`Chapter ${bookmark.chapterNumber}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontWeight: 500 }}
                                        />
                                    </Box>
                                </Box>

                                {/* Preview Text */}
                                <Box
                                    sx={{
                                        mb: 2,
                                        p: 2,
                                        backgroundColor: (theme) =>
                                            theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
                                        borderRadius: 2,
                                        borderLeft: 4,
                                        borderLeftColor: 'primary.main'
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            fontStyle: 'italic',
                                            lineHeight: 1.6,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        &ldquo;{bookmark.previewText}&rdquo;
                                    </Typography>
                                </Box>

                                {/* Metadata */}
                                <Box display="flex" alignItems="center" gap={1}>
                                    <TimeIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                                    <Typography variant="caption" color="text.secondary">
                                        Created {formatDate(bookmark.createdAt)}
                                    </Typography>
                                </Box>
                            </CardContent>

                            {/* Actions */}
                            <CardActions
                                sx={{
                                    p: 2,
                                    pt: 0,
                                    gap: 1
                                }}
                            >
                                <Button
                                    variant="contained"
                                    onClick={() => handleGoToBookmark(bookmark)}
                                    sx={{
                                        flex: 1,
                                        borderRadius: 2,
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        minHeight: 44
                                    }}
                                >
                                    Go to Bookmark
                                </Button>
                                <IconButton
                                    onClick={() => handleEditBookmark(bookmark)}
                                    sx={{
                                        minWidth: 44,
                                        minHeight: 44,
                                        borderRadius: 2
                                    }}
                                >
                                    <EditIcon />
                                </IconButton>
                                <IconButton
                                    onClick={() => handleDeleteBookmark(bookmark._id)}
                                    color="error"
                                    sx={{
                                        minWidth: 44,
                                        minHeight: 44,
                                        borderRadius: 2
                                    }}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </CardActions>
                        </Card>
                    ))}
                </Box>
            )}

            {/* Edit Bookmark Dialog */}
            <Dialog
                open={editDialog.open}
                onClose={() => setEditDialog({ open: false, bookmark: null })}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                    }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Edit Bookmark
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ pb: 2 }}>
                    <TextField
                        fullWidth
                        label="Bookmark Name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        margin="normal"
                        placeholder="Enter a custom name for this bookmark"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
                    <Button
                        onClick={() => setEditDialog({ open: false, bookmark: null })}
                        sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            minHeight: 44,
                            px: 3
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveEdit}
                        variant="contained"
                        sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            minHeight: 44,
                            px: 3
                        }}
                    >
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}; 