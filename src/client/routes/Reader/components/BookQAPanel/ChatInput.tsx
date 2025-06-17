import React from 'react';
import {
    Box,
    TextField,
    IconButton,
    CircularProgress,
    FormControl,
    Select,
    MenuItem,
    Chip,
    Stack,
    Typography,
    InputAdornment,
    alpha,
    useTheme
} from '@mui/material';
import { Send, Clear, OpenInNew } from '@mui/icons-material';
import { ChatInputProps } from './types';
import { getAllModels } from '../../../../../server/ai/models';
import { buildContextPrompt } from '../../../../../apis/bookContentChat/utils';

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

    const quickQuestions = [
        'Explain Simply',
        'Summarize the last few sentences',
    ];

    const handleQuickQuestion = (quickQuestion: string) => {
        const fullQuestion = question.trim()
            ? `${quickQuestion}: ${question.trim()}`
            : quickQuestion;
        onQuestionChange(fullQuestion);
    };
    
    const handleClearInput = () => {
        onQuestionChange('');
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

    return (
        <Box
            sx={{
                p: 3,
                borderTop: fullScreen ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : 'none',
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
            }}
        >
            {/* Quick Questions */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                {quickQuestions.map((quickQ) => (
                    <Chip
                        key={quickQ}
                        label={quickQ}
                        size="small"
                        onClick={() => handleQuickQuestion(quickQ)}
                        disabled={loading}
                        sx={{
                            fontSize: fullScreen ? '0.75rem' : '0.6875rem',
                            height: 24,
                            borderRadius: '12px',
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            color: theme.palette.primary.main,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.15),
                                transform: 'scale(1.02)'
                            },
                            '&:active': {
                                transform: 'scale(0.98)'
                            }
                        }}
                    />
                ))}
            </Stack>

            {/* Main Input Row */}
            <Box
                component="form"
                onSubmit={onSubmit}
                sx={{
                    display: 'flex',
                    gap: 2,
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
                            fontSize: fullScreen ? '1rem' : '0.875rem',
                            borderRadius: '20px',
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
                            padding: '12px 16px',
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

                <IconButton
                    onClick={handleOpenInChatGPT}
                    disabled={!question.trim() || loading}
                    title="Open in ChatGPT"
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '8px',
                        backgroundColor: alpha(theme.palette.text.secondary, 0.08),
                        color: question.trim() && !loading
                            ? theme.palette.text.secondary
                            : theme.palette.action.disabled,
                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                        '&:hover': {
                            backgroundColor: alpha(theme.palette.text.secondary, 0.15),
                            transform: question.trim() && !loading ? 'scale(1.05)' : 'none'
                        },
                        '&:active': {
                            transform: question.trim() && !loading ? 'scale(0.95)' : 'none'
                        },
                        '&:disabled': {
                            backgroundColor: alpha(theme.palette.action.disabled, 0.12),
                            color: theme.palette.action.disabled
                        }
                    }}
                >
                    <OpenInNew sx={{ fontSize: 16 }} />
                </IconButton>

                <IconButton
                    type="submit"
                    disabled={!question.trim() || loading}
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: question.trim() && !loading
                            ? theme.palette.primary.main
                            : alpha(theme.palette.action.disabled, 0.12),
                        color: question.trim() && !loading
                            ? theme.palette.primary.contrastText
                            : theme.palette.action.disabled,
                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                        boxShadow: question.trim() && !loading
                            ? theme.palette.mode === 'light'
                                ? '0 2px 8px rgba(0,0,0,0.15)'
                                : '0 2px 8px rgba(0,0,0,0.3)'
                            : 'none',
                        '&:hover': {
                            backgroundColor: question.trim() && !loading
                                ? theme.palette.primary.dark
                                : alpha(theme.palette.action.disabled, 0.12),
                            transform: question.trim() && !loading ? 'scale(1.05)' : 'none'
                        },
                        '&:active': {
                            transform: question.trim() && !loading ? 'scale(0.95)' : 'none'
                        },
                        '&:disabled': {
                            backgroundColor: alpha(theme.palette.action.disabled, 0.12),
                            color: theme.palette.action.disabled
                        }
                    }}
                >
                    {loading ? (
                        <CircularProgress
                            size={20}
                            sx={{
                                color: theme.palette.action.disabled
                            }}
                        />
                    ) : (
                        <Send sx={{ fontSize: 20 }} />
                    )}
                </IconButton>
            </Box>

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