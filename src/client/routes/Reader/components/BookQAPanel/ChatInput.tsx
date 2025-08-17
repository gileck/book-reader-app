import React from 'react';
import {
    Box,
    TextField,
    IconButton,
    CircularProgress,
    FormControl,
    Select,
    MenuItem,
    Typography,
    InputAdornment,
    alpha,
    useTheme,
    Popover,
    List,
    ListItemButton,
    ListItemText,
    Tooltip
} from '@mui/material';
import { Send, Clear, OpenInNew, Bolt } from '@mui/icons-material';
import { ChatInputProps } from './types';
import { getAllModels } from '../../../../../server/ai/models';
import { buildContextPrompt } from '../../../../../apis/bookContentChat/utils';
import { getPromptPresets, createPromptPreset } from '../../../../../apis/promptPresets/client';
import type { PromptPresetClient } from '../../../../../apis/promptPresets/types';

export const ChatInput: React.FC<ChatInputProps> = ({
    question,
    loading,
    onQuestionChange,
    onSubmit,
    onKeyPress,
    fullScreen,
    contextLines,
    onContextLinesChange,
    selectedModelId,
    onModelChange,
    currentBookTitle,
    currentChapterTitle,
    currentChapterNumber,
    currentSentence,
    messages,
    getLastSentences,
    answerLength,
    answerLevel,
    answerStyle
}) => {
    const theme = useTheme();
    const [presets, setPresets] = React.useState<PromptPresetClient[]>([]);
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        // Load presets on mount
        getPromptPresets({}).then(res => {
            if (res.data?.presets) setPresets(res.data.presets);
        }).catch(err => {
            console.warn('Failed to load prompt presets', err);
        });
    }, []);

    const handleClearInput = () => {
        onQuestionChange('');
    };

    const handleOpenPresets = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        // Refresh presets on each open so newly added ones appear immediately
        getPromptPresets({}).then(res => {
            if (res.data?.presets) setPresets(res.data.presets);
        }).catch(() => {
            // noop
        });
    };

    const handleClosePresets = () => {
        setAnchorEl(null);
    };

    const handleSelectPreset = (preset: PromptPresetClient) => {
        onQuestionChange(preset.content);
        handleClosePresets();
    };

    const handleSaveAsPreset = async () => {
        if (!question.trim()) return;
        try {
            setSaving(true);
            const title = question.trim().slice(0, 40);
            const res = await createPromptPreset({ title, content: question.trim() });
            if (res.data?.preset) {
                setPresets(prev => [res.data.preset, ...prev]);
            }
        } catch (e) {
            console.warn('Failed to save preset', e);
        } finally {
            setSaving(false);
        }
    };

    const handleOpenInChatGPT = () => {
        if (!question.trim()) return;

        const conversationHistory = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            chapterContext: {
                number: msg.chapterContext.number,
                title: msg.chapterContext.title
            }
        }));

        const lastSentences = getLastSentences();

        const prompt = buildContextPrompt(
            currentBookTitle,
            currentChapterTitle,
            currentChapterNumber,
            currentSentence,
            lastSentences,
            question.trim(),
            conversationHistory,
            true,
            {
                answerLength: answerLength,
                answerLevel: answerLevel,
                answerStyle: answerStyle
            }
        );

        const chatGPTUrl = `https://chatgpt.com/?model=gpt-4o&q=${encodeURIComponent(prompt)}`;
        window.open(chatGPTUrl, '_blank');
    };

    const compactGap = fullScreen ? 2 : 1;
    const qpButtonSize = fullScreen ? 36 : 28;
    const auxButtonSize = fullScreen ? 36 : 28;
    const openIconSize = fullScreen ? 16 : 14;
    const sendButtonSize = fullScreen ? 44 : 36;
    const sendIconSize = fullScreen ? 20 : 18;

    const hasText = Boolean(question.trim());
    return (
        <Box
            sx={{
                p: fullScreen ? 3 : 1,
                borderTop: fullScreen ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : 'none',
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
            }}
        >
            {/* Main Input Row */}
            <Box
                component="form"
                onSubmit={onSubmit}
                sx={{
                    display: 'flex',
                    gap: compactGap,
                    alignItems: 'center',
                    mb: 2
                }}
            >
                <TextField
                    fullWidth
                    multiline
                    maxRows={fullScreen ? 6 : 3}
                    placeholder="Ask a question about the book..."
                    value={question}
                    onChange={(e) => onQuestionChange(e.target.value)}
                    onKeyPress={onKeyPress}
                    disabled={loading}
                    variant="outlined"
                    InputProps={{
                        endAdornment: question && (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={handleClearInput}
                                    disabled={loading}
                                    sx={{
                                        color: alpha(theme.palette.text.secondary, 0.7),
                                        '&:hover': {
                                            color: theme.palette.text.primary,
                                        }
                                    }}
                                >
                                    <Clear fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                    sx={{
                        '& .MuiInputBase-root': {
                            fontSize: fullScreen ? '1rem' : '0.8125rem',
                            borderRadius: fullScreen ? '20px' : '12px',
                            backgroundColor: alpha(theme.palette.background.default, 0.6),
                            border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                            '&:hover': {
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                backgroundColor: alpha(theme.palette.background.default, 0.8)
                            },
                            '&.Mui-focused': {
                                border: `2px solid ${theme.palette.primary.main}`,
                                backgroundColor: theme.palette.background.paper,
                                boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`
                            }
                        },
                        '& .MuiInputBase-input': {
                            padding: fullScreen ? '12px 16px' : '6px 10px',
                            lineHeight: 1.5
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none'
                        },
                        '& .MuiInputBase-input::placeholder': {
                            color: alpha(theme.palette.text.secondary, 0.6),
                            opacity: 1
                        }
                    }}
                />

                {hasText ? (
                <IconButton
                    onClick={handleOpenInChatGPT}
                    disabled={!hasText || loading}
                    title="Open in ChatGPT"
                    sx={{
                        width: auxButtonSize,
                        height: auxButtonSize,
                        borderRadius: '8px',
                        backgroundColor: alpha(theme.palette.text.secondary, 0.08),
                        color: hasText && !loading
                            ? theme.palette.text.secondary
                            : theme.palette.action.disabled,
                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                        '&:hover': {
                            backgroundColor: alpha(theme.palette.text.secondary, 0.15),
                            transform: hasText && !loading ? 'scale(1.05)' : 'none'
                        },
                        '&:active': {
                            transform: hasText && !loading ? 'scale(0.95)' : 'none'
                        },
                        '&:disabled': {
                            backgroundColor: alpha(theme.palette.action.disabled, 0.12),
                            color: theme.palette.action.disabled
                        }
                    }}
                >
                    <OpenInNew sx={{ fontSize: openIconSize }} />
                </IconButton>
                ) : (
                <Tooltip title="Quick Prompts">
                    <IconButton
                        onClick={handleOpenPresets}
                        disabled={loading}
                        sx={{
                            width: qpButtonSize,
                            height: qpButtonSize,
                            borderRadius: '8px',
                            backgroundColor: alpha(theme.palette.text.secondary, 0.08),
                            color: theme.palette.text.secondary,
                            '&:hover': { backgroundColor: alpha(theme.palette.text.secondary, 0.15) },
                            '&:disabled': { backgroundColor: alpha(theme.palette.action.disabled, 0.12), color: theme.palette.action.disabled }
                        }}
                    >
                        <Bolt sx={{ fontSize: openIconSize }} />
                    </IconButton>
                </Tooltip>
                )}

                {hasText && (
                <IconButton
                    type="submit"
                    disabled={!hasText || loading}
                    sx={{
                        width: sendButtonSize,
                        height: sendButtonSize,
                        borderRadius: '50%',
                        backgroundColor: hasText && !loading
                            ? theme.palette.primary.main
                            : alpha(theme.palette.action.disabled, 0.12),
                        color: hasText && !loading
                            ? theme.palette.primary.contrastText
                            : theme.palette.action.disabled,
                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                        boxShadow: hasText && !loading
                            ? theme.palette.mode === 'light'
                                ? '0 2px 8px rgba(0,0,0,0.15)'
                                : '0 2px 8px rgba(0,0,0,0.3)'
                            : 'none',
                        '&:hover': {
                            backgroundColor: hasText && !loading
                                ? theme.palette.primary.dark
                                : alpha(theme.palette.action.disabled, 0.12),
                            transform: hasText && !loading ? 'scale(1.05)' : 'none'
                        },
                        '&:active': {
                            transform: hasText && !loading ? 'scale(0.95)' : 'none'
                        },
                        '&:disabled': {
                            backgroundColor: alpha(theme.palette.action.disabled, 0.12),
                            color: theme.palette.action.disabled
                        }
                    }}
                >
                    {loading ? (
                        <CircularProgress
                            size={fullScreen ? 20 : 18}
                            sx={{
                                color: theme.palette.action.disabled
                            }}
                        />
                    ) : (
                        <Send sx={{ fontSize: sendIconSize }} />
                    )}
                </IconButton>
                )}
            </Box>

            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={handleClosePresets}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                PaperProps={{ sx: { borderRadius: '12px', minWidth: 280 } }}
            >
                <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, color: 'text.secondary' }}>
                        Quick Prompts
                    </Typography>
                    <List dense disablePadding>
                        {presets.length === 0 ? (
                            <Typography variant="body2" sx={{ px: 2, py: 1.5, color: 'text.secondary' }}>
                                No presets yet
                            </Typography>
                        ) : (
                            presets.map(p => (
                                <ListItemButton key={p._id} onClick={() => handleSelectPreset(p)}>
                                    <ListItemText
                                        primary={p.title}
                                        secondary={p.content}
                                        primaryTypographyProps={{ noWrap: true }}
                                        secondaryTypographyProps={{ noWrap: true }}
                                    />
                                </ListItemButton>
                            ))
                        )}
                    </List>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                        <Tooltip title={question.trim() ? 'Save current input as preset' : 'Type something to save'}>
                            <span>
                                <IconButton onClick={handleSaveAsPreset} disabled={!question.trim() || saving}>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>Save</Typography>
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                </Box>
            </Popover>

            {/* Current Settings Indication */}
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: fullScreen ? '0.6875rem' : '0.625rem',
                        color: alpha(theme.palette.text.secondary, 0.7),
                        fontWeight: 400
                    }}
                >
                    Settings:
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: fullScreen ? '0.6875rem' : '0.625rem',
                        color: alpha(theme.palette.text.secondary, 0.8),
                        fontWeight: 500,
                        textTransform: 'capitalize'
                    }}
                >
                    {answerLength === 'brief' ? 'Brief' : 
                     answerLength === 'short' ? 'Short' : 
                     answerLength === 'medium' ? 'Medium' : 'Detailed'}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: fullScreen ? '0.6875rem' : '0.625rem',
                        color: alpha(theme.palette.text.secondary, 0.5)
                    }}
                >
                    •
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: fullScreen ? '0.6875rem' : '0.625rem',
                        color: alpha(theme.palette.text.secondary, 0.8),
                        fontWeight: 500,
                        textTransform: 'capitalize'
                    }}
                >
                    {answerLevel === 'simple' ? 'Simple' : 
                     answerLevel === 'intermediate' ? 'Intermediate' : 'Advanced'}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: fullScreen ? '0.6875rem' : '0.625rem',
                        color: alpha(theme.palette.text.secondary, 0.5)
                    }}
                >
                    •
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: fullScreen ? '0.6875rem' : '0.625rem',
                        color: alpha(theme.palette.text.secondary, 0.8),
                        fontWeight: 500,
                        textTransform: 'capitalize'
                    }}
                >
                    {answerStyle === 'casual' ? 'Casual' : 
                     answerStyle === 'professional' ? 'Professional' : 
                     answerStyle === 'tutoring' ? 'Tutoring' : 'Analytical'}
                </Typography>
            </Box>

            {/* Context Lines and Model Selectors */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            color: 'text.secondary',
                            minWidth: 'auto'
                        }}
                    >
                        Context:
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 60 }}>
                        <Select
                            value={contextLines}
                            onChange={(e) => onContextLinesChange(Number(e.target.value))}
                            disabled={loading}
                            sx={{
                                fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                                height: 28,
                                borderRadius: '6px',
                                backgroundColor: alpha(theme.palette.background.default, 0.6),
                                '& .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${alpha(theme.palette.divider, 0.12)}`
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${theme.palette.primary.main}`
                                }
                            }}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                <MenuItem key={num} value={num} sx={{ fontSize: fullScreen ? '0.75rem' : '0.6875rem' }}>
                                    {num}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            color: 'text.secondary'
                        }}
                    >
                        lines
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            color: 'text.secondary',
                            minWidth: 'auto'
                        }}
                    >
                        Model:
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                            value={selectedModelId}
                            onChange={(e) => onModelChange(e.target.value)}
                            disabled={loading}
                            sx={{
                                fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                                height: 28,
                                borderRadius: '6px',
                                backgroundColor: alpha(theme.palette.background.default, 0.6),
                                '& .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${alpha(theme.palette.divider, 0.12)}`
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    border: `1px solid ${theme.palette.primary.main}`
                                }
                            }}
                        >
                            {getAllModels().map((model) => (
                                <MenuItem
                                    key={model.id}
                                    value={model.id}
                                    sx={{ fontSize: fullScreen ? '0.75rem' : '0.6875rem' }}
                                >
                                    {model.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Box>
        </Box>
    );
}; 