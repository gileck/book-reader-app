import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemButton,
    CircularProgress,
    Alert,
    Avatar,
    Collapse,
    useTheme,
    alpha
} from '@mui/material';
import {
    History as HistoryIcon,
    PlayArrow as PlayIcon,
    ExpandLess,
    ExpandMore
} from '@mui/icons-material';
import { getReadingSessions } from '@/apis/readingLogs/client';
import { ReadingSessionClient } from '@/apis/readingLogs/types';
import { useRouter } from '../../router';

const userId = '675e8c84f891e8b9da2b8c28'; // Hard-coded for now

export const ReadingHistory: React.FC = () => {
    const [sessions, setSessions] = useState<ReadingSessionClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const { navigate } = useRouter();
    const theme = useTheme();

    useEffect(() => {
        loadReadingSessions();
    }, []);

    const loadReadingSessions = async () => {
        try {
            setLoading(true);
            setError(null);

            const result = await getReadingSessions({
                userId,
                limit: 50
            });

            if (result.data?.success && result.data.sessions) {
                setSessions(result.data.sessions);
            } else {
                setError('Failed to load reading sessions');
            }
        } catch (error) {
            console.error('Error loading reading sessions:', error);
            setError('Error loading reading sessions');
        } finally {
            setLoading(false);
        }
    };

    const handlePlayFromChunk = (session: ReadingSessionClient, chunkIndex: number) => {
        navigate(`/?bookId=${session.bookId}&chapter=${session.chapterNumber}&chunk=${chunkIndex}`);
    };

    const handleExpandSession = (sessionId: string) => {
        setExpandedSession(expandedSession === sessionId ? null : sessionId);
    };

    const formatTime = (minutes: number): string => {
        if (minutes < 1) return '< 1m';
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    const formatDate = (date: Date): string => {
        const now = new Date();
        const sessionDate = new Date(date);
        const diffDays = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatDateTime = (date: Date): string => {
        return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const getBookInitials = (title: string): string => {
        return title
            .split(' ')
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join('');
    };

    if (loading) {
        return (
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="200px"
                sx={{ pt: 8 }}
            >
                <CircularProgress size={32} thickness={4} sx={{ color: '#007AFF' }} />
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
            {/* iOS-style Large Title Header */}
            <Box
                sx={{
                    pt: { xs: 3, sm: 4 },
                    pb: 2,
                    px: { xs: 2, sm: 3 },
                    borderBottom: `0.5px solid ${alpha(theme.palette.divider, 0.2)}`
                }}
            >
                <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                    <HistoryIcon sx={{ fontSize: 28, color: '#007AFF' }} />
                    <Typography
                        variant="h1"
                        sx={{
                            fontSize: { xs: 28, sm: 34 },
                            fontWeight: 700,
                            lineHeight: 1.1,
                            color: theme.palette.text.primary,
                            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                        }}
                    >
                        Reading Sessions
                    </Typography>
                </Box>
                <Typography
                    sx={{
                        fontSize: 15,
                        color: theme.palette.text.secondary,
                        fontWeight: 400,
                        lineHeight: 1.33
                    }}
                >
                    Your reading activity
                </Typography>
            </Box>

            {error && (
                <Box sx={{ p: 2 }}>
                    <Alert
                        severity="error"
                        sx={{
                            borderRadius: '8px',
                            fontSize: '15px'
                        }}
                    >
                        {error}
                    </Alert>
                </Box>
            )}

            {sessions.length === 0 ? (
                <Box
                    sx={{
                        textAlign: 'center',
                        pt: 8,
                        px: 3
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: 17,
                            fontWeight: 600,
                            color: theme.palette.text.secondary,
                            mb: 1
                        }}
                    >
                        No Reading Sessions
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 15,
                            color: theme.palette.text.secondary,
                            lineHeight: 1.33
                        }}
                    >
                        Start reading to see your sessions
                    </Typography>
                </Box>
            ) : (
                <List
                    sx={{
                        p: 0,
                        '& .MuiListItem-root': {
                            px: 0
                        }
                    }}
                >
                    {sessions.map((session, index) => (
                        <React.Fragment key={session.sessionId}>
                            {/* Main Session Item */}
                            <ListItem
                                disablePadding
                                sx={{
                                    borderBottom: index < sessions.length - 1 || expandedSession === session.sessionId
                                        ? `0.5px solid ${alpha(theme.palette.divider, 0.2)}`
                                        : 'none'
                                }}
                            >
                                <ListItemButton
                                    onClick={() => handleExpandSession(session.sessionId)}
                                    sx={{
                                        px: { xs: 2, sm: 3 },
                                        py: 1.5,
                                        minHeight: 60,
                                        '&:hover': {
                                            backgroundColor: alpha(theme.palette.action.hover, 0.08)
                                        },
                                        '&:active': {
                                            backgroundColor: alpha(theme.palette.action.hover, 0.12)
                                        }
                                    }}
                                >
                                    <ListItemAvatar sx={{ minWidth: 52 }}>
                                        <Avatar
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                backgroundColor: '#007AFF',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: 'white'
                                            }}
                                        >
                                            {getBookInitials(session.bookTitle)}
                                        </Avatar>
                                    </ListItemAvatar>

                                    <ListItemText
                                        primary={
                                            <Box>
                                                <Typography
                                                    sx={{
                                                        fontSize: 17,
                                                        fontWeight: 400,
                                                        lineHeight: 1.29,
                                                        color: theme.palette.text.primary,
                                                        mb: 0.25,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {session.bookTitle}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        fontSize: 15,
                                                        fontWeight: 400,
                                                        lineHeight: 1.33,
                                                        color: theme.palette.text.secondary,
                                                        mb: 0.25,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    Chapter {session.chapterNumber}: {session.chapterTitle}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Typography
                                                sx={{
                                                    fontSize: 13,
                                                    color: theme.palette.text.secondary,
                                                    lineHeight: 1.33
                                                }}
                                            >
                                                {formatDate(session.startTime)} • {formatTime(session.duration)} • {session.totalLines} lines
                                            </Typography>
                                        }
                                    />

                                    <Box display="flex" alignItems="center">
                                        {expandedSession === session.sessionId ?
                                            <ExpandLess sx={{ color: theme.palette.text.secondary, fontSize: 20 }} /> :
                                            <ExpandMore sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
                                        }
                                    </Box>
                                </ListItemButton>
                            </ListItem>

                            {/* Expanded Session Details */}
                            <Collapse in={expandedSession === session.sessionId} timeout="auto" unmountOnExit>
                                <Box
                                    sx={{
                                        backgroundColor: alpha(theme.palette.action.hover, 0.03),
                                        borderBottom: `0.5px solid ${alpha(theme.palette.divider, 0.2)}`
                                    }}
                                >
                                    {/* Session Stats */}
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-around',
                                            py: 2,
                                            px: 3,
                                            borderBottom: `0.5px solid ${alpha(theme.palette.divider, 0.1)}`
                                        }}
                                    >
                                        <Box textAlign="center">
                                            <Typography sx={{ fontSize: 22, fontWeight: 600, color: theme.palette.text.primary }}>
                                                {session.totalLines}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
                                                Lines
                                            </Typography>
                                        </Box>
                                        <Box textAlign="center">
                                            <Typography sx={{ fontSize: 22, fontWeight: 600, color: theme.palette.text.primary }}>
                                                {formatTime(session.duration)}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
                                                Duration
                                            </Typography>
                                        </Box>
                                        <Box textAlign="center">
                                            <Typography sx={{ fontSize: 22, fontWeight: 600, color: theme.palette.text.primary }}>
                                                Ch. {session.chapterNumber}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
                                                Chapter
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Chapter Info */}
                                    <Box sx={{ px: 3, py: 2, borderBottom: `0.5px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                                        <Typography sx={{ fontSize: 15, fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}>
                                            {session.chapterTitle}
                                        </Typography>
                                        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>
                                            {formatDateTime(session.startTime)} - {formatDateTime(session.endTime)}
                                        </Typography>
                                    </Box>

                                    {/* Individual Lines */}
                                    <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                                        {session.logs.map((log, logIndex) => (
                                            <ListItem
                                                key={log._id}
                                                disablePadding
                                                sx={{
                                                    borderBottom: logIndex < session.logs.length - 1
                                                        ? `0.5px solid ${alpha(theme.palette.divider, 0.06)}`
                                                        : 'none'
                                                }}
                                            >
                                                <ListItemButton
                                                    onClick={() => handlePlayFromChunk(session, log.chunkIndex)}
                                                    sx={{
                                                        px: 3,
                                                        py: 1.5,
                                                        alignItems: 'flex-start',
                                                        '&:hover': {
                                                            backgroundColor: alpha(theme.palette.action.hover, 0.06)
                                                        }
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            minWidth: 28,
                                                            height: 20,
                                                            borderRadius: '4px',
                                                            backgroundColor: alpha('#007AFF', 0.1),
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            mr: 2,
                                                            mt: 0.25
                                                        }}
                                                    >
                                                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#007AFF' }}>
                                                            {log.chunkIndex + 1}
                                                        </Typography>
                                                    </Box>

                                                    <Box flex={1} minWidth={0}>
                                                        <Typography
                                                            sx={{
                                                                fontSize: 15,
                                                                lineHeight: 1.4,
                                                                color: theme.palette.text.primary,
                                                                mb: 0.5
                                                            }}
                                                        >
                                                            {log.chunkText}
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                fontSize: 12,
                                                                color: theme.palette.text.secondary
                                                            }}
                                                        >
                                                            {formatDateTime(log.timestamp)}
                                                        </Typography>
                                                    </Box>

                                                    <PlayIcon
                                                        sx={{
                                                            fontSize: 16,
                                                            color: '#007AFF',
                                                            ml: 1,
                                                            mt: 0.5
                                                        }}
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        ))}
                                    </Box>
                                </Box>
                            </Collapse>
                        </React.Fragment>
                    ))}
                </List>
            )}
        </Box>
    );
}; 