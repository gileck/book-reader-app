import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CachedIcon from '@mui/icons-material/Cached';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LanguageIcon from '@mui/icons-material/Language';
import { getTranslationUsageSummary, getTranslationUsageRecords } from '../../../apis/translationUsage/client';
import type {
  TranslationUsageSummary,
  TranslationUsageRecord,
  TranslationRangeDays,
} from '../../../apis/translationUsage/types';
import styles from './TranslationUsage.module.css';

// Google Cloud Translation free tier: 500,000 characters per month
const FREE_TIER_LIMIT = 500000;

/**
 * Translation Usage Dashboard Component
 * 
 * Displays comprehensive translation usage statistics including:
 * - Cost breakdown with free tier awareness
 * - Character usage and cache hit ratios
 * - Per-language and daily usage analytics
 * - Recent translation records
 * 
 * Features:
 * - Responsive Material-UI design
 * - Full dark/light mode support
 * - Time range filtering (current month, previous month, last 30/60/90 days)
 * - Visual progress bars for free tier usage
 */
export function TranslationUsage() {
  const [summary, setSummary] = useState<TranslationUsageSummary | null>(null);
  const [records, setRecords] = useState<TranslationUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecordsExpanded, setIsRecordsExpanded] = useState(false);
  const [rangeDays, setRangeDays] = useState<TranslationRangeDays>('current-month');

  // Get current and previous month names
  const getCurrentMonthName = () => {
    return new Date().toLocaleString('en-US', { month: 'long' });
  };

  const getPreviousMonthName = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toLocaleString('en-US', { month: 'long' });
  };

  useEffect(() => {
    loadData();
  }, [rangeDays]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryResult, recordsResult] = await Promise.all([
        getTranslationUsageSummary({ rangeDays }),
        getTranslationUsageRecords({ lastHours: 24 }),
      ]);

      if (summaryResult.data?.success && summaryResult.data.summary) {
        setSummary(summaryResult.data.summary);
      }

      if (recordsResult.data?.success && recordsResult.data.records) {
        setRecords(recordsResult.data.records);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load translation usage data');
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercentage = (used: number, limit: number) =>
    Math.min((used / limit) * 100, 100).toFixed(1);

  // Get last 7 days of daily usage
  const getLast7Days = () => {
    if (!summary) return {};

    const last7Days: Record<string, typeof summary.usageByDay[string]> = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      last7Days[dateStr] = summary.usageByDay[dateStr] || {
        totalCost: 0,
        totalCalls: 0,
        totalCharacters: 0,
        cacheHits: 0,
        cacheMisses: 0,
      };
    }

    return last7Days;
  };

  const last7DaysData = getLast7Days();

  if (loading) {
    return (
      <Box className={styles.container}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TranslateIcon />
          Translation Usage Dashboard
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={styles.container}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TranslateIcon />
          Translation Usage Dashboard
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>Error: {error}</Alert>
      </Box>
    );
  }

  if (!summary) {
    return (
      <Box className={styles.container}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TranslateIcon />
          Translation Usage Dashboard
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>No data available</Alert>
      </Box>
    );
  }

  const freeTierUsagePercentage = (summary.freeTierMonthUsage / FREE_TIER_LIMIT) * 100;

  return (
    <Box className={styles.container}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
          <TranslateIcon fontSize="large" color="primary" />
          Translation Usage Dashboard
        </Typography>
        
        {/* Range Selector */}
        <FormControl variant="outlined" size="small" sx={{ minWidth: 280, mt: 2 }}>
          <InputLabel id="range-select-label">Time Range</InputLabel>
          <Select
            labelId="range-select-label"
            id="range-select"
            value={rangeDays}
            label="Time Range"
            onChange={(e) => setRangeDays(e.target.value as TranslationRangeDays)}
          >
            <MenuItem value="current-month">{getCurrentMonthName()} (Current Month)</MenuItem>
            <MenuItem value="previous-month">{getPreviousMonthName()} (Previous Month)</MenuItem>
            <MenuItem value={30}>Last 30 Days</MenuItem>
            <MenuItem value={60}>Last 60 Days</MenuItem>
            <MenuItem value={90}>Last 90 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
        <Card elevation={2}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Total Cost
              </Typography>
              <MonetizationOnIcon color="primary" />
            </Box>
            <Typography variant="h4" component="div" color="primary" sx={{ fontWeight: 600, mb: 1 }}>
              {formatCost(summary.totalCost)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatNumber(summary.totalCalls)} translations
            </Typography>
          </CardContent>
        </Card>

        <Card elevation={2}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Total Characters
              </Typography>
              <LanguageIcon color="info" />
            </Box>
            <Typography variant="h4" component="div" color="info.main" sx={{ fontWeight: 600, mb: 1 }}>
              {formatNumber(summary.totalCharacters)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              $20 per 1M chars
            </Typography>
          </CardContent>
        </Card>

        <Card elevation={2}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Cache Hit Ratio
              </Typography>
              <CachedIcon color="success" />
            </Box>
            <Typography variant="h4" component="div" color="success.main" sx={{ fontWeight: 600, mb: 1 }}>
              {summary.cacheHitRatio.toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatNumber(summary.totalCacheHits)} / {formatNumber(summary.totalCalls)} cached
            </Typography>
          </CardContent>
        </Card>

        <Card elevation={2}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Cost Savings
              </Typography>
              <TrendingDownIcon color="success" />
            </Box>
            <Typography variant="h4" component="div" color="success.main" sx={{ fontWeight: 600, mb: 1 }}>
              {formatCost(summary.costSavingsFromCache)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              From cached translations
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Free Tier Progress */}
      <Card elevation={2} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TranslateIcon color="primary" />
            Free Tier Usage (Current Month)
          </Typography>
          
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {formatNumber(summary.freeTierMonthUsage)} / {formatNumber(FREE_TIER_LIMIT)} characters used
              </Typography>
              <Chip 
                label={`${formatPercentage(summary.freeTierMonthUsage, FREE_TIER_LIMIT)}%`}
                color={freeTierUsagePercentage > 90 ? 'error' : freeTierUsagePercentage > 75 ? 'warning' : 'success'}
                size="small"
              />
            </Box>
            
            <LinearProgress 
              variant="determinate" 
              value={Math.min(freeTierUsagePercentage, 100)}
              color={freeTierUsagePercentage > 90 ? 'error' : freeTierUsagePercentage > 75 ? 'warning' : 'success'}
              sx={{ height: 10, borderRadius: 5 }}
            />
            
            {freeTierUsagePercentage > 90 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                ⚠️ Warning: You&apos;re approaching the free tier limit!
              </Alert>
            )}
            {freeTierUsagePercentage > 75 && freeTierUsagePercentage <= 90 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                You&apos;ve used over 75% of your free tier allocation.
              </Alert>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Usage by Language */}
      <Card elevation={2} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageIcon color="primary" />
            Usage by Target Language
          </Typography>
          
          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell><strong>Language</strong></TableCell>
                  <TableCell align="right"><strong>Translations</strong></TableCell>
                  <TableCell align="right"><strong>Characters</strong></TableCell>
                  <TableCell align="right"><strong>Cost</strong></TableCell>
                  <TableCell align="right"><strong>Cache Hits</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(summary.usageByLanguage)
                  .sort(([, a], [, b]) => b.totalCost - a.totalCost)
                  .map(([lang, stats]) => (
                    <TableRow key={lang} hover>
                      <TableCell>
                        <Chip label={lang.toUpperCase()} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{formatNumber(stats.totalCalls)}</TableCell>
                      <TableCell align="right">{formatNumber(stats.totalCharacters)}</TableCell>
                      <TableCell align="right">{formatCost(stats.totalCost)}</TableCell>
                      <TableCell align="right">
                        {stats.cacheHits} / {stats.cacheHits + stats.cacheMisses}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Daily Usage Chart (Last 7 Days) */}
      <Card elevation={2} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CachedIcon color="primary" />
            Daily Usage (Last 7 Days)
          </Typography>
          
          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell align="right"><strong>Translations</strong></TableCell>
                  <TableCell align="right"><strong>Characters</strong></TableCell>
                  <TableCell align="right"><strong>Cost</strong></TableCell>
                  <TableCell align="right"><strong>Cache Hit Ratio</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(last7DaysData)
                  .reverse()
                  .map(([day, stats]) => {
                    const totalOps = stats.cacheHits + stats.cacheMisses;
                    const hitRatio = totalOps > 0 ? (stats.cacheHits / totalOps) * 100 : 0;
                    return (
                      <TableRow key={day} hover>
                        <TableCell>{new Date(day).toLocaleDateString()}</TableCell>
                        <TableCell align="right">{formatNumber(stats.totalCalls)}</TableCell>
                        <TableCell align="right">{formatNumber(stats.totalCharacters)}</TableCell>
                        <TableCell align="right">{formatCost(stats.totalCost)}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${hitRatio.toFixed(1)}%`} 
                            size="small" 
                            color={hitRatio > 75 ? 'success' : hitRatio > 50 ? 'warning' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Recent Translations */}
      <Card elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TranslateIcon color="primary" />
              Recent Translations (Last 24 Hours)
            </Typography>
            <Chip
              label={isRecordsExpanded ? 'Collapse' : 'Expand'}
              onClick={() => setIsRecordsExpanded(!isRecordsExpanded)}
              color="primary"
              variant="outlined"
              clickable
              size="small"
            />
          </Box>
          
          {isRecordsExpanded && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell><strong>Time</strong></TableCell>
                    <TableCell><strong>Target Lang</strong></TableCell>
                    <TableCell align="right"><strong>Characters</strong></TableCell>
                    <TableCell align="right"><strong>Cost</strong></TableCell>
                    <TableCell align="center"><strong>Cached</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell>{new Date(record.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip label={record.targetLanguage.toUpperCase()} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{formatNumber(record.textLength)}</TableCell>
                      <TableCell align="right">{formatCost(record.cost)}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={record.fromCache ? 'Yes' : 'No'} 
                          size="small" 
                          color={record.fromCache ? 'success' : 'default'}
                          variant={record.fromCache ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

