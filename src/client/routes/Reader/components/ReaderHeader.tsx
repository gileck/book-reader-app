import React from 'react';
import { Typography, Box } from '@mui/material';
import { useUserTheme } from '@/client/components/UserThemeProvider';
import type { BookClient } from '../../../../apis/books/types';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface ReaderHeaderProps {
    book: BookClient;
    chapter: ChapterClient;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({ book, chapter }) => {
    const { textColor } = useUserTheme();
    return (
        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
            <Typography
                variant="h4"
                sx={{
                    color: textColor,
                    fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                    lineHeight: { xs: 1.2, sm: 1.235 },
                    fontWeight: { xs: 600, sm: 500 },
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    mb: { xs: 1, sm: 1.5, md: 2 }
                }}
            >
                {book.title}
            </Typography>
            <Typography
                variant="h5"
                sx={{
                    color: textColor,
                    fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                    lineHeight: { xs: 1.3, sm: 1.334 },
                    fontWeight: { xs: 500, sm: 400 },
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    mb: { xs: 2, sm: 3 }
                }}
            >
                Chapter {chapter.chapterNumber}: {chapter.title}
            </Typography>
        </Box>
    );
}; 