import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
} from '@mui/material';

interface QuestionInputDialogProps {
    open: boolean;
    sentenceText: string;
    onSubmit: (question: string) => void;
    onClose: () => void;
}

/**
 * QuestionInputDialog - Dialog for asking a question about a specific sentence
 * 
 * Shows the sentence context and provides an input field for the user's question.
 * When submitted, navigates to QA chat with the question.
 */
export const QuestionInputDialog: React.FC<QuestionInputDialogProps> = ({
    open,
    sentenceText,
    onSubmit,
    onClose,
}) => {
    const [question, setQuestion] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input when dialog opens
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    // Reset question when dialog closes
    useEffect(() => {
        if (!open) {
            setQuestion('');
        }
    }, [open]);

    const handleSubmit = () => {
        const trimmedQuestion = question.trim();
        if (trimmedQuestion) {
            onSubmit(trimmedQuestion);
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                    '@media (prefers-color-scheme: dark)': {
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    }
                }
            }}
        >
            <DialogTitle
                sx={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    pb: 1,
                }}
            >
                Ask a Question
            </DialogTitle>

            <DialogContent sx={{ pt: 2 }}>
                {/* Show the sentence context */}
                <Box
                    sx={{
                        p: 2,
                        mb: 2,
                        borderRadius: '8px',
                        backgroundColor: 'action.hover',
                        borderLeft: '3px solid',
                        borderColor: 'primary.main',
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            mb: 0.5,
                            color: 'text.secondary',
                            fontWeight: 500,
                        }}
                    >
                        Selected sentence:
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            fontStyle: 'italic',
                            lineHeight: 1.5,
                        }}
                    >
                        {sentenceText}
                    </Typography>
                </Box>

                {/* Question input */}
                <TextField
                    inputRef={inputRef}
                    fullWidth
                    multiline
                    rows={3}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your question here..."
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                        },
                    }}
                />

                <Typography
                    variant="caption"
                    sx={{
                        display: 'block',
                        mt: 1,
                        color: 'text.secondary',
                    }}
                >
                    Press Enter to submit, Shift+Enter for new line
                </Typography>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    sx={{
                        borderRadius: '8px',
                        textTransform: 'none',
                        px: 2,
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={!question.trim()}
                    sx={{
                        borderRadius: '8px',
                        textTransform: 'none',
                        px: 3,
                    }}
                >
                    Ask
                </Button>
            </DialogActions>
        </Dialog>
    );
};

