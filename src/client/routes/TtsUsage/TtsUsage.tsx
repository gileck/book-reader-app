import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress
} from '@mui/material';
import { getTtsUsageSummary, getTtsUsageRecords } from '../../../apis/ttsUsage/client';
import type { TtsUsageSummary, TtsUsageRecord } from '../../../apis/ttsUsage/types';

export function TtsUsage() {
  const [summary, setSummary] = useState<TtsUsageSummary | null>(null);
  const [records, setRecords] = useState<TtsUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryResult, recordsResult] = await Promise.all([
        getTtsUsageSummary(),
        getTtsUsageRecords()
      ]);

      if (summaryResult.data?.success && summaryResult.data.summary) {
        setSummary(summaryResult.data.summary);
      }

      if (recordsResult.data?.success && recordsResult.data.records) {
        setRecords(recordsResult.data.records);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TTS usage data');
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const formatDuration = (seconds: number) => `${Math.round(seconds)}s`;
  const formatProvider = (provider: string) => provider === 'google' ? 'Google TTS' : 'Amazon Polly';

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3} maxWidth="1200px" mx="auto">
      <Typography variant="h4" gutterBottom>
        TTS Usage Dashboard
      </Typography>

      {summary && (
        <Stack spacing={4}>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Card sx={{ minWidth: 200, flex: 1 }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Cost
                </Typography>
                <Typography variant="h5">
                  {formatCost(summary.totalCost)}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 200, flex: 1 }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Calls
                </Typography>
                <Typography variant="h5">
                  {summary.totalCalls.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 200, flex: 1 }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Text Length
                </Typography>
                <Typography variant="h5">
                  {summary.totalTextLength.toLocaleString()} chars
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 200, flex: 1 }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Audio Duration
                </Typography>
                <Typography variant="h5">
                  {formatDuration(summary.totalAudioLength)}
                </Typography>
              </CardContent>
            </Card>
          </Stack>

          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Card sx={{ minWidth: 300, flex: 1 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Usage by Provider
                </Typography>
                <Stack spacing={2}>
                  {Object.entries(summary.usageByProvider).map(([provider, stats]) => (
                    <Box key={provider}>
                      <Typography variant="subtitle1">
                        {formatProvider(provider)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Cost: {formatCost(stats.totalCost)} | Calls: {stats.totalCalls} | 
                        Text: {stats.totalTextLength.toLocaleString()} chars
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 300, flex: 1 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Daily Usage
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(summary.usageByDay)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 7)
                    .map(([day, stats]) => (
                      <Typography key={day} variant="body2">
                        {day}: {formatCost(stats.totalCost)} ({stats.totalCalls} calls)
                      </Typography>
                    ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Stack>
      )}

      <Box mt={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent TTS Calls
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Voice</TableCell>
                    <TableCell>Text Length</TableCell>
                    <TableCell>Audio Duration</TableCell>
                    <TableCell>Cost</TableCell>
                    <TableCell>Endpoint</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.slice(0, 50).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {new Date(record.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={formatProvider(record.provider)} 
                          size="small" 
                          color={record.provider === 'google' ? 'primary' : 'secondary'}
                        />
                      </TableCell>
                      <TableCell>{record.voiceId}</TableCell>
                      <TableCell>{record.textLength} chars</TableCell>
                      <TableCell>{formatDuration(record.audioLength)}</TableCell>
                      <TableCell>{formatCost(record.cost)}</TableCell>
                      <TableCell>{record.endpoint}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
} 