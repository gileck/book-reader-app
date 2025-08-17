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
    alpha,
    FormControlLabel,
    Checkbox,
    TextField,
    IconButton,
    Paper
} from '@mui/material';
import { getAllModels } from '../../../../../server/ai/models';
import { AnswerLength, AnswerLevel, AnswerStyle } from '../../hooks/useBookQA';
import { getPromptPresets, createPromptPreset, updatePromptPreset, deletePromptPreset } from '../../../../../apis/promptPresets/client';
import type { PromptPresetClient } from '../../../../../apis/promptPresets/types';
import { Add, Edit, Delete, Save, Close } from '@mui/icons-material';

interface BookQAChatSettingsProps {
    open: boolean;
    onClose: () => void;
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    estimateBeforeSend: boolean;
    onEstimateBeforeSendChange: (value: boolean) => void;
    costApprovalThreshold: number;
    onCostApprovalThresholdChange: (value: number) => void;
    answerLength: AnswerLength;
    answerLevel: AnswerLevel;
    answerStyle: AnswerStyle;
    onAnswerLengthChange: (value: AnswerLength) => void;
    onAnswerLevelChange: (value: AnswerLevel) => void;
    onAnswerStyleChange: (value: AnswerStyle) => void;
}

export const BookQAChatSettings: React.FC<BookQAChatSettingsProps> = ({
    open,
    onClose,
    selectedModelId,
    onModelChange,
    estimateBeforeSend,
    onEstimateBeforeSendChange,
    costApprovalThreshold,
    onCostApprovalThresholdChange,
    answerLength,
    answerLevel,
    answerStyle,
    onAnswerLengthChange,
    onAnswerLevelChange,
    onAnswerStyleChange
}) => {
    const [localModelId, setLocalModelId] = useState(selectedModelId);
    const [localEstimateBeforeSend, setLocalEstimateBeforeSend] = useState(estimateBeforeSend);
    const [localCostApprovalThreshold, setLocalCostApprovalThreshold] = useState(costApprovalThreshold);
    const [localAnswerLength, setLocalAnswerLength] = useState(answerLength);
    const [localAnswerLevel, setLocalAnswerLevel] = useState(answerLevel);
    const [localAnswerStyle, setLocalAnswerStyle] = useState(answerStyle);
    const availableModels = getAllModels();
    const theme = useTheme();

    // Quick Prompts (Prompt Presets) state
    const [presets, setPresets] = useState<PromptPresetClient[]>([]);
    const [presetsLoading, setPresetsLoading] = useState<boolean>(false);
    const [creating, setCreating] = useState<boolean>(false);
    const [createTitle, setCreateTitle] = useState<string>('');
    const [createContent, setCreateContent] = useState<string>('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState<string>('');
    const [editContent, setEditContent] = useState<string>('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

    useEffect(() => {
        setLocalModelId(selectedModelId);
        setLocalEstimateBeforeSend(estimateBeforeSend);
        setLocalCostApprovalThreshold(costApprovalThreshold);
        setLocalAnswerLength(answerLength);
        setLocalAnswerLevel(answerLevel);
        setLocalAnswerStyle(answerStyle);
    }, [selectedModelId, estimateBeforeSend, costApprovalThreshold, answerLength, answerLevel, answerStyle]);

    // Load presets when dialog opens
    useEffect(() => {
        const loadPresets = async () => {
            if (!open) return;
            try {
                setPresetsLoading(true);
                const res = await getPromptPresets({});
                setPresets(res.data?.presets || []);
            } catch (e) {
                console.warn('Failed to load prompt presets', e);
            } finally {
                setPresetsLoading(false);
            }
        };
        loadPresets();
    }, [open]);

    const handleModelChange = (modelId: string) => {
        setLocalModelId(modelId);
        onModelChange(modelId);
    };

    const handleEstimateBeforeSendChange = (checked: boolean) => {
        setLocalEstimateBeforeSend(checked);
        onEstimateBeforeSendChange(checked);
    };

    const handleCostApprovalThresholdChange = (value: number) => {
        setLocalCostApprovalThreshold(value);
        onCostApprovalThresholdChange(value);
    };

    const handleAnswerLengthChange = (value: AnswerLength) => {
        setLocalAnswerLength(value);
        onAnswerLengthChange(value);
    };

    const handleAnswerLevelChange = (value: AnswerLevel) => {
        setLocalAnswerLevel(value);
        onAnswerLevelChange(value);
    };

    const handleAnswerStyleChange = (value: AnswerStyle) => {
        setLocalAnswerStyle(value);
        onAnswerStyleChange(value);
    };

    const handleClose = () => {
        onClose();
    };

    const handleStartCreate = () => {
        setCreating(true);
        setCreateTitle('');
        setCreateContent('');
    };

    const handleCancelCreate = () => {
        setCreating(false);
        setCreateTitle('');
        setCreateContent('');
    };

    const handleSaveCreate = async () => {
        if (!createTitle.trim() || !createContent.trim()) return;
        try {
            const res = await createPromptPreset({ title: createTitle.trim(), content: createContent.trim() });
            if (res.data?.preset) {
                setPresets(prev => [res.data.preset, ...prev]);
                handleCancelCreate();
            }
        } catch (e) {
            console.warn('Failed to create prompt preset', e);
        }
    };

    const handleStartEdit = (preset: PromptPresetClient) => {
        setEditingId(preset._id);
        setEditTitle(preset.title);
        setEditContent(preset.content);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditTitle('');
        setEditContent('');
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        if (!editTitle.trim() || !editContent.trim()) return;
        try {
            const res = await updatePromptPreset({ presetId: editingId, title: editTitle.trim(), content: editContent.trim() });
            if (res.data?.preset) {
                const updated = res.data.preset;
                setPresets(prev => prev.map(p => (p._id === editingId ? updated : p)));
                handleCancelEdit();
            }
        } catch (e) {
            console.warn('Failed to update prompt preset', e);
        }
    };

    const requestDeletePreset = (presetId: string) => {
        setConfirmDeleteId(presetId);
    };

    const handleCancelDelete = () => {
        setConfirmDeleteId(null);
    };

    const handleConfirmDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            setDeletingPresetId(confirmDeleteId);
            const res = await deletePromptPreset({ presetId: confirmDeleteId });
            if (res.data?.success) {
                setPresets(prev => prev.filter(p => p._id !== confirmDeleteId));
                if (editingId === confirmDeleteId) handleCancelEdit();
            }
        } catch (e) {
            console.warn('Failed to delete prompt preset', e);
        } finally {
            setDeletingPresetId(null);
            setConfirmDeleteId(null);
        }
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
                    {/* Quick Prompts management */}
                    <Typography
                        variant="h6"
                        sx={{
                            fontSize: '1.125rem',
                            fontWeight: 600,
                            mb: 1
                        }}
                    >
                        Quick Prompts
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2, lineHeight: 1.5 }}
                    >
                        Create and manage your saved prompts for fast Q&A.
                    </Typography>

                    {/* Create form */}
                    {!creating ? (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                            <Button variant="outlined" size="small" startIcon={<Add />} onClick={handleStartCreate}>
                                Add Preset
                            </Button>
                        </Box>
                    ) : (
                        <Paper elevation={0} sx={{ p: 2, mb: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, borderRadius: '12px' }}>
                            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                                <TextField
                                    label="Title"
                                    value={createTitle}
                                    onChange={(e) => setCreateTitle(e.target.value)}
                                    size="small"
                                />
                                <TextField
                                    label="Content"
                                    value={createContent}
                                    onChange={(e) => setCreateContent(e.target.value)}
                                    size="small"
                                    multiline
                                    minRows={2}
                                />
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                    <Button onClick={handleCancelCreate} startIcon={<Close />}>Cancel</Button>
                                    <Button onClick={handleSaveCreate} variant="contained" startIcon={<Save />} disabled={!createTitle.trim() || !createContent.trim()}>
                                        Save
                                    </Button>
                                </Box>
                            </Box>
                        </Paper>
                    )}

                    {/* Presets list */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                        {presetsLoading ? (
                            <Typography variant="body2" color="text.secondary">Loading…</Typography>
                        ) : presets.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">No presets yet.</Typography>
                        ) : (
                            presets.map((p) => (
                                <Paper key={p._id} elevation={0} sx={{ p: 1.5, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, borderRadius: '12px' }}>
                                    {editingId === p._id ? (
                                        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                                            <TextField
                                                label="Title"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                size="small"
                                            />
                                            <TextField
                                                label="Content"
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                size="small"
                                                multiline
                                                minRows={2}
                                            />
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                <Button onClick={handleCancelEdit} startIcon={<Close />}>Cancel</Button>
                                                <Button onClick={handleSaveEdit} variant="contained" startIcon={<Save />} disabled={!editTitle.trim() || !editContent.trim()}>
                                                    Save
                                                </Button>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                                                <Typography variant="subtitle2" noWrap>{p.title}</Typography>
                                                <Typography variant="body2" color="text.secondary" noWrap>{p.content}</Typography>
                                            </Box>
                                            <IconButton size="small" onClick={() => handleStartEdit(p)} aria-label="Edit preset">
                                                <Edit fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => requestDeletePreset(p._id)} aria-label="Delete preset" color="error">
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    )}
                                </Paper>
                            ))
                        )}
                    </Box>

                    <Divider sx={{ my: 3, opacity: 0.6 }} />
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

                    {/* Cost Estimation Settings */}
                    <Typography
                        variant="h6"
                        sx={{
                            fontSize: '1.125rem',
                            fontWeight: 600,
                            mb: 1
                        }}
                    >
                        Cost Management
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            mb: 3,
                            lineHeight: 1.5
                        }}
                    >
                        Control AI usage costs with estimation and approval settings.
                    </Typography>

                    {/* Estimate Before Send Checkbox */}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={localEstimateBeforeSend}
                                onChange={(e) => handleEstimateBeforeSendChange(e.target.checked)}
                                sx={{
                                    color: theme.palette.primary.main,
                                    '&.Mui-checked': {
                                        color: theme.palette.primary.main,
                                    },
                                }}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    Estimate cost before sending
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                                    Check AI response cost before making the request
                                </Typography>
                            </Box>
                        }
                        sx={{ mb: 3, alignItems: 'flex-start' }}
                    />

                    {/* Cost Approval Threshold */}
                    <TextField
                        fullWidth
                        label="Cost Approval Threshold"
                        type="number"
                        value={localCostApprovalThreshold}
                        onChange={(e) => handleCostApprovalThresholdChange(parseFloat(e.target.value) || 0)}
                        helperText={`Requests costing more than $${localCostApprovalThreshold.toFixed(4)} will require approval`}
                        disabled={!localEstimateBeforeSend}
                        inputProps={{
                            min: 0,
                            step: 0.0001,
                        }}
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
                    />

                    <Divider sx={{ my: 3, opacity: 0.6 }} />

                    {/* Answer Customization Settings */}
                    <Typography
                        variant="h6"
                        sx={{
                            fontSize: '1.125rem',
                            fontWeight: 600,
                            mb: 1
                        }}
                    >
                        Answer Customization
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            mb: 3,
                            lineHeight: 1.5
                        }}
                    >
                        Customize how the AI responds to your questions about the book.
                    </Typography>

                    {/* Answer Length */}
                    <FormControl
                        fullWidth
                        sx={{
                            mb: 2,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '12px',
                                backgroundColor: alpha(theme.palette.background.default, 0.6),
                            }
                        }}
                    >
                        <InputLabel sx={{ fontWeight: 500 }}>Answer Length</InputLabel>
                        <Select
                            value={localAnswerLength}
                            label="Answer Length"
                            onChange={(e) => handleAnswerLengthChange(e.target.value as AnswerLength)}
                        >
                            <MenuItem value="brief">Brief (1-2 sentences)</MenuItem>
                            <MenuItem value="short">Short (1 paragraph)</MenuItem>
                            <MenuItem value="medium">Medium (2-3 paragraphs)</MenuItem>
                            <MenuItem value="detailed">Detailed (comprehensive)</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Answer Level */}
                    <FormControl
                        fullWidth
                        sx={{
                            mb: 2,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '12px',
                                backgroundColor: alpha(theme.palette.background.default, 0.6),
                            }
                        }}
                    >
                        <InputLabel sx={{ fontWeight: 500 }}>Answer Level</InputLabel>
                        <Select
                            value={localAnswerLevel}
                            label="Answer Level"
                            onChange={(e) => handleAnswerLevelChange(e.target.value as AnswerLevel)}
                        >
                            <MenuItem value="simple">Simple (easy to understand)</MenuItem>
                            <MenuItem value="intermediate">Intermediate (general audience)</MenuItem>
                            <MenuItem value="advanced">Advanced (academic level)</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Answer Style */}
                    <FormControl
                        fullWidth
                        sx={{
                            mb: 3,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '12px',
                                backgroundColor: alpha(theme.palette.background.default, 0.6),
                            }
                        }}
                    >
                        <InputLabel sx={{ fontWeight: 500 }}>Answer Style</InputLabel>
                        <Select
                            value={localAnswerStyle}
                            label="Answer Style"
                            onChange={(e) => handleAnswerStyleChange(e.target.value as AnswerStyle)}
                        >
                            <MenuItem value="casual">Casual (friendly, conversational)</MenuItem>
                            <MenuItem value="professional">Professional (formal, academic)</MenuItem>
                            <MenuItem value="tutoring">Tutoring (patient, educational)</MenuItem>
                            <MenuItem value="analytical">Analytical (critical thinking)</MenuItem>
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
                            <strong>Note:</strong> Cost estimation helps control AI usage expenses.
                            When enabled, questions exceeding the threshold will require your approval before being sent.
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
            {/* Delete Preset Confirmation Dialog */}
            <Dialog open={!!confirmDeleteId} onClose={handleCancelDelete}>
                <DialogTitle>Delete Quick Prompt</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">Are you sure you want to delete this preset? This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} disabled={!!deletingPresetId}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={!!deletingPresetId}>
                        {deletingPresetId ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}; 