import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Box,
    Divider,
    useTheme,
    alpha
} from '@mui/material';
import { getAllModels } from '../../../../server/ai/models';

interface BookQAChatSettingsProps {
    open: boolean;
    onClose: () => void;
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
}

export const BookQAChatSettings: React.FC<BookQAChatSettingsProps> = ({
    open,
    onClose,
    selectedModelId,
    onModelChange
}) => {
    const [localModelId, setLocalModelId] = useState(selectedModelId);
    const availableModels = getAllModels();
    const theme = useTheme();

    useEffect(() => {
        setLocalModelId(selectedModelId);
    }, [selectedModelId]);

    const handleModelChange = (modelId: string) => {
        setLocalModelId(modelId);
        onModelChange(modelId);
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            sx={{
                '& .MuiDialog-paper': {
                    borderRadius: '16px',
                    backgroundColor: theme.palette.background.paper,
                    boxShadow: theme.palette.mode === 'light'
                        ? '0 8px 32px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)'
                        : '0 8px 32px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.16)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)'
                }
            }}
        >
            <DialogTitle
                sx={{
                    px: 3,
                    py: 3,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`
                }}
            >
                <Typography
                    variant="h5"
                    sx={{
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        letterSpacing: '-0.02em'
                    }}
                >
                    Chat Settings
                </Typography>
            </DialogTitle>
            <DialogContent sx={{ px: 3, py: 3 }}>
                <Box>
                    <Typography
                        variant="h6"
                        sx={{
                            fontSize: '1.125rem',
                            fontWeight: 600,
                            mb: 1
                        }}
                    >
                        AI Model Selection
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            mb: 3,
                            lineHeight: 1.5
                        }}
                    >
                        Choose the AI model for answering your questions about the book.
                    </Typography>

                    <FormControl
                        fullWidth
                        sx={{
                            mb: 3,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '12px',
                                backgroundColor: alpha(theme.palette.background.default, 0.6),
                                transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                                '&:hover': {
                                    backgroundColor: alpha(theme.palette.background.default, 0.8)
                                },
                                '&.Mui-focused': {
                                    backgroundColor: theme.palette.background.paper,
                                    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`
                                }
                            }
                        }}
                    >
                        <InputLabel sx={{ fontWeight: 500 }}>Model</InputLabel>
                        <Select
                            value={localModelId}
                            label="Model"
                            onChange={(e) => handleModelChange(e.target.value)}
                        >
                            {availableModels.map((model) => (
                                <MenuItem
                                    key={model.id}
                                    value={model.id}
                                    sx={{
                                        py: 2,
                                        borderRadius: '8px',
                                        mx: 1,
                                        my: 0.5,
                                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                                        '&:hover': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                            transform: 'translateX(4px)'
                                        }
                                    }}
                                >
                                    <Box>
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontWeight: 500,
                                                fontSize: '0.9375rem'
                                            }}
                                        >
                                            {model.name}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                fontSize: '0.8125rem',
                                                fontWeight: 400
                                            }}
                                        >
                                            {model.provider} • {model.maxTokens.toLocaleString()} tokens
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Divider sx={{ my: 3, opacity: 0.6 }} />

                    <Box
                        sx={{
                            backgroundColor: alpha(theme.palette.info.main, 0.04),
                            borderRadius: '12px',
                            p: 2,
                            border: `1px solid ${alpha(theme.palette.info.main, 0.08)}`
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                lineHeight: 1.5,
                                fontWeight: 400
                            }}
                        >
                            <strong>Note:</strong> Different models may provide varying response quality and speed.
                            Your selection will be saved for future chat sessions.
                        </Typography>
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions
                sx={{
                    px: 3,
                    py: 3,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`
                }}
            >
                <Button
                    onClick={handleClose}
                    variant="contained"
                    sx={{
                        borderRadius: '12px',
                        px: 4,
                        py: 1.5,
                        fontSize: '0.9375rem',
                        fontWeight: 500,
                        textTransform: 'none',
                        minWidth: 100,
                        boxShadow: theme.palette.mode === 'light'
                            ? '0 2px 8px rgba(0,0,0,0.12)'
                            : '0 2px 8px rgba(0,0,0,0.24)',
                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                        '&:hover': {
                            transform: 'translateY(-1px)',
                            boxShadow: theme.palette.mode === 'light'
                                ? '0 4px 16px rgba(0,0,0,0.15)'
                                : '0 4px 16px rgba(0,0,0,0.3)'
                        },
                        '&:active': {
                            transform: 'scale(0.98)'
                        }
                    }}
                >
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
}; 