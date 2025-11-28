import React from 'react';
import { Typography, Box } from '@mui/material';
import type { BookClient } from '../../../../apis/books/types';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface ReaderHeaderProps {
    book: BookClient;
    chapter: ChapterClient;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({ book, chapter }) => {
    return (
        <Box sx={{ 
            mb: { xs: 4, sm: 5 },
            pt: { xs: 2, sm: 3 },
        }}>
            {/* Book Title */}
            <Typography
                sx={{
                    color: 'var(--reader-text)',
                    fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.5rem' },
                    lineHeight: 1.2,
                    fontWeight: 700,
                    fontFamily: 'var(--reader-font-sans)',
                    letterSpacing: '-0.025em',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    mb: { xs: 1.5, sm: 2 }
                }}
            >
                {book.title}
            </Typography>
            
            {/* Chapter Badge & Title */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5,
                flexWrap: 'wrap'
            }}>
                {/* Chapter Number Badge */}
                <Box
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        px: 1.5,
                        py: 0.5,
                        backgroundColor: 'var(--reader-accent)',
                        borderRadius: '8px',
                        minWidth: 'fit-content',
                    }}
                >
                    <Typography
                        sx={{
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 700,
                            fontFamily: 'var(--reader-font-sans)',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                        }}
                    >
                        Chapter {chapter.chapterNumber}
                    </Typography>
                </Box>
                
                {/* Chapter Title */}
                <Typography
                    sx={{
                        color: 'var(--reader-text-secondary)',
                        fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.4rem' },
                        lineHeight: 1.3,
                        fontWeight: 500,
                        fontFamily: 'var(--reader-font-sans)',
                        letterSpacing: '-0.01em',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                    }}
                >
                    {chapter.title}
                </Typography>
            </Box>
            
            {/* Decorative accent line */}
            <Box
                sx={{
                    mt: 3,
                    height: '3px',
                    width: '60px',
                    background: 'linear-gradient(90deg, var(--reader-accent), var(--reader-accent-light))',
                    borderRadius: '2px',
                }}
            />
        </Box>
    );
}; 