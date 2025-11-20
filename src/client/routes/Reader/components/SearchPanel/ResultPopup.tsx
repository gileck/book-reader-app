import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import type { ResultPopupProps } from './types';

export const ResultPopup: React.FC<ResultPopupProps> = ({
    open,
    result,
    onClose,
    onNavigate,
    onBookmark
}) => {
    if (!result) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    backgroundImage: 'none'
                }
            }}
        >
            <DialogTitle sx={{ 
                m: 0, 
                p: 2, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: 1,
                borderColor: 'divider'
            }}>
                <Box>
                    <Typography variant="subtitle1" component="div" fontWeight={600}>
                        Chapter {result.chapterNumber}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {result.chapterTitle}
                    </Typography>
                </Box>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent dividers sx={{ py: 3 }}>
                <Typography 
                    variant="body1" 
                    sx={{ 
                        lineHeight: 1.6,
                        fontFamily: 'var(--reader-font-family, "Merriweather", serif)',
                        fontSize: '1.1rem'
                    }}
                >
                    {/* Use HighlightedText but pass empty query to just show text, 
                        or pass the actual query if we want to keep highlighting in popup */}
                    {result.text}
                </Typography>
            </DialogContent>
            
            <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                <Button
                    startIcon={<BookmarkBorderIcon />}
                    onClick={onBookmark}
                    color="primary"
                >
                    Bookmark
                </Button>
                
                <Button
                    variant="contained"
                    endIcon={<NavigateNextIcon />}
                    onClick={onNavigate}
                    color="primary"
                >
                    Go to Sentence
                </Button>
            </DialogActions>
        </Dialog>
    );
};

