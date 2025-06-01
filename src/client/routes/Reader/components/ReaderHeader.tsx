import React from 'react';
import { Typography } from '@mui/material';
import type { BookClient } from '../../../../apis/books/types';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface ReaderHeaderProps {
    book: BookClient;
    chapter: ChapterClient;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({ book, chapter }) => {
    return (
        <>
            <Typography variant="h4" gutterBottom>
                {book.title}
            </Typography>
            <Typography variant="h5" color="text.secondary" gutterBottom>
                Chapter {chapter.chapterNumber}: {chapter.title}
            </Typography>
        </>
    );
}; 