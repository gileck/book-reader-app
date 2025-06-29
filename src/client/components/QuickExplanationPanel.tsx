import React from 'react';
import {
    Paper,
    Box,
    Typography,
    IconButton,
    Button,
    CircularProgress,
    Collapse
} from '@mui/material';
import {
    Close as CloseIcon,
    OpenInNew as OpenIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';

interface QuickExplanationPanelProps {
    open: boolean;
    loading: boolean;
    selectedText: string;
    answer: string;
    onClose: () => void;
    onOpenInQAPanel: () => void;
}

export const QuickExplanationPanel: React.FC<QuickExplanationPanelProps> = ({
    open,
    loading,
    selectedText,
    answer,
    onClose,
    onOpenInQAPanel
}) => {
    return (
        <Collapse in={open} timeout={300}>
            <Paper
                elevation={8}
                sx={{
                    position: 'fixed',
                    bottom: { xs: 80, sm: 100 },
                    left: { xs: 16, sm: 24 },
                    right: { xs: 16, sm: 24 },
                    maxWidth: 600,
                    mx: 'auto',
                    zIndex: 1050,
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        px: 2,
                        py: 1.5,
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Quick Explanation
                    </Typography>
                    <IconButton
                        onClick={onClose}
                        size="small"
                        sx={{ color: 'inherit' }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                {/* Content */}
                <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                    {/* Selected Text */}
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            Selected Text:
                        </Typography>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 1.5,
                                mt: 0.5,
                                backgroundColor: 'background.default',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider'
                            }}
                        >
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    fontStyle: 'italic',
                                    color: 'text.primary',
                                    fontWeight: 500
                                }}
                            >
                                &ldquo;{selectedText}&rdquo;
                            </Typography>
                        </Paper>
                    </Box>

                    {/* AI Answer */}
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            Explanation:
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                            {loading ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                                    <CircularProgress size={20} />
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                        Getting explanation...
                                    </Typography>
                                </Box>
                            ) : (
                                <Box sx={{ 
                                    '& p': { margin: 0, marginBottom: '0.5rem' },
                                    '& p:last-child': { marginBottom: 0 },
                                    '& ul, & ol': { marginTop: 0, marginBottom: '0.5rem', paddingLeft: '1.5rem' },
                                    '& li': { marginBottom: '0.25rem' },
                                    '& strong': { fontWeight: 600 },
                                    '& em': { fontStyle: 'italic' },
                                    '& code': { 
                                        backgroundColor: 'rgba(0,0,0,0.04)', 
                                        padding: '0.125rem 0.25rem', 
                                        borderRadius: '0.25rem',
                                        fontSize: '0.875em'
                                    }
                                }}>
                                    <ReactMarkdown>
                                        {answer || 'No explanation available.'}
                                    </ReactMarkdown>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>

                {/* Footer */}
                <Box
                    sx={{
                        px: 2,
                        py: 1.5,
                        backgroundColor: 'grey.50',
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'flex-end'
                    }}
                >
                    <Button
                        onClick={onOpenInQAPanel}
                        size="small"
                        variant="outlined"
                        startIcon={<OpenIcon />}
                        sx={{ fontSize: '0.75rem' }}
                    >
                        Open in QA Panel
                    </Button>
                </Box>
            </Paper>
        </Collapse>
    );
}; 