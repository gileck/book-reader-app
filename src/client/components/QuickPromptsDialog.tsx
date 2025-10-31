import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemText,
    Typography,
    IconButton,
    Box,
    CircularProgress,
    Tooltip
} from '@mui/material';
import { Close, Settings } from '@mui/icons-material';
import { getPromptPresets } from '../../apis/promptPresets/client';
import type { PromptPresetClient } from '../../apis/promptPresets/types';

interface QuickPromptsDialogProps {
    open: boolean;
    onClose: () => void;
    onSelectPrompt: (promptContent: string) => void;
    onOpenSettings?: () => void;
}

export const QuickPromptsDialog: React.FC<QuickPromptsDialogProps> = ({
    open,
    onClose,
    onSelectPrompt,
    onOpenSettings
}) => {
    const [presets, setPresets] = useState<PromptPresetClient[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            // Load presets when dialog opens
            setLoading(true);
            getPromptPresets({})
                .then(res => {
                    if (res.data?.presets) {
                        setPresets(res.data.presets);
                    }
                })
                .catch(err => {
                    console.warn('Failed to load prompt presets', err);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open]);

    const handleSelectPreset = (preset: PromptPresetClient) => {
        onSelectPrompt(preset.content);
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
                    borderRadius: 2,
                    maxWidth: 480
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 1
            }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Quick Prompts
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {onOpenSettings && (
                        <Tooltip title="Chat Settings">
                            <IconButton onClick={onOpenSettings} size="small">
                                <Settings />
                            </IconButton>
                        </Tooltip>
                    )}
                    <IconButton onClick={onClose} size="small">
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent sx={{ px: 2, pb: 2 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : presets.length === 0 ? (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            No quick prompts saved yet.
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            You can save prompts from the QA Chat by using the lightning bolt button.
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {presets.map(preset => (
                            <ListItemButton
                                key={preset._id}
                                onClick={() => handleSelectPreset(preset)}
                                sx={{
                                    borderRadius: 1,
                                    mb: 0.5,
                                    '&:hover': {
                                        backgroundColor: 'action.hover'
                                    }
                                }}
                            >
                                <ListItemText
                                    primary={preset.title}
                                    secondary={preset.content}
                                    primaryTypographyProps={{
                                        fontWeight: 500,
                                        noWrap: true
                                    }}
                                    secondaryTypographyProps={{
                                        noWrap: true,
                                        sx: { fontSize: '0.875rem' }
                                    }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
};

