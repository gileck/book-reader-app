import React from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Button
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';

interface SearchHistoryListProps {
    history: string[];
    onSelect: (query: string) => void;
    onDelete: (query: string) => void;
    onClear: () => void;
}

export const SearchHistoryList: React.FC<SearchHistoryListProps> = ({
    history,
    onSelect,
    onDelete,
    onClear
}) => {
    if (history.length === 0) return null;

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                px: 2,
                mb: 1
            }}>
                <Typography variant="subtitle2" color="text.secondary">
                    Recent Searches
                </Typography>
                <Button 
                    size="small" 
                    color="inherit" 
                    onClick={onClear}
                    sx={{ 
                        textTransform: 'none',
                        color: 'text.secondary',
                        fontSize: '0.8rem',
                        minWidth: 'auto'
                    }}
                >
                    Clear all
                </Button>
            </Box>
            
            <List disablePadding>
                {history.map((item) => (
                    <ListItem
                        key={item}
                        disablePadding
                        secondaryAction={
                            <IconButton 
                                edge="end" 
                                aria-label="delete"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(item);
                                }}
                                size="small"
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        }
                    >
                        <ListItemButton onClick={() => onSelect(item)}>
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <HistoryIcon fontSize="small" color="action" />
                            </ListItemIcon>
                            <ListItemText 
                                primary={item}
                                primaryTypographyProps={{
                                    noWrap: true,
                                    fontSize: '0.95rem'
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};

