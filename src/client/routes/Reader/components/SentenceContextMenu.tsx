import React, { useRef, useEffect } from 'react';
import { Box, Paper, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';

interface SentenceContextMenuProps {
    position: { x: number; y: number };
    onTranslate: () => void;
    onSetCurrentSentence: () => void;
    onAskQuestion: () => void;
    onClose: () => void;
}

/**
 * SentenceContextMenu - Context menu shown on double-click of a sentence
 * 
 * Provides three actions:
 * 1. Translate - Opens translation popup for the sentence
 * 2. Set current sentence - Navigates to this sentence
 * 3. Ask a question - Opens question input for AI chat
 */
export const SentenceContextMenu: React.FC<SentenceContextMenuProps> = ({
    position,
    onTranslate,
    onSetCurrentSentence,
    onAskQuestion,
    onClose,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            
            // Check if click is inside the menu
            if (menuRef.current && menuRef.current.contains(target)) {
                return;
            }
            
            // Click is outside - close the menu
            onClose();
        };

        // Add small delay to prevent immediate close from the double-click event
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Adjust position to keep menu within viewport
    const adjustedPosition = { ...position };
    if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust horizontal position
        if (adjustedPosition.x + rect.width > viewportWidth) {
            adjustedPosition.x = viewportWidth - rect.width - 10;
        }
        if (adjustedPosition.x < 10) {
            adjustedPosition.x = 10;
        }

        // Adjust vertical position
        if (adjustedPosition.y + rect.height > viewportHeight) {
            adjustedPosition.y = position.y - rect.height - 10;
        }
    }

    const handleMenuItemClick = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <Paper
            ref={menuRef}
            elevation={8}
            sx={{
                position: 'fixed',
                left: `${adjustedPosition.x}px`,
                top: `${adjustedPosition.y}px`,
                zIndex: 1300,
                minWidth: 220,
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                '@media (prefers-color-scheme: dark)': {
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                }
            }}
        >
            <Box sx={{ py: 0.5 }}>
                <MenuItem
                    onClick={() => handleMenuItemClick(onTranslate)}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            backgroundColor: 'action.hover',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <TranslateIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Translate"
                        primaryTypographyProps={{
                            fontSize: '0.95rem',
                            fontWeight: 500,
                        }}
                    />
                </MenuItem>

                <Divider sx={{ mx: 1 }} />

                <MenuItem
                    onClick={() => handleMenuItemClick(onSetCurrentSentence)}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            backgroundColor: 'action.hover',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <MyLocationIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Set current sentence"
                        primaryTypographyProps={{
                            fontSize: '0.95rem',
                            fontWeight: 500,
                        }}
                    />
                </MenuItem>

                <Divider sx={{ mx: 1 }} />

                <MenuItem
                    onClick={() => handleMenuItemClick(onAskQuestion)}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            backgroundColor: 'action.hover',
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <QuestionAnswerIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Ask a question"
                        primaryTypographyProps={{
                            fontSize: '0.95rem',
                            fontWeight: 500,
                        }}
                    />
                </MenuItem>
            </Box>
        </Paper>
    );
};

