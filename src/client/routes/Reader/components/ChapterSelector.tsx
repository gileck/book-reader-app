import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    CircularProgress,
    Box,
    IconButton
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { getChaptersByBook } from '../../../../apis/chapters/client';
import type { ChapterClient } from '../../../../apis/chapters/types';

interface ChapterSelectorProps {
    bookId: string;
    currentChapterNumber: number;
    open: boolean;
    onClose: () => void;
    onChapterSelect: (chapterNumber: number) => void;
}

export const ChapterSelector: React.FC<ChapterSelectorProps> = ({
    bookId,
    currentChapterNumber,
    open,
    onClose,
    onChapterSelect
}) => {
    const [chapters, setChapters] = useState<ChapterClient[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && bookId) {
            const loadChapters = async () => {
                setLoading(true);
                try {
                    const result = await getChaptersByBook({ bookId });
                    if (result.data?.chapters) {
                        setChapters(result.data.chapters);
                    }
                } catch (error) {
                    console.error('Error loading chapters:', error);
                } finally {
                    setLoading(false);
                }
            };
            loadChapters();
        }
    }, [open, bookId]);

    const handleChapterClick = (chapterNumber: number) => {
        onChapterSelect(chapterNumber);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    maxHeight: '70vh'
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Select Chapter
                <IconButton onClick={onClose} size="small">
                    <Close />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
                {loading ? (
                    <Box display="flex" justifyContent="center" p={4}>
                        <CircularProgress size={32} />
                    </Box>
                ) : (
                    <List>
                        {chapters.map((chapter) => (
                            <ListItem key={chapter._id} disablePadding>
                                <ListItemButton
                                    onClick={() => handleChapterClick(chapter.chapterNumber)}
                                    selected={chapter.chapterNumber === currentChapterNumber}
                                >
                                    <ListItemText
                                        primary={`Chapter ${chapter.chapterNumber}`}
                                        secondary={chapter.title}
                                        primaryTypographyProps={{
                                            fontWeight: chapter.chapterNumber === currentChapterNumber ? 'bold' : 'normal'
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
}; 