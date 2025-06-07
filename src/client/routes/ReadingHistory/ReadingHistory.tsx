import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    CircularProgress,
    Alert,
    Chip,
    Divider,
    IconButton
} from '@mui/material';
import {
    History as HistoryIcon,
    MenuBook as BookIcon,
    Schedule as TimeIcon,
    PlayArrow as PlayIcon,
    ExpandMore as ExpandMoreIcon,
    AccessTime as ClockIcon
} from '@mui/icons-material';
import { getReadingSessions } from '@/apis/readingLogs/client';
import { ReadingSessionClient } from '@/apis/readingLogs/types';
import { useRouter } from '../../router';

const userId = '675e8c84f891e8b9da2b8c28'; // Hard-coded for now

export const ReadingHistory: React.FC = () => {
    const [sessions, setSessions] = useState<ReadingSessionClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { navigate } = useRouter();

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

    const handleContinueReading = (session: ReadingSessionClient) => {
        // Navigate to the book with the chapter from the session
        navigate(`/?bookId=${session.bookId}&chapter=${session.chapterNumber}`);
    };

    const handlePlayFromChunk = (session: ReadingSessionClient, chunkIndex: number) => {
        // Navigate to the specific chunk
        navigate(`/?bookId=${session.bookId}&chapter=${session.chapterNumber}&chunk=${chunkIndex}`);
    };

    const formatTime = (minutes: number): string => {
        if (minutes < 1) {
            return '< 1m';
        }
        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        }
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
        return sessionDate.toLocaleDateString();
    };

    const formatDateTime = (date: Date): string => {
        return new Date(date).toLocaleString();
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box p={3} maxWidth="1200px" mx="auto">
            <Typography variant="h4" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
                Reading Sessions
            </Typography>

            <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                Your detailed reading log showing all your reading sessions and individual sentences you&apos;ve listened to.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {sessions.length === 0 ? (
                <Card>
                    <CardContent>
                        <Typography variant="h6" align="center" color="text.secondary">
                            No reading sessions yet
                        </Typography>
                        <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 1 }}>
                            Start reading with audio to see your reading sessions here
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                    {sessions.map((session, index) => (
                        <Card key={session.sessionId} elevation={2}>
                            <Accordion>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls={`session-${index}-content`}
                                    id={`session-${index}-header`}
                                >
                                    <Box display="flex" flexDirection="column" width="100%">
                                        {/* Session Header */}
                                        <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <BookIcon color="primary" />
                                                <Typography variant="h6" component="span">
                                                    {session.bookTitle}
                                                </Typography>
                                            </Box>
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Chip
                                                    icon={<ClockIcon />}
                                                    label={formatDate(session.startTime)}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleContinueReading(session);
                                                    }}
                                                    sx={{ color: 'primary.main' }}
                                                >
                                                    <PlayIcon />
                                                </IconButton>
                                            </Box>
                                        </Box>

                                        {/* Session Stats */}
                                        <Box display="flex" alignItems="center" gap={2} mt={1}>
                                            <Typography variant="body2" color="text.secondary">
                                                Chapter {session.chapterNumber}: {session.chapterTitle}
                                            </Typography>
                                            <Chip
                                                icon={<TimeIcon />}
                                                label={formatTime(session.duration)}
                                                size="small"
                                                variant="filled"
                                                sx={{ backgroundColor: '#e8f5e8' }}
                                            />
                                            <Chip
                                                label={`${session.totalLines} sentences`}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Box>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Box>
                                        {/* Session Details */}
                                        <Box display="flex" justifyContent="space-between" mb={2}>
                                            <Typography variant="body2" color="text.secondary">
                                                Started: {formatDateTime(session.startTime)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Ended: {formatDateTime(session.endTime)}
                                            </Typography>
                                        </Box>

                                        <Divider sx={{ mb: 2 }} />

                                        {/* Individual Sentences */}
                                        <Typography variant="h6" gutterBottom>
                                            Sentences Read ({session.logs.length})
                                        </Typography>
                                        <Box display="flex" flexDirection="column" gap={1} maxHeight="300px" overflow="auto">
                                            {session.logs.map((log) => (
                                                <Card key={log._id} variant="outlined" sx={{ p: 2 }}>
                                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                                        <Box flex={1} mr={2}>
                                                            <Typography variant="body2" sx={{ mb: 1 }}>
                                                                {log.chunkText}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Sentence #{log.chunkIndex + 1} • {formatDateTime(log.timestamp)}
                                                            </Typography>
                                                        </Box>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handlePlayFromChunk(session, log.chunkIndex)}
                                                            sx={{ color: 'primary.main' }}
                                                        >
                                                            <PlayIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                </Card>
                                            ))}
                                        </Box>
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        </Card>
                    ))}
                </Box>
            )}
        </Box>
    );
}; 