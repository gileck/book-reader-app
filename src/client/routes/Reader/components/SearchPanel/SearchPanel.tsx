import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    TextField,
    InputAdornment,
    ToggleButtonGroup,
    ToggleButton,
    Typography,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    CircularProgress,
    Alert,
    Divider,
    LinearProgress,
    Paper,
    Collapse,
    IconButton,
    Button,
    Tooltip,
    useTheme,
    Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import CachedIcon from '@mui/icons-material/Cached';
import ClearIcon from '@mui/icons-material/Clear';
import { useSearch } from '../../hooks/useSearch';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { HighlightedText } from './HighlightedText';
import { ResultPopup } from './ResultPopup';
import { SearchHistoryList } from './SearchHistoryList';
import { searchCache } from '../../utils/searchCache';
import type { SearchPanelProps, GroupedResults } from './types';
import type { SearchResultItem } from '@/apis/search/types';

export const SearchPanel: React.FC<SearchPanelProps> = ({
    bookId,
    currentChapter,
    query,
    searchScope,
    onQueryChange,
    onSearchScopeChange,
    onNavigateToChunk,
    onBookmark
}) => {
    const theme = useTheme();
    const [debouncedQuery, setDebouncedQuery] = useState(query);
    const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
    const [popupState, setPopupState] = useState<{
        open: boolean;
        result: SearchResultItem | null;
    }>({
        open: false,
        result: null
    });

    const {
        results,
        isSearching,
        isCached,
        error,
        progress,
        executeSearch,
        clearResults,
        clearCache
    } = useSearch({
        bookId,
        currentChapter,
        searchScope,
        query: debouncedQuery
    });

    const {
        history,
        addToHistory,
        removeFromHistory,
        clearHistory
    } = useSearchHistory();

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Execute search when debounced query changes
    useEffect(() => {
        if (debouncedQuery.trim()) {
            executeSearch();
            if (debouncedQuery.length > 2) {
                addToHistory(debouncedQuery);
            }
        } else {
            clearResults();
        }
    }, [debouncedQuery, searchScope, executeSearch, clearResults, addToHistory]);

    // Group results by chapter
    const groupedResults = useMemo(() => {
        const groups: Record<number, GroupedResults> = {};
        
        for (const result of results) {
            if (!groups[result.chapterNumber]) {
                groups[result.chapterNumber] = {
                    chapterNumber: result.chapterNumber,
                    chapterTitle: result.chapterTitle,
                    results: []
                };
            }
            groups[result.chapterNumber].results.push(result);
        }
        
        return Object.values(groups).sort((a, b) => a.chapterNumber - b.chapterNumber);
    }, [results]);

    // Initialize expanded state when results change
    useEffect(() => {
        if (groupedResults.length > 0) {
            const initialExpanded: Record<number, boolean> = {};
            const shouldExpand = searchScope === 'current' || groupedResults.length <= 3;
            
            groupedResults.forEach(group => {
                if (expandedChapters[group.chapterNumber] === undefined) {
                    initialExpanded[group.chapterNumber] = shouldExpand;
                } else {
                    initialExpanded[group.chapterNumber] = expandedChapters[group.chapterNumber];
                }
            });
            setExpandedChapters(prev => ({ ...prev, ...initialExpanded }));
        }
    }, [groupedResults, searchScope]);

    const handleScopeChange = (_: React.MouseEvent<HTMLElement>, newScope: 'current' | 'all' | null) => {
        if (newScope !== null) {
            onSearchScopeChange(newScope);
        }
    };

    const handleToggleChapter = (chapterNumber: number) => {
        setExpandedChapters(prev => ({
            ...prev,
            [chapterNumber]: !prev[chapterNumber]
        }));
    };

    const handleResultClick = (result: SearchResultItem) => {
        setPopupState({
            open: true,
            result
        });
    };

    const handleClosePopup = () => {
        setPopupState(prev => ({ ...prev, open: false }));
    };

    const handleNavigateFromPopup = () => {
        if (popupState.result) {
            onNavigateToChunk(popupState.result.chapterNumber, popupState.result.chunkIndex);
            handleClosePopup();
        }
    };

    const handleBookmarkFromPopup = () => {
        if (popupState.result) {
            onBookmark(
                popupState.result.chapterNumber,
                popupState.result.chunkIndex,
                popupState.result.text
            );
            handleClosePopup();
        }
    };

    const handleHistorySelect = (selectedQuery: string) => {
        onQueryChange(selectedQuery);
    };

    const handleHistoryDelete = (queryToDelete: string) => {
        removeFromHistory(queryToDelete);
        searchCache.remove(bookId, 'current', queryToDelete);
        searchCache.remove(bookId, 'all', queryToDelete);
        
        if (query === queryToDelete) {
            clearResults();
            onQueryChange('');
        }
    };

    const handleClearCache = () => {
        clearCache();
        // Re-run search with fresh data
        executeSearch();
    };

    const handleClearSearch = () => {
        onQueryChange('');
        clearResults();
    };

    return (
        <Box
            sx={{
                maxWidth: 800,
                mx: 'auto',
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 56px - 120px)',
                backgroundColor: 'background.default'
            }}
        >
            {/* Search Header */}
            <Box sx={{ 
                p: 2, 
                borderBottom: 1, 
                borderColor: 'divider', 
                backgroundColor: 'background.paper',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <TextField
                    fullWidth
                    placeholder="Search"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: query && (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={handleClearSearch}
                                    edge="end"
                                    sx={{ 
                                        color: 'text.secondary',
                                        '&:hover': { 
                                            backgroundColor: 'rgba(0,0,0,0.08)' 
                                        }
                                    }}
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                        sx: {
                            borderRadius: '10px',
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                            '& fieldset': { border: 'none' },
                            '&:hover fieldset': { border: 'none' },
                            '&.Mui-focused fieldset': { border: 'none' },
                            height: 40
                        }
                    }}
                    sx={{ mb: 2 }}
                    size="small"
                />

                <ToggleButtonGroup
                    value={searchScope}
                    exclusive
                    onChange={handleScopeChange}
                    size="small"
                    fullWidth
                    sx={{
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                        p: 0.5,
                        borderRadius: '8px',
                        '& .MuiToggleButton-root': {
                            border: 'none',
                            borderRadius: '6px !important',
                            py: 0.5,
                            textTransform: 'none',
                            fontWeight: 500,
                            color: 'text.secondary',
                            fontSize: '0.85rem',
                            '&.Mui-selected': {
                                backgroundColor: 'background.paper',
                                color: 'text.primary',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                '&:hover': {
                                    backgroundColor: 'background.paper',
                                }
                            }
                        }
                    }}
                >
                    <ToggleButton value="current">
                        Current Chapter
                    </ToggleButton>
                    <ToggleButton value="all">
                        All Chapters
                    </ToggleButton>
                </ToggleButtonGroup>

                {isSearching && searchScope === 'all' && progress && (
                    <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                                Searching...
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {progress.searchedChapters} / {progress.totalChapters} chapters
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={(progress.searchedChapters / progress.totalChapters) * 100}
                            sx={{ height: 4, borderRadius: 2 }}
                        />
                    </Box>
                )}
            </Box>

            {/* Results Area */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.default' }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                        {error}
                    </Alert>
                )}

                {isSearching && searchScope === 'current' && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress size={30} />
                    </Box>
                )}

                {!query.trim() && (
                    <>
                        {history.length > 0 ? (
                            <SearchHistoryList
                                history={history}
                                onSelect={handleHistorySelect}
                                onDelete={handleHistoryDelete}
                                onClear={clearHistory}
                            />
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                                <SearchIcon sx={{ fontSize: 64, opacity: 0.1, mb: 2 }} />
                                <Typography variant="body1" color="text.secondary">
                                    Enter a search query to find text in the book
                                </Typography>
                            </Box>
                        )}
                    </>
                )}

                {query.trim() && !isSearching && results.length === 0 && !error && (
                    <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                        <Typography variant="body1">
                            No results found for &quot;{query}&quot;
                        </Typography>
                    </Box>
                )}

                {groupedResults.length > 0 && (
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary" fontWeight={500}>
                                {results.length} result{results.length !== 1 ? 's' : ''} found
                                {searchScope === 'all' && ` across ${groupedResults.length} chapter${groupedResults.length !== 1 ? 's' : ''}`}
                            </Typography>
                            
                            {isCached && (
                                <Tooltip title="Results loaded from cache. Click to refresh with latest data.">
                                    <Button 
                                        size="small" 
                                        startIcon={<CachedIcon fontSize="small" />}
                                        onClick={handleClearCache}
                                        color="inherit"
                                        sx={{ 
                                            textTransform: 'none', 
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                            opacity: 0.8,
                                            '&:hover': { opacity: 1, backgroundColor: 'rgba(0,0,0,0.04)' }
                                        }}
                                    >
                                        Cached · Refresh
                                    </Button>
                                </Tooltip>
                            )}
                        </Box>

                        {groupedResults.map((group) => (
                            <Paper 
                                key={group.chapterNumber} 
                                elevation={0} 
                                variant="outlined"
                                sx={{ 
                                    mb: 2, 
                                    overflow: 'hidden',
                                    borderRadius: 3,
                                    borderColor: 'divider',
                                    backgroundColor: 'background.paper'
                                }}
                            >
                                <Box 
                                    onClick={() => handleToggleChapter(group.chapterNumber)}
                                    sx={{ 
                                        p: 1.5, 
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        <Typography variant="subtitle2" fontWeight={600}>
                                            Chapter {group.chapterNumber}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                                            {group.chapterTitle}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip 
                                            label={group.results.length} 
                                            size="small" 
                                            color="primary" 
                                            variant="filled"
                                            sx={{ 
                                                height: 20, 
                                                fontSize: '0.7rem', 
                                                fontWeight: 600,
                                                minWidth: 20
                                            }} 
                                        />
                                        <IconButton size="small" edge="end" sx={{ color: 'text.secondary' }}>
                                            {expandedChapters[group.chapterNumber] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                        </IconButton>
                                    </Box>
                                </Box>
                                
                                <Collapse in={expandedChapters[group.chapterNumber]} timeout="auto" unmountOnExit>
                                    <Divider />
                                    <List disablePadding>
                                        {group.results.map((result, index) => (
                                            <React.Fragment key={`${result.chapterNumber}-${result.chunkIndex}-${index}`}>
                                                <ListItem disablePadding>
                                                    <ListItemButton
                                                        onClick={() => handleResultClick(result)}
                                                        sx={{ 
                                                            py: 1.5, 
                                                            px: 2,
                                                            '&:hover': {
                                                                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
                                                            }
                                                        }}
                                                    >
                                                        <ListItemText
                                                            primary={
                                                                <HighlightedText
                                                                    text={result.text}
                                                                    query={query}
                                                                    maxLength={150}
                                                                />
                                                            }
                                                            secondary={
                                                                <Typography 
                                                                    variant="caption" 
                                                                    color="text.secondary" 
                                                                    sx={{ 
                                                                        mt: 0.5, 
                                                                        display: 'block',
                                                                        fontSize: '0.7rem',
                                                                        opacity: 0.7
                                                                    }}
                                                                >
                                                                    Chunk {result.chunkIndex + 1}
                                                                </Typography>
                                                            }
                                                            primaryTypographyProps={{
                                                                sx: { 
                                                                    whiteSpace: 'normal', 
                                                                    wordBreak: 'break-word',
                                                                    lineHeight: 1.5,
                                                                    fontSize: '0.9rem',
                                                                    color: 'text.primary'
                                                                }
                                                            }}
                                                        />
                                                    </ListItemButton>
                                                </ListItem>
                                                {index < group.results.length - 1 && (
                                                    <Divider component="li" variant="inset" sx={{ ml: 2 }} />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </List>
                                </Collapse>
                            </Paper>
                        ))}
                    </Box>
                )}
            </Box>

            <ResultPopup 
                open={popupState.open}
                result={popupState.result}
                onClose={handleClosePopup}
                onNavigate={handleNavigateFromPopup}
                onBookmark={handleBookmarkFromPopup}
            />
        </Box>
    );
};
