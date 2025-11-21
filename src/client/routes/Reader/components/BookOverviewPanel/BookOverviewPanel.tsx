import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemSecondaryAction,
    CircularProgress,
    Alert,
    Chip,
    Stack,
    SelectChangeEvent,
    Tabs,
    Tab
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ListAltIcon from '@mui/icons-material/ListAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReactMarkdown from 'react-markdown';
import { getAllModels, AIModelDefinition } from '@/server/ai/models';
import { OverviewFormat, OverviewLength, OverviewLevel, SavedOverview } from '@/apis/chapterOverview/types';

interface BookOverviewPanelProps {
    isGenerating: boolean;
    overviews: SavedOverview[];
    selectedOverviewId: string | null;
    selectedOverview: SavedOverview | null;
    selectedModelId: string;
    selectedFormat: OverviewFormat;
    selectedLength: OverviewLength;
    selectedLevel: OverviewLevel;
    error: string | null;
    onModelChange: (modelId: string) => void;
    onFormatChange: (format: OverviewFormat) => void;
    onLengthChange: (length: OverviewLength) => void;
    onLevelChange: (level: OverviewLevel) => void;
    onSelectOverview: (overviewId: string | null) => void;
    onDeleteOverview: (overviewId: string) => void;
    onGenerateOverview: () => void;
    onClearError: () => void;
}

const formatLabels: Record<OverviewFormat, string> = {
    'summary': 'Chapter Summary',
    'key-points': 'Key Points',
    'qa': 'Q&A From Chapter',
    'comprehensive': 'Comprehensive Overview'
};

const lengthLabels: Record<OverviewLength, string> = {
    'short': 'Short',
    'medium': 'Medium',
    'long': 'Long'
};

const levelLabels: Record<OverviewLevel, string> = {
    'basic': 'Basic',
    'intermediate': 'Intermediate',
    'advanced': 'Advanced'
};

export const BookOverviewPanel: React.FC<BookOverviewPanelProps> = ({
    isGenerating,
    overviews,
    selectedOverviewId,
    selectedOverview,
    selectedModelId,
    selectedFormat,
    selectedLength,
    selectedLevel,
    error,
    onModelChange,
    onFormatChange,
    onLengthChange,
    onLevelChange,
    onSelectOverview,
    onDeleteOverview,
    onGenerateOverview,
    onClearError
}) => {
    const availableModels = useMemo(() => getAllModels(), []);
    const [activeSubTab, setActiveSubTab] = useState<'generate' | 'library' | 'view'>('generate');
    const wasGeneratingRef = useRef(false);

    // Auto-switch to view tab only when generation completes (not on manual tab changes)
    useEffect(() => {
        if (wasGeneratingRef.current && !isGenerating && selectedOverview) {
            setActiveSubTab('view');
        }
        wasGeneratingRef.current = isGenerating;
    }, [isGenerating, selectedOverview]);

    const handleModelChange = (event: SelectChangeEvent) => {
        onModelChange(event.target.value);
    };

    const handleFormatChange = (event: SelectChangeEvent) => {
        onFormatChange(event.target.value as OverviewFormat);
    };

    const handleLengthChange = (event: SelectChangeEvent) => {
        onLengthChange(event.target.value as OverviewLength);
    };

    const handleLevelChange = (event: SelectChangeEvent) => {
        onLevelChange(event.target.value as OverviewLevel);
    };

    const handleSubTabChange = (_: React.SyntheticEvent, newTab: 'generate' | 'library' | 'view') => {
        setActiveSubTab(newTab);
    };

    const handleOverviewSelect = (overviewId: string) => {
        onSelectOverview(overviewId);
        setActiveSubTab('view');
    };

    const handleRegenerate = () => {
        if (selectedOverview) {
            // Set the form values to match the selected overview
            onModelChange(selectedOverview.modelId);
            onFormatChange(selectedOverview.format);
            onLengthChange(selectedOverview.length);
            onLevelChange(selectedOverview.level);
            
            // Trigger generation with a small delay to ensure state is updated
            setTimeout(() => {
                onGenerateOverview();
            }, 0);
        }
    };

    return (
        <Box sx={{ 
            maxWidth: 1000, 
            mx: 'auto',
            height: 'calc(100vh - 56px - 120px)', // Tab bar + audio controls
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Error Display */}
            {error && (
                <Alert severity="error" onClose={onClearError} sx={{ m: 2, mb: 0 }}>
                    {error}
                </Alert>
            )}

            {/* Sub-tabs */}
            <Box sx={{
                borderBottom: 1,
                borderColor: 'divider',
                backgroundColor: 'background.paper'
            }}>
                <Tabs
                    value={activeSubTab}
                    onChange={handleSubTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{
                        minHeight: 48,
                        '& .MuiTab-root': {
                            minHeight: 48,
                            textTransform: 'none',
                            fontSize: '0.95rem',
                            fontWeight: 500
                        }
                    }}
                >
                    <Tab 
                        icon={<AutoAwesomeIcon />} 
                        iconPosition="start" 
                        label="Generate" 
                        value="generate" 
                    />
                    <Tab 
                        icon={<ListAltIcon />} 
                        iconPosition="start" 
                        label={`Library (${overviews.length})`}
                        value="library" 
                    />
                    <Tab 
                        icon={<VisibilityIcon />} 
                        iconPosition="start" 
                        label="View" 
                        value="view"
                        disabled={!selectedOverview}
                    />
                </Tabs>
            </Box>

            {/* Tab Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {/* Generate Tab */}
                {activeSubTab === 'generate' && (
                    <Box sx={{ maxWidth: 500, mx: 'auto' }}>
                        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                            <AutoAwesomeIcon color="primary" fontSize="large" />
                            Generate Overview
                        </Typography>

                        <Stack spacing={2.5}>
                            <FormControl fullWidth size="small">
                                <InputLabel>AI Model</InputLabel>
                                <Select
                                    value={selectedModelId}
                                    label="AI Model"
                                    onChange={handleModelChange}
                                    disabled={isGenerating}
                                >
                                    {availableModels.map((model: AIModelDefinition) => (
                                        <MenuItem key={model.id} value={model.id}>
                                            {model.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth size="small">
                                <InputLabel>Format</InputLabel>
                                <Select
                                    value={selectedFormat}
                                    label="Format"
                                    onChange={handleFormatChange}
                                    disabled={isGenerating}
                                >
                                    {(Object.keys(formatLabels) as OverviewFormat[]).map(format => (
                                        <MenuItem key={format} value={format}>
                                            {formatLabels[format]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth size="small">
                                <InputLabel>Length</InputLabel>
                                <Select
                                    value={selectedLength}
                                    label="Length"
                                    onChange={handleLengthChange}
                                    disabled={isGenerating}
                                >
                                    {(Object.keys(lengthLabels) as OverviewLength[]).map(length => (
                                        <MenuItem key={length} value={length}>
                                            {lengthLabels[length]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth size="small">
                                <InputLabel>Level</InputLabel>
                                <Select
                                    value={selectedLevel}
                                    label="Level"
                                    onChange={handleLevelChange}
                                    disabled={isGenerating}
                                >
                                    {(Object.keys(levelLabels) as OverviewLevel[]).map(level => (
                                        <MenuItem key={level} value={level}>
                                            {levelLabels[level]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Button
                                variant="contained"
                                fullWidth
                                size="large"
                                onClick={() => onGenerateOverview()}
                                disabled={isGenerating}
                                startIcon={isGenerating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
                                sx={{ mt: 2 }}
                            >
                                {isGenerating ? 'Generating...' : 'Generate Overview'}
                            </Button>
                        </Stack>
                    </Box>
                )}

                {/* Library Tab */}
                {activeSubTab === 'library' && (
                    <Box>
                        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                            <ListAltIcon color="primary" fontSize="large" />
                            Saved Overviews
                        </Typography>
                        
                        {overviews.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 8 }}>
                                <ListAltIcon sx={{ fontSize: 64, color: 'action.disabled', mb: 2 }} />
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    No overviews yet
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Generate your first overview in the Generate tab
                                </Typography>
                            </Box>
                        ) : (
                            <List sx={{ maxWidth: 600, mx: 'auto' }}>
                                {overviews.map((overview) => (
                                    <ListItem
                                        key={overview.id}
                                        disablePadding
                                        sx={{
                                            mb: 1,
                                            borderRadius: 2,
                                            border: 1,
                                            borderColor: selectedOverviewId === overview.id ? 'primary.main' : 'divider',
                                            backgroundColor: selectedOverviewId === overview.id ? 'action.selected' : 'background.paper'
                                        }}
                                    >
                                        <ListItemButton
                                            selected={selectedOverviewId === overview.id}
                                            onClick={() => handleOverviewSelect(overview.id)}
                                            sx={{ p: 2 }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Typography variant="subtitle1" fontWeight={600}>
                                                        {formatLabels[overview.format]}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Box sx={{ mt: 1 }}>
                                                        <Stack direction="row" spacing={1} sx={{ mb: 0.5 }}>
                                                            <Chip label={lengthLabels[overview.length]} size="small" />
                                                            <Chip label={levelLabels[overview.level]} size="small" />
                                                        </Stack>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {new Date(overview.timestamp).toLocaleDateString()} • {overview.modelId}
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                            <ListItemSecondaryAction>
                                                <IconButton
                                                    edge="end"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteOverview(overview.id);
                                                    }}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </ListItemSecondaryAction>
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>
                )}

                {/* View Tab */}
                {activeSubTab === 'view' && (
                    <Box>
                        {isGenerating ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                                <CircularProgress size={48} />
                                <Typography variant="body1" sx={{ mt: 2 }}>
                                    Generating overview...
                                </Typography>
                            </Box>
                        ) : selectedOverview ? (
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Typography variant="h5">
                                    {formatLabels[selectedOverview.format]}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<RefreshIcon />}
                                    onClick={handleRegenerate}
                                    disabled={isGenerating}
                                    sx={{ ml: 2, flexShrink: 0 }}
                                >
                                    Regenerate
                                </Button>
                            </Box>
                            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip label={lengthLabels[selectedOverview.length]} size="small" />
                                <Chip label={levelLabels[selectedOverview.level]} size="small" />
                                {selectedOverview.cost && (
                                    <Chip label={`Cost: $${selectedOverview.cost.toFixed(4)}`} size="small" color="secondary" />
                                )}
                            </Box>
                            <Divider sx={{ mb: 3 }} />
                            <Box
                                sx={{
                                    '& h1': { fontSize: '2rem', fontWeight: 600, mt: 3, mb: 2 },
                                    '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 3, mb: 1.5 },
                                    '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
                                    '& h4': { fontSize: '1.1rem', fontWeight: 600, mt: 2, mb: 1 },
                                    '& p': { mb: 2, lineHeight: 1.8 },
                                    '& ul, & ol': { mb: 2, pl: 3 },
                                    '& li': { mb: 1, lineHeight: 1.6 },
                                    '& strong': { 
                                        fontWeight: 700,
                                        color: 'text.primary',
                                        opacity: 1
                                    },
                                    '& em': { fontStyle: 'italic', color: 'text.secondary' },
                                    '& code': { 
                                        backgroundColor: 'action.hover', 
                                        padding: '2px 6px', 
                                        borderRadius: 1,
                                        fontFamily: 'monospace',
                                        fontSize: '0.9em'
                                    },
                                    '& pre': {
                                        backgroundColor: 'action.hover',
                                        p: 2,
                                        borderRadius: 1,
                                        overflow: 'auto',
                                        mb: 2
                                    },
                                    '& blockquote': {
                                        borderLeft: 4,
                                        borderColor: 'primary.main',
                                        pl: 2,
                                        ml: 0,
                                        my: 2,
                                        fontStyle: 'italic',
                                        color: 'text.secondary'
                                    }
                                }}
                            >
                                <ReactMarkdown>{selectedOverview.content}</ReactMarkdown>
                            </Box>
                        </Box>
                        ) : (
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                py: 8,
                                textAlign: 'center',
                                color: 'text.secondary'
                            }}>
                                <VisibilityIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                                <Typography variant="h6" gutterBottom>
                                    No Overview Selected
                                </Typography>
                                <Typography variant="body2">
                                    Generate a new overview or select one from the library
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

