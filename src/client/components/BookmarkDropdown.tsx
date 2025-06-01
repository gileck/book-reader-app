import React, { useState } from 'react';
import {
    Box,
    IconButton,
    Menu,
    MenuItem,
    Typography,
    Divider,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    BookmarkBorder,
    Bookmark as BookmarkIcon,
    BookmarkAdd
} from '@mui/icons-material';
import type { BookmarkClient } from '../../apis/bookmarks/types';

interface BookmarkDropdownProps {
    bookmarks: BookmarkClient[];
    currentChapterNumber: number;
    currentChunkIndex: number;
    onNavigateToBookmark?: (chapterNumber: number, chunkIndex: number) => void;
    onToggleBookmark?: () => void;
    isCurrentBookmarked?: boolean;
}

export const BookmarkDropdown: React.FC<BookmarkDropdownProps> = ({
    bookmarks,
    currentChapterNumber,
    currentChunkIndex,
    onNavigateToBookmark,
    onToggleBookmark,
    isCurrentBookmarked = false
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleBookmarkClick = (bookmark: BookmarkClient) => {
        if (onNavigateToBookmark) {
            onNavigateToBookmark(bookmark.chapterNumber, bookmark.chunkIndex);
        }
        handleClose();
    };

    const handleToggleBookmark = () => {
        if (onToggleBookmark) {
            onToggleBookmark();
        }
        handleClose();
    };

    // Sort bookmarks by chapter and chunk index
    const sortedBookmarks = [...bookmarks].sort((a, b) => {
        if (a.chapterNumber !== b.chapterNumber) {
            return a.chapterNumber - b.chapterNumber;
        }
        return a.chunkIndex - b.chunkIndex;
    });

    return (
        <>
            <IconButton
                onClick={handleClick}
                sx={{
                    color: isCurrentBookmarked ? '#4285f4' : 'white',
                    '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        color: isCurrentBookmarked ? '#3367d6' : '#4285f4'
                    }
                }}
                size="medium"
            >
                {isCurrentBookmarked ? <BookmarkIcon /> : <BookmarkBorder />}
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        maxHeight: 400,
                        width: 350,
                        backgroundColor: 'grey.900',
                        color: 'white'
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
            >
                {/* Toggle Bookmark for Current Position */}
                {onToggleBookmark && (
                    <>
                        <MenuItem onClick={handleToggleBookmark}>
                            <ListItemIcon>
                                <BookmarkAdd sx={{ color: 'primary.main' }} />
                            </ListItemIcon>
                            <ListItemText>
                                <Typography variant="body2">
                                    {isCurrentBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                                </Typography>
                            </ListItemText>
                        </MenuItem>
                        {bookmarks.length > 0 && <Divider sx={{ borderColor: 'grey.700' }} />}
                    </>
                )}

                {bookmarks.length === 0 ? (
                    !onToggleBookmark && (
                        <MenuItem disabled>
                            <Typography variant="body2" color="grey.400">
                                No bookmarks yet
                            </Typography>
                        </MenuItem>
                    )
                ) : (
                    <>
                        <Box sx={{ px: 2, py: 1 }}>
                            <Typography variant="subtitle2" color="primary.main">
                                Bookmarks ({bookmarks.length})
                            </Typography>
                        </Box>
                        <Divider sx={{ borderColor: 'grey.700' }} />
                        {sortedBookmarks.map((bookmark) => {
                            const isCurrentPosition =
                                bookmark.chapterNumber === currentChapterNumber &&
                                bookmark.chunkIndex === currentChunkIndex;

                            return (
                                <MenuItem
                                    key={bookmark._id}
                                    onClick={() => handleBookmarkClick(bookmark)}
                                    sx={{
                                        backgroundColor: isCurrentPosition ? 'primary.dark' : 'transparent',
                                        '&:hover': {
                                            backgroundColor: isCurrentPosition ? 'primary.dark' : 'grey.800'
                                        },
                                        py: 1.5
                                    }}
                                >
                                    <ListItemIcon>
                                        <BookmarkIcon
                                            sx={{
                                                color: isCurrentPosition ? 'primary.light' : 'primary.main',
                                                fontSize: 20
                                            }}
                                        />
                                    </ListItemIcon>
                                    <ListItemText>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                            {bookmark.customName || `Chapter ${bookmark.chapterNumber}`}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="grey.400"
                                            sx={{
                                                display: 'block',
                                                mt: 0.5,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {bookmark.previewText}
                                        </Typography>
                                    </ListItemText>
                                </MenuItem>
                            );
                        })}
                    </>
                )}
            </Menu>
        </>
    );
}; 