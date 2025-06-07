import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    useTheme,
    alpha
} from '@mui/material';
import { Warning } from '@mui/icons-material';

interface CostApprovalDialogProps {
    open: boolean;
    estimatedCost: number;
    onApprove: () => void;
    onCancel: () => void;
}

export const CostApprovalDialog: React.FC<CostApprovalDialogProps> = ({
    open,
    estimatedCost,
    onApprove,
    onCancel
}) => {
    const theme = useTheme();

    return (
        <Dialog
            open={open}
            onClose={onCancel}
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
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                }}
            >
                <Warning sx={{ color: theme.palette.warning.main, fontSize: 28 }} />
                <Typography
                    variant="h6"
                    sx={{
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        letterSpacing: '-0.02em'
                    }}
                >
                    Cost Approval Required
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ px: 3, py: 3 }}>
                <Box>
                    <Typography
                        variant="body1"
                        sx={{
                            mb: 2,
                            lineHeight: 1.6
                        }}
                    >
                        This AI request has an estimated cost that exceeds your approval threshold.
                    </Typography>

                    <Box
                        sx={{
                            backgroundColor: alpha(theme.palette.warning.main, 0.08),
                            borderRadius: '12px',
                            p: 3,
                            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                            textAlign: 'center',
                            mb: 3
                        }}
                    >
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                color: theme.palette.warning.main,
                                mb: 1
                            }}
                        >
                            ${estimatedCost.toFixed(4)}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            Estimated cost for this request
                        </Typography>
                    </Box>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            textAlign: 'center',
                            lineHeight: 1.5
                        }}
                    >
                        Would you like to proceed with this AI request?
                        You can adjust your cost threshold in the chat settings.
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions
                sx={{
                    px: 3,
                    py: 3,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    gap: 2
                }}
            >
                <Button
                    onClick={onCancel}
                    variant="outlined"
                    sx={{
                        borderRadius: '12px',
                        px: 3,
                        py: 1.5,
                        fontSize: '0.9375rem',
                        fontWeight: 500,
                        textTransform: 'none',
                        minWidth: 100,
                        borderColor: alpha(theme.palette.divider, 0.3),
                        color: theme.palette.text.secondary,
                        '&:hover': {
                            borderColor: alpha(theme.palette.divider, 0.5),
                            backgroundColor: alpha(theme.palette.action.hover, 0.04)
                        }
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={onApprove}
                    variant="contained"
                    sx={{
                        borderRadius: '12px',
                        px: 3,
                        py: 1.5,
                        fontSize: '0.9375rem',
                        fontWeight: 500,
                        textTransform: 'none',
                        minWidth: 120,
                        backgroundColor: theme.palette.warning.main,
                        color: theme.palette.warning.contrastText,
                        boxShadow: theme.palette.mode === 'light'
                            ? '0 2px 8px rgba(0,0,0,0.12)'
                            : '0 2px 8px rgba(0,0,0,0.24)',
                        transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1.1)',
                        '&:hover': {
                            backgroundColor: theme.palette.warning.dark,
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
                    Approve & Send
                </Button>
            </DialogActions>
        </Dialog>
    );
}; 