import React, { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  CircularProgress
} from '@mui/material';
import { useRouter } from '../../router';
import { getBooks } from '../../../apis/books/client';
import type { BookClient } from '../../../apis/books/types';

export const Home = () => {
  const { navigate } = useRouter();
  const [books, setBooks] = useState<BookClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        setLoading(true);
        const result = await getBooks({});

        if (result.data) {
          setBooks(result.data.books || []);
        } else {
          setError('Failed to load books');
        }
      } catch {
        setError('Failed to load books');
      } finally {
        setLoading(false);
      }
    };

    loadBooks();
  }, []);

  const handleStartReading = (bookId: string) => {
    navigate(`/?bookId=${bookId}&chapterNumber=1`);
  };

  if (loading) {
    return (
      <Paper elevation={0} sx={{ width: '100%', p: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={0} sx={{ width: '100%', p: 4 }}>
        <Box textAlign="center" mt={4}>
          <Typography color="error" variant="h6">
            {error}
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ width: '100%', p: 4 }}>
      <Typography variant="h3" gutterBottom>
        Your Library
      </Typography>

      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Choose a book to start reading with synchronized audio
      </Typography>

      {books.length === 0 ? (
        <Box textAlign="center" mt={4}>
          <Typography variant="h6">
            No books available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload some books to get started
          </Typography>
        </Box>
      ) : (
        <Box sx={{
          mt: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3
        }}>
          {books.map((book) => (
            <Card
              key={book._id}
              sx={{
                width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.333% - 16px)' },
                minWidth: 280,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
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
                <Typography variant="h6" gutterBottom>
                  {book.title}
                </Typography>

                {book.author && (
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    by {book.author}
                  </Typography>
                )}

                {book.description && (
                  <Typography variant="body2" color="text.secondary">
                    {book.description.length > 150
                      ? `${book.description.substring(0, 150)}...`
                      : book.description}
                  </Typography>
                )}

                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {book.totalChapters} chapters
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {book.totalWords.toLocaleString()} words
                  </Typography>
                </Box>
              </CardContent>

              <CardActions>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={() => handleStartReading(book._id)}
                >
                  Start Reading
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </Paper>
  );
};
