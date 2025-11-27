import React, { useState, useEffect } from 'react';
import { getTtsUsageSummary, getTtsUsageRecords, getTtsErrorSummary } from '../../../apis/ttsUsage/client';
import type { TtsUsageSummary, TtsUsageRecord, TtsErrorSummary, TtsRangeDays } from '../../../apis/ttsUsage/types';
import { FREE_TIER_LIMITS } from '../../../common/tts/ttsPricing';
import styles from './TtsUsage.module.css';

export function TtsUsage() {
  const [summary, setSummary] = useState<TtsUsageSummary | null>(null);
  const [records, setRecords] = useState<TtsUsageRecord[]>([]);
  const [errorSummary, setErrorSummary] = useState<TtsErrorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecordsExpanded, setIsRecordsExpanded] = useState(false);
  const [rangeDays, setRangeDays] = useState<TtsRangeDays>('current-month');

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
      const [summaryResult, recordsResult, errorSummaryResult] = await Promise.all([
        getTtsUsageSummary({ rangeDays }),
        getTtsUsageRecords({ lastHours: 24 }),
        getTtsErrorSummary({ rangeDays })
      ]);

      if (summaryResult.data?.success && summaryResult.data.summary) {
        setSummary(summaryResult.data.summary);
      }

      if (recordsResult.data?.success && recordsResult.data.records) {
        setRecords(recordsResult.data.records);
      }

      if (errorSummaryResult.data?.success && errorSummaryResult.data.summary) {
        setErrorSummary(errorSummaryResult.data.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load TTS usage data');
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const formatDailyCost = (cost: number) => `$${cost.toFixed(1)}`;
  const formatWeeklyCost = (cost: number) => `$${cost.toFixed(2)}`;
  const formatDuration = (seconds: number) => `${Math.round(seconds)}s`;
  const formatProvider = (provider: string) => {
    switch (provider) {
      case 'google': return 'Google TTS';
      case 'polly': return 'Amazon Polly';
      case 'elevenlabs': return 'ElevenLabs';
      default: return provider;
    }
  };

  // Aggregate daily usage into weekly buckets
  const aggregateWeeklyUsage = () => {
    if (!summary) return {};

    const weeklyData: Record<string, { totalCost: number; totalCalls: number; cacheHits: number; cacheMisses: number; weekStart: string; weekEnd: string }> = {};

    Object.entries(summary.usageByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([day, stats]) => {
        const date = new Date(day);
        // Get Monday of the week (ISO week starts on Monday)
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        const weekStart = monday.toISOString().split('T')[0];

        // Calculate week end (Sunday)
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const weekEnd = sunday.toISOString().split('T')[0];

        if (!weeklyData[weekStart]) {
          weeklyData[weekStart] = {
            totalCost: 0,
            totalCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            weekStart,
            weekEnd
          };
        }

        weeklyData[weekStart].totalCost += stats.totalCost;
        weeklyData[weekStart].totalCalls += stats.totalCalls;
        weeklyData[weekStart].cacheHits += stats.cacheHits;
        weeklyData[weekStart].cacheMisses += stats.cacheMisses;
      });

    return weeklyData;
  };

  // Get last 7 days of daily usage (always show all 7 days)
  const getLast7Days = () => {
    if (!summary) return {};

    const last7Days: Record<string, typeof summary.usageByDay[string]> = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Include the day even if there's no data (with zero values)
      last7Days[dateStr] = summary.usageByDay[dateStr] || {
        totalCost: 0,
        totalCalls: 0,
        cacheHits: 0,
        cacheMisses: 0
      };
    }

    return last7Days;
  };

  const last7DaysData = getLast7Days();
  const weeklyUsageData = aggregateWeeklyUsage();

  // Calculate number of weeks based on range type
  const numberOfWeeks = (() => {
    if (rangeDays === 'current-month') {
      const now = new Date();
      const daysInMonth = Math.ceil((now.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime()) / (1000 * 60 * 60 * 24));
      return Math.ceil(daysInMonth / 7);
    } else if (rangeDays === 'previous-month') {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInPrevMonth = Math.ceil((prevMonthEnd.getTime() - prevMonth.getTime()) / (1000 * 60 * 60 * 24));
      return Math.ceil(daysInPrevMonth / 7);
    } else {
      return Math.ceil((rangeDays as number) / 7);
    }
  })();

  // Use server-provided calendar-month aggregate for Free Tier usage
  const currentMonthUsage = summary?.freeTierMonthUsage || {
    polly: { standard: 0, neural: 0, longform: 0, generative: 0 },
    google: { standard: 0, wavenet: 0, neural2: 0, polyglot: 0, studio: 0, chirp3hd: 0 },
    elevenlabs: { total: 0 }
  };
  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercentage = (used: number, limit: number) => Math.min((used / limit) * 100, 100);

  // Calculate actual costs considering free tier usage
  const calculateFreeTierAdjustedCosts = () => {
    if (!summary) return { totalCost: 0, usageByProvider: {} };

    const adjustedSummary = {
      totalCost: 0,
      usageByProvider: {} as typeof summary.usageByProvider
    };

    Object.entries(summary.usageByProvider).forEach(([provider, stats]) => {
      const adjustedProviderStats = {
        ...stats,
        totalCost: 0,
        usageByVoiceType: {} as typeof stats.usageByVoiceType
      };

      if (provider === 'polly') {
        // Amazon Polly free tier calculation
        Object.entries(stats.usageByVoiceType).forEach(([voiceType, voiceStats]) => {
          let freeLimit = 0;
          let monthlyUsage = 0;
          switch (voiceType) {
            case 'standard':
              freeLimit = FREE_TIER_LIMITS.polly.standard;
              monthlyUsage = currentMonthUsage.polly.standard;
              break;
            case 'neural':
              freeLimit = FREE_TIER_LIMITS.polly.neural;
              monthlyUsage = currentMonthUsage.polly.neural;
              break;
            case 'long-form':
              freeLimit = FREE_TIER_LIMITS.polly.longform;
              monthlyUsage = currentMonthUsage.polly.longform;
              break;
            case 'generative':
              freeLimit = FREE_TIER_LIMITS.polly.generative;
              monthlyUsage = currentMonthUsage.polly.generative;
              break;
            default:
              freeLimit = 0;
              monthlyUsage = 0;
          }

          const exceededUsage = Math.max(0, monthlyUsage - freeLimit);
          const originalCostPerChar = voiceStats.totalTextLength > 0 ? voiceStats.totalCost / voiceStats.totalTextLength : 0;
          const adjustedCost = exceededUsage * originalCostPerChar;

          adjustedProviderStats.usageByVoiceType[voiceType] = {
            ...voiceStats,
            totalCost: adjustedCost
          };
          adjustedProviderStats.totalCost += adjustedCost;
        });
      } else if (provider === 'google') {
        // Google TTS free tier calculation
        Object.entries(stats.usageByVoiceType).forEach(([voiceType, voiceStats]) => {
          let freeLimit = 0;
          let monthlyUsage = 0;
          switch (voiceType) {
            case 'standard':
              freeLimit = FREE_TIER_LIMITS.google.standard;
              monthlyUsage = currentMonthUsage.google.standard;
              break;
            case 'wavenet':
              freeLimit = FREE_TIER_LIMITS.google.wavenet;
              monthlyUsage = currentMonthUsage.google.wavenet;
              break;
            case 'neural2':
            case 'neural': // Legacy mapping
              freeLimit = FREE_TIER_LIMITS.google.neural2;
              monthlyUsage = currentMonthUsage.google.neural2;
              break;
            case 'polyglot':
              freeLimit = FREE_TIER_LIMITS.google.polyglot;
              monthlyUsage = currentMonthUsage.google.polyglot;
              break;
            case 'studio':
              freeLimit = FREE_TIER_LIMITS.google.studio;
              monthlyUsage = currentMonthUsage.google.studio;
              break;
            case 'chirp3-hd':
              freeLimit = FREE_TIER_LIMITS.google.chirp3hd;
              monthlyUsage = currentMonthUsage.google.chirp3hd;
              break;
            default:
              freeLimit = FREE_TIER_LIMITS.google.standard;
              monthlyUsage = currentMonthUsage.google.standard;
          }

          const exceededUsage = Math.max(0, monthlyUsage - freeLimit);
          const originalCostPerChar = voiceStats.totalTextLength > 0 ? voiceStats.totalCost / voiceStats.totalTextLength : 0;
          const adjustedCost = exceededUsage * originalCostPerChar;

          adjustedProviderStats.usageByVoiceType[voiceType] = {
            ...voiceStats,
            totalCost: adjustedCost
          };
          adjustedProviderStats.totalCost += adjustedCost;
        });
      } else if (provider === 'elevenlabs') {
        // ElevenLabs free tier calculation
        const monthlyUsage = currentMonthUsage.elevenlabs.total;
        const exceededUsage = Math.max(0, monthlyUsage - FREE_TIER_LIMITS.elevenlabs.total);

        Object.entries(stats.usageByVoiceType).forEach(([voiceType, voiceStats]) => {
          const originalCostPerChar = voiceStats.totalTextLength > 0 ? voiceStats.totalCost / voiceStats.totalTextLength : 0;
          const adjustedCost = exceededUsage * originalCostPerChar;

          adjustedProviderStats.usageByVoiceType[voiceType] = {
            ...voiceStats,
            totalCost: adjustedCost
          };
          adjustedProviderStats.totalCost += adjustedCost;
        });
      }

      adjustedSummary.usageByProvider[provider] = adjustedProviderStats;
      adjustedSummary.totalCost += adjustedProviderStats.totalCost;
    });

    return adjustedSummary;
  };

  const freeTierAdjustedCosts = calculateFreeTierAdjustedCosts();

  // Records API already returns last 24 hours only
  const last24HoursRecords = records;

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.ttsUsageContainer}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>TTS Usage Dashboard</h1>
        <div style={{ marginTop: 12 }}>
          <label htmlFor="range" style={{ fontSize: 14, color: '#6E6E73', marginRight: 8 }}>Range:</label>
          <select
            id="range"
            value={rangeDays}
            onChange={(e) => setRangeDays(e.target.value as TtsRangeDays)}
            style={{ minHeight: 32, borderRadius: 8, padding: '4px 8px' }}
          >
            <option value="current-month">Current Month ({getCurrentMonthName()})</option>
            <option value="previous-month">Previous Month ({getPreviousMonthName()})</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </header>

      {summary && (
        <>
          <section className={styles.summarySection}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Cost</div>
                <div className={styles.statValue}>{formatCost(freeTierAdjustedCosts.totalCost)}</div>
                {summary.totalCost > freeTierAdjustedCosts.totalCost && (
                  <div className={styles.statNote}>
                    Original: {formatCost(summary.totalCost)}
                  </div>
                )}
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Calls</div>
                <div className={styles.statValue}>{summary.totalCalls.toLocaleString()}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Text Length</div>
                <div className={styles.statValue}>{summary.totalTextLength.toLocaleString()}</div>
                <div className={styles.statUnit}>chars</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Audio Duration</div>
                <div className={styles.statValue}>{formatDuration(summary.totalAudioLength)}</div>
              </div>
            </div>
          </section>

          {/* AWS Cost Explorer Section - Real AWS Billing Data for Amazon Polly ONLY */}
          {summary.awsData && summary.usageByProvider['polly'] && (
            <section className={styles.awsSection}>
              <div className={styles.awsSectionHeader}>
                <div>
                  <h3 className={`${styles.sectionTitle} ${styles.awsSectionTitle}`}>
                    AWS Cost Explorer - Amazon Polly
                  </h3>
                  <p className={styles.awsSectionSubtitle}>
                    Real AWS billing data (24-48h delay) • Google TTS & ElevenLabs use internal tracking
                  </p>
                </div>
                {!summary.awsData.dataAvailable && (
                  <span className={`${styles.awsStatusBadge} ${styles.unavailable}`}>
                    {summary.awsData.error || 'Data not available'}
                  </span>
                )}
                {summary.awsData.dataAvailable && (
                  <span className={`${styles.awsStatusBadge} ${styles.available}`}>
                    ✓ Live AWS Data
                  </span>
                )}
              </div>
              {summary.awsData.dataAvailable ? (
                <>
                  <div className={styles.statsGrid}>
                    <div className={`${styles.awsStatCard} ${styles.gradient} ${styles.purpleGradient}`}>
                      <div className={styles.statLabel}>AWS Polly Cost</div>
                      <div className={styles.statValue}>${summary.awsData.totalCost.toFixed(2)}</div>
                      <div className={styles.statNote}>Actual AWS billing</div>
                    </div>
                    <div className={`${styles.awsStatCard} ${styles.gradient} ${styles.pinkGradient}`}>
                      <div className={styles.statLabel}>AWS Characters Used</div>
                      <div className={styles.statValue}>{summary.awsData.totalCharacters.toLocaleString()}</div>
                      <div className={styles.statUnit}>chars</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>Internal Polly Cost</div>
                      <div className={styles.statValue}>
                        ${summary.usageByProvider['polly']?.totalCost.toFixed(2) || '0.00'}
                      </div>
                      <div className={styles.statNote}>
                        {summary.usageByProvider['polly']?.totalCalls.toLocaleString() || '0'} tracked calls
                      </div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>Tracking Accuracy</div>
                      <div className={styles.statValue}>
                        {summary.usageByProvider['polly'] && summary.awsData.totalCost > 0
                          ? Math.abs(((summary.usageByProvider['polly'].totalCost - summary.awsData.totalCost) / summary.awsData.totalCost) * 100).toFixed(1)
                          : '0.0'}%
                      </div>
                      <div className={styles.statNote}>
                        {summary.usageByProvider['polly'] && summary.usageByProvider['polly'].totalCost > summary.awsData.totalCost
                          ? 'Over-estimated'
                          : 'Under-estimated'}
                      </div>
                    </div>
                  </div>
                  <div className={`${styles.detailCard} ${styles.awsDailyUsage}`}>
                    <h4 className={styles.awsDailyTitle}>
                      AWS Daily Polly Usage (Last 10 Days)
                    </h4>
                    <div className={styles.awsDailyScroll}>
                      {Object.entries(summary.awsData.usageByDay)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .slice(0, 10)
                        .reverse()
                        .map(([date, data]) => (
                          <div key={date} className={styles.awsDayCard}>
                            <div className={styles.awsDayDate}>
                              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className={styles.awsDayCost}>
                              ${data.cost.toFixed(2)}
                            </div>
                            <div className={styles.awsDayChars}>
                              {data.characters.toLocaleString()} chars
                            </div>
                            {Object.entries(data.usageTypes).length > 0 && (
                              <div className={styles.awsDayTypes}>
                                {Object.keys(data.usageTypes).map(type =>
                                  type.includes('LongForm') ? 'LongForm' :
                                    type.includes('Generative') ? 'Generative' :
                                      type.includes('Neural') ? 'Neural' : 'Standard'
                                ).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                  {/* AWS Free-Tier Usage for Current Month */}
                  {summary.awsData.currentMonthFreeTier && (
                    <div className={`${styles.detailCard} ${styles.awsFreeTierCard}`}>
                      <h4 className={styles.awsFreeTierTitle}>
                        AWS Free Tier Usage (
                        {rangeDays === 'current-month'
                          ? `${getCurrentMonthName()}`
                          : rangeDays === 'previous-month'
                            ? `${getPreviousMonthName()}`
                            : `${getCurrentMonthName()}`})
                      </h4>
                      <div className={styles.awsVoiceTypeGrid}>
                        {/* Standard Voice */}
                        {summary.awsData.currentMonthFreeTier.standard > 0 && (
                          <div className={styles.awsVoiceTypeItem}>
                            <div className={styles.awsVoiceTypeHeader}>
                              <span className={styles.awsVoiceTypeName}>Standard</span>
                              <span className={styles.awsVoiceTypeBadge}>Free</span>
                            </div>
                            <div className={styles.awsProgressContainer}>
                              <div className={styles.awsProgressBar}>
                                <div
                                  className={`${styles.awsProgressFill} ${styles[
                                    summary.awsData.currentMonthFreeTier.standard / FREE_TIER_LIMITS.polly.standard > 0.9 ? 'danger' :
                                      summary.awsData.currentMonthFreeTier.standard / FREE_TIER_LIMITS.polly.standard > 0.7 ? 'warning' : 'safe'
                                  ]}`}
                                  style={{ width: `${Math.min(100, (summary.awsData.currentMonthFreeTier.standard / FREE_TIER_LIMITS.polly.standard) * 100)}%` }}
                                ></div>
                              </div>
                              <div className={styles.awsProgressText}>
                                <span className={styles.awsUsageText}>
                                  {formatNumber(Math.round(summary.awsData.currentMonthFreeTier.standard))} / {formatNumber(FREE_TIER_LIMITS.polly.standard)} chars
                                </span>
                                <span className={`${styles.awsPercentageText} ${styles[
                                  summary.awsData.currentMonthFreeTier.standard / FREE_TIER_LIMITS.polly.standard > 0.9 ? 'danger' :
                                    summary.awsData.currentMonthFreeTier.standard / FREE_TIER_LIMITS.polly.standard > 0.7 ? 'warning' : 'safe'
                                ]}`}>
                                  {formatPercentage(summary.awsData.currentMonthFreeTier.standard, FREE_TIER_LIMITS.polly.standard).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Neural Voice */}
                        {summary.awsData.currentMonthFreeTier.neural > 0 && (
                          <div className={styles.awsVoiceTypeItem}>
                            <div className={styles.awsVoiceTypeHeader}>
                              <span className={styles.awsVoiceTypeName}>Neural</span>
                              <span className={styles.awsVoiceTypeBadge}>Free</span>
                            </div>
                            <div className={styles.awsProgressContainer}>
                              <div className={styles.awsProgressBar}>
                                <div
                                  className={`${styles.awsProgressFill} ${styles[
                                    summary.awsData.currentMonthFreeTier.neural / FREE_TIER_LIMITS.polly.neural > 0.9 ? 'danger' :
                                      summary.awsData.currentMonthFreeTier.neural / FREE_TIER_LIMITS.polly.neural > 0.7 ? 'warning' : 'safe'
                                  ]}`}
                                  style={{ width: `${Math.min(100, (summary.awsData.currentMonthFreeTier.neural / FREE_TIER_LIMITS.polly.neural) * 100)}%` }}
                                ></div>
                              </div>
                              <div className={styles.awsProgressText}>
                                <span className={styles.awsUsageText}>
                                  {formatNumber(Math.round(summary.awsData.currentMonthFreeTier.neural))} / {formatNumber(FREE_TIER_LIMITS.polly.neural)} chars
                                </span>
                                <span className={`${styles.awsPercentageText} ${styles[
                                  summary.awsData.currentMonthFreeTier.neural / FREE_TIER_LIMITS.polly.neural > 0.9 ? 'danger' :
                                    summary.awsData.currentMonthFreeTier.neural / FREE_TIER_LIMITS.polly.neural > 0.7 ? 'warning' : 'safe'
                                ]}`}>
                                  {formatPercentage(summary.awsData.currentMonthFreeTier.neural, FREE_TIER_LIMITS.polly.neural).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Long-Form Voice */}
                        {summary.awsData.currentMonthFreeTier.longform > 0 && (
                          <div className={styles.awsVoiceTypeItem}>
                            <div className={styles.awsVoiceTypeHeader}>
                              <span className={styles.awsVoiceTypeName}>Long-Form</span>
                              <span className={styles.awsVoiceTypeBadge}>Free</span>
                            </div>
                            <div className={styles.awsProgressContainer}>
                              <div className={styles.awsProgressBar}>
                                <div
                                  className={`${styles.awsProgressFill} ${styles[
                                    summary.awsData.currentMonthFreeTier.longform / FREE_TIER_LIMITS.polly.longform > 0.9 ? 'danger' :
                                      summary.awsData.currentMonthFreeTier.longform / FREE_TIER_LIMITS.polly.longform > 0.7 ? 'warning' : 'safe'
                                  ]}`}
                                  style={{ width: `${Math.min(100, (summary.awsData.currentMonthFreeTier.longform / FREE_TIER_LIMITS.polly.longform) * 100)}%` }}
                                ></div>
                              </div>
                              <div className={styles.awsProgressText}>
                                <span className={styles.awsUsageText}>
                                  {formatNumber(Math.round(summary.awsData.currentMonthFreeTier.longform))} / {formatNumber(FREE_TIER_LIMITS.polly.longform)} chars
                                </span>
                                <span className={`${styles.awsPercentageText} ${styles[
                                  summary.awsData.currentMonthFreeTier.longform / FREE_TIER_LIMITS.polly.longform > 0.9 ? 'danger' :
                                    summary.awsData.currentMonthFreeTier.longform / FREE_TIER_LIMITS.polly.longform > 0.7 ? 'warning' : 'safe'
                                ]}`}>
                                  {formatPercentage(summary.awsData.currentMonthFreeTier.longform, FREE_TIER_LIMITS.polly.longform).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Generative Voice */}
                        {summary.awsData.currentMonthFreeTier.generative > 0 && (
                          <div className={styles.awsVoiceTypeItem}>
                            <div className={styles.awsVoiceTypeHeader}>
                              <span className={styles.awsVoiceTypeName}>Generative</span>
                              <span className={styles.awsVoiceTypeBadge}>Free</span>
                            </div>
                            <div className={styles.awsProgressContainer}>
                              <div className={styles.awsProgressBar}>
                                <div
                                  className={`${styles.awsProgressFill} ${styles[
                                    summary.awsData.currentMonthFreeTier.generative / FREE_TIER_LIMITS.polly.generative > 0.9 ? 'danger' :
                                      summary.awsData.currentMonthFreeTier.generative / FREE_TIER_LIMITS.polly.generative > 0.7 ? 'warning' : 'safe'
                                  ]}`}
                                  style={{ width: `${Math.min(100, (summary.awsData.currentMonthFreeTier.generative / FREE_TIER_LIMITS.polly.generative) * 100)}%` }}
                                ></div>
                              </div>
                              <div className={styles.awsProgressText}>
                                <span className={styles.awsUsageText}>
                                  {formatNumber(Math.round(summary.awsData.currentMonthFreeTier.generative))} / {formatNumber(FREE_TIER_LIMITS.polly.generative)} chars
                                </span>
                                <span className={`${styles.awsPercentageText} ${styles[
                                  summary.awsData.currentMonthFreeTier.generative / FREE_TIER_LIMITS.polly.generative > 0.9 ? 'danger' :
                                    summary.awsData.currentMonthFreeTier.generative / FREE_TIER_LIMITS.polly.generative > 0.7 ? 'warning' : 'safe'
                                ]}`}>
                                  {formatPercentage(summary.awsData.currentMonthFreeTier.generative, FREE_TIER_LIMITS.polly.generative).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.awsEmptyState}>
                  <div className={styles.awsEmptyIcon}>⏳</div>
                  <div className={styles.awsEmptyTitle}>AWS Cost Explorer data not available</div>
                  <div className={styles.awsEmptyMessage}>
                    AWS billing data has a 24-48 hour delay. Check back later for Polly usage data.
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Cache Performance Section */}
          <section className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>Cache Performance</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Cache Hit Ratio</div>
                <div className={styles.statValue}>{summary.cacheHitRatio.toFixed(1)}%</div>
                <div className={styles.statNote}>
                  {summary.totalCacheHits} hits / {summary.totalCacheMisses} misses
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Cost Savings</div>
                <div className={styles.statValue}>{formatCost(summary.costSavingsFromCache)}</div>
                <div className={styles.statNote}>From {summary.totalCacheHits} cached responses</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Requests</div>
                <div className={styles.statValue}>{summary.totalCalls.toLocaleString()}</div>
                <div className={styles.statNote}>
                  {summary.totalCacheHits} cached • {summary.totalCacheMisses} fresh
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Actual API Calls</div>
                <div className={styles.statValue}>{summary.totalCacheMisses.toLocaleString()}</div>
                <div className={styles.statNote}>
                  {summary.totalCacheMisses > 0 ? ((summary.totalCacheMisses / summary.totalCalls) * 100).toFixed(1) : 0}% of total
                </div>
              </div>
            </div>
          </section>

          <section className={styles.detailsSection}>
            <div className={styles.detailsGrid}>
              <div className={styles.detailCard}>
                <h3 className={styles.cardTitle}>Usage by Provider</h3>
                <div className={styles.chartContainer}>
                  {Object.entries(freeTierAdjustedCosts.usageByProvider).map(([provider, stats]) => (
                    <div key={provider} className={styles.barChartItem}>
                      <div className={styles.barLabel}>
                        <span className={styles.providerName}>{formatProvider(provider)}</span>
                        <span className={styles.barValue}>{formatCost(stats.totalCost)}</span>
                      </div>
                      <div className={styles.barContainer}>
                        <div
                          className={`${styles.barFill} ${styles[`provider${provider.charAt(0).toUpperCase() + provider.slice(1)}`]}`}
                          style={{
                            width: `${Math.max(5, (stats.totalCost / Math.max(...Object.values(freeTierAdjustedCosts.usageByProvider).map(p => p.totalCost), 0.001)) * 100)}%`
                          }}
                        ></div>
                      </div>
                      <div className={styles.barStats}>
                        {stats.totalCalls} calls • {stats.totalTextLength.toLocaleString()} chars
                        {summary.usageByProvider[provider] && (
                          <>
                            {' • '}
                            <span style={{ color: '#34C759' }}>{summary.usageByProvider[provider].cacheHits} cached</span>
                            {' / '}
                            <span style={{ color: '#FF9500' }}>{summary.usageByProvider[provider].cacheMisses} fresh</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.detailCard}>
                <h3 className={styles.cardTitle}>Recent Daily Usage (Last 7 Days)</h3>
                <div className={styles.dailyUsageChart}>
                  {Object.entries(last7DaysData)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, stats]) => {
                      const maxCost = Math.max(...Object.values(last7DaysData).map(d => d.totalCost), 0.001);
                      const height = Math.max(5, (stats.totalCost / maxCost) * 100);
                      return (
                        <div key={day} className={styles.dailyUsageBar}>
                          <div className={styles.barContainer}>
                            <div
                              className={styles.costBar}
                              style={{ height: `${height}%` }}
                              title={`${new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${formatDailyCost(stats.totalCost)} (${stats.totalCalls} calls, ${stats.cacheHits} cached)`}
                            ></div>
                          </div>
                          <div className={styles.barLabel}>
                            <span className={styles.dateLabel}>{new Date(day).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          </div>
                          <div className={styles.costLabel}>
                            {formatDailyCost(stats.totalCost)}
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className={styles.chartLegend}>
                  <span className={styles.legendLabel}>Daily Total Cost</span>
                </div>
              </div>
            </div>
          </section>

          {/* Weekly Usage Section */}
          <section className={styles.detailsSection}>
            <div className={styles.detailsGrid}>
              <div className={styles.detailCard} style={{ gridColumn: '1 / -1' }}>
                <h3 className={styles.cardTitle}>Recent Weekly Usage (Last {numberOfWeeks} Weeks)</h3>
                <div className={styles.dailyUsageChart}>
                  {Object.entries(weeklyUsageData)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([weekStart, stats]) => {
                      const maxCost = Math.max(...Object.values(weeklyUsageData).map(w => w.totalCost), 0.001);
                      const height = Math.max(5, (stats.totalCost / maxCost) * 100);
                      const weekLabel = `${new Date(stats.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(stats.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                      return (
                        <div key={weekStart} className={styles.dailyUsageBar}>
                          <div className={styles.barContainer}>
                            <div
                              className={styles.costBar}
                              style={{ height: `${height}%` }}
                              title={`${weekLabel}: ${formatWeeklyCost(stats.totalCost)} (${stats.totalCalls} calls, ${stats.cacheHits} cached / ${stats.cacheMisses} fresh)`}
                            ></div>
                          </div>
                          <div className={styles.barLabel}>
                            <span className={styles.dateLabel}>
                              {new Date(stats.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' - '}
                              {new Date(stats.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <div className={styles.costLabel}>
                            {formatWeeklyCost(stats.totalCost)}
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className={styles.chartLegend}>
                  <span className={styles.legendLabel}>Weekly Total Cost</span>
                </div>
              </div>
            </div>
          </section>

          {/* Free Tier Tracking Section */}
          <section className={styles.freeTierSection}>
            <div className={styles.freeTierCard}>
              <h3 className={styles.cardTitle}>
                Free Tier Usage - {rangeDays === 'current-month'
                  ? getCurrentMonthName()
                  : rangeDays === 'previous-month'
                    ? getPreviousMonthName()
                    : getCurrentMonthName()}
              </h3>
              <div className={styles.freeTierInfo}>
                <p className={styles.freeTierDescription}>
                  Free tier limits reset monthly. Amazon Polly includes millions of characters per month for the first 12 months from your first request. Google TTS provides ongoing monthly free tier allowances.
                </p>

                <h4 className={styles.serviceTitle}>Amazon Polly</h4>
                <div className={styles.voiceTypeBreakdown}>
                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Standard Voices</span>
                      <span className={styles.voiceTypeBadge}>5M chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.polly.standard, FREE_TIER_LIMITS.polly.standard)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.polly.standard)} / {formatNumber(FREE_TIER_LIMITS.polly.standard)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.polly.standard, FREE_TIER_LIMITS.polly.standard).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {summary.awsData?.currentMonthFreeTier && (
                      <div className={styles.usageComparison}>
                        <div className={styles.usageComparisonRow}>
                          <span className={styles.usageComparisonLabel}>Internal Tracking:</span>
                          <span className={styles.usageComparisonValue}>
                            {formatNumber(currentMonthUsage.polly.standard)} chars
                          </span>
                        </div>
                        <div className={styles.usageComparisonRow}>
                          <span className={styles.usageComparisonLabel}>AWS Billing:</span>
                          <span className={`${styles.usageComparisonValue} ${styles.aws}`}>
                            {formatNumber(summary.awsData.currentMonthFreeTier.standard)} chars
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Neural Voices</span>
                      <span className={styles.voiceTypeBadge}>1M chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.polly.neural, FREE_TIER_LIMITS.polly.neural)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.polly.neural)} / {formatNumber(FREE_TIER_LIMITS.polly.neural)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.polly.neural, FREE_TIER_LIMITS.polly.neural).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {summary.awsData?.currentMonthFreeTier && (
                      <div className={styles.usageComparison}>
                        <div className={styles.usageComparisonRow}>
                          <span className={styles.usageComparisonLabel}>Internal Tracking:</span>
                          <span className={styles.usageComparisonValue}>
                            {formatNumber(currentMonthUsage.polly.neural)} chars
                          </span>
                        </div>
                        <div className={styles.usageComparisonRow}>
                          <span className={styles.usageComparisonLabel}>AWS Billing:</span>
                          <span className={`${styles.usageComparisonValue} ${styles.aws}`}>
                            {formatNumber(summary.awsData.currentMonthFreeTier.neural)} chars
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Long-Form Voices</span>
                      <span className={styles.voiceTypeBadge}>500K chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.polly.longform, FREE_TIER_LIMITS.polly.longform)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.polly.longform)} / {formatNumber(FREE_TIER_LIMITS.polly.longform)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.polly.longform, FREE_TIER_LIMITS.polly.longform).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {summary.awsData?.currentMonthFreeTier && (
                      <div className={styles.usageComparison}>
                        <div className={styles.usageComparisonRow}>
                          <span className={styles.usageComparisonLabel}>Internal Tracking:</span>
                          <span className={styles.usageComparisonValue}>
                            {formatNumber(currentMonthUsage.polly.longform)} chars
                          </span>
                        </div>
                        <div className={styles.usageComparisonRow}>
                          <span className={styles.usageComparisonLabel}>AWS Billing:</span>
                          <span className={`${styles.usageComparisonValue} ${styles.aws}`}>
                            {formatNumber(summary.awsData.currentMonthFreeTier.longform)} chars
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Generative Voices</span>
                      <span className={styles.voiceTypeBadge}>100K chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.polly.generative, FREE_TIER_LIMITS.polly.generative)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.polly.generative)} / {formatNumber(FREE_TIER_LIMITS.polly.generative)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.polly.generative, FREE_TIER_LIMITS.polly.generative).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {summary.awsData?.currentMonthFreeTier && (
                      <div className={styles.usageComparison}>
                        <div className={styles.usageComparisonRow}>
                          <span className={styles.usageComparisonLabel}>Internal Tracking:</span>
                          <span className={styles.usageComparisonValue}>
                            {formatNumber(currentMonthUsage.polly.generative)} chars
                          </span>
                        </div>
                        <div className={styles.usageComparisonRow}>
                          <span className={styles.usageComparisonLabel}>AWS Billing:</span>
                          <span className={`${styles.usageComparisonValue} ${styles.aws}`}>
                            {formatNumber(summary.awsData.currentMonthFreeTier.generative)} chars
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <h4 className={styles.serviceTitle}>Google Cloud Text-to-Speech</h4>
                <div className={styles.voiceTypeBreakdown}>
                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Standard Voices</span>
                      <span className={styles.voiceTypeBadge}>4M chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.google.standard, FREE_TIER_LIMITS.google.standard)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.google.standard)} / {formatNumber(FREE_TIER_LIMITS.google.standard)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.google.standard, FREE_TIER_LIMITS.google.standard).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>WaveNet Voices</span>
                      <span className={styles.voiceTypeBadge}>4M chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.google.wavenet, FREE_TIER_LIMITS.google.wavenet)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.google.wavenet)} / {formatNumber(FREE_TIER_LIMITS.google.wavenet)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.google.wavenet, FREE_TIER_LIMITS.google.wavenet).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Neural2 Voices</span>
                      <span className={styles.voiceTypeBadge}>1M chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.google.neural2, FREE_TIER_LIMITS.google.neural2)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.google.neural2)} / {formatNumber(FREE_TIER_LIMITS.google.neural2)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.google.neural2, FREE_TIER_LIMITS.google.neural2).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Studio Voices (Premium)</span>
                      <span className={styles.voiceTypeBadge}>1M chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.google.studio, FREE_TIER_LIMITS.google.studio)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.google.studio)} / {formatNumber(FREE_TIER_LIMITS.google.studio)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.google.studio, FREE_TIER_LIMITS.google.studio).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Chirp 3: HD Voices</span>
                      <span className={styles.voiceTypeBadge}>1M chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.google.chirp3hd, FREE_TIER_LIMITS.google.chirp3hd)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.google.chirp3hd)} / {formatNumber(FREE_TIER_LIMITS.google.chirp3hd)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.google.chirp3hd, FREE_TIER_LIMITS.google.chirp3hd).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className={styles.serviceTitle}>ElevenLabs</h4>
                <div className={styles.voiceTypeBreakdown}>
                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>All Voices</span>
                      <span className={styles.voiceTypeBadge}>10K chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.elevenlabs.total, FREE_TIER_LIMITS.elevenlabs.total)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.elevenlabs.total)} / {formatNumber(FREE_TIER_LIMITS.elevenlabs.total)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.elevenlabs.total, FREE_TIER_LIMITS.elevenlabs.total).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.freeTierNote}>
                  <p>
                    <strong>Amazon Polly:</strong> Free tier is available for the first 12 months starting from your first Polly request.
                    Standard (5M), Neural (1M), Long-Form (500K), and Generative (100K) have separate monthly limits.
                  </p>
                  <p>
                    <strong>Google TTS:</strong> Free tier is ongoing with monthly limits that reset each month.
                    Standard/WaveNet (4M each), Neural2/Studio/Chirp3-HD (1M each) have separate limits. No time restriction.
                  </p>
                  <p>
                    <strong>ElevenLabs:</strong> Free tier provides 10,000 characters monthly.
                    Resets monthly with no time restrictions.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Error Dashboard Section */}
      {errorSummary && (
        <section className={styles.errorSection}>
          <div className={styles.errorCard}>
            <h3 className={styles.cardTitle}>TTS Error Overview</h3>
            <div className={styles.errorStatsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Errors</div>
                <div className={`${styles.statValue} ${styles.errorValue}`}>{errorSummary.totalErrors}</div>
              </div>
              {Object.entries(errorSummary.errorsByProvider).map(([provider, stats]) => (
                <div key={provider} className={styles.statCard}>
                  <div className={styles.statLabel}>{formatProvider(provider)} Errors</div>
                  <div className={`${styles.statValue} ${styles.errorValue}`}>{stats.totalErrors}</div>
                </div>
              ))}
            </div>

            {/* Error Breakdown by Provider and Error Code */}
            <div className={styles.errorBreakdown}>
              {Object.entries(errorSummary.errorsByProvider).map(([provider, stats]) => (
                <div key={provider} className={styles.errorProviderSection}>
                  <h4 className={styles.errorProviderTitle}>{formatProvider(provider)}</h4>
                  <div className={styles.errorCodesList}>
                    {Object.entries(stats.errorsByCode).map(([code, errorStats]) => (
                      <div key={code} className={styles.errorCodeItem}>
                        <div className={styles.errorCodeHeader}>
                          <span className={`${styles.errorCodeBadge} ${styles[`error${code.split('_')[0]}`]}`}>
                            {code}
                          </span>
                          <span className={styles.errorCount}>{errorStats.count} errors</span>
                        </div>
                        <div className={styles.errorCodeDetails}>
                          <div className={styles.errorMessage}>{errorStats.latestError}</div>
                          <div className={styles.errorTimestamp}>
                            Latest: {new Date(errorStats.latestTimestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Errors */}
            {errorSummary.recentErrors.length > 0 && (
              <div className={styles.recentErrorsSection}>
                <h4 className={styles.recentErrorsTitle}>Recent Errors</h4>
                <div className={styles.recentErrorsList}>
                  {errorSummary.recentErrors.slice(0, 5).map((error) => (
                    <div key={error.id} className={styles.recentErrorItem}>
                      <div className={styles.recentErrorHeader}>
                        <span className={`${styles.errorCodeBadge} ${styles[`error${error.errorCode.split('_')[0]}`]}`}>
                          {error.errorCode}
                        </span>
                        <span className={styles.recentErrorProvider}>
                          {formatProvider(error.provider)}
                        </span>
                        <span className={styles.recentErrorTimestamp}>
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.recentErrorMessage}>{error.errorMessage}</div>
                      {error.originalError && (
                        <div className={styles.recentErrorOriginal}>
                          Original: {error.originalError}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className={styles.recordsSection}>
        <div className={styles.recordsCard}>
          <div
            className={styles.cardTitleClickable}
            onClick={() => setIsRecordsExpanded(!isRecordsExpanded)}
          >
            <h3 className={styles.cardTitle}>Recent TTS Calls (Last 24h)</h3>
            <span className={styles.expandIcon}>
              {isRecordsExpanded ? '▼' : '▶'}
            </span>
          </div>

          {isRecordsExpanded && (
            <>
              {/* Mobile Card View */}
              <div className={styles.recordsMobile}>
                {last24HoursRecords.map((record) => (
                  <div key={record.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <span className={`${styles.providerBadge} ${styles[`provider${record.provider.charAt(0).toUpperCase() + record.provider.slice(1)}`]}`}>
                        {formatProvider(record.provider)}
                      </span>
                      <span className={styles.recordTimestamp}>
                        {new Date(record.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })}
                      </span>
                    </div>
                    <div className={styles.recordDetails}>
                      <div className={styles.recordDetail}>
                        <span className={styles.detailLabel}>Voice:</span>
                        <span className={styles.detailValue}>{record.voiceId}</span>
                      </div>
                      <div className={styles.recordDetail}>
                        <span className={styles.detailLabel}>Voice Type:</span>
                        <span className={styles.detailValue}>{record.voiceType}</span>
                      </div>
                      <div className={styles.recordDetail}>
                        <span className={styles.detailLabel}>Text:</span>
                        <span className={styles.detailValue}>{record.textLength} chars</span>
                      </div>
                      <div className={styles.recordDetail}>
                        <span className={styles.detailLabel}>Duration:</span>
                        <span className={styles.detailValue}>{formatDuration(record.audioLength)}</span>
                      </div>
                      <div className={styles.recordDetail}>
                        <span className={styles.detailLabel}>Cost:</span>
                        <span className={`${styles.detailValue} ${styles.costValue}`}>{formatCost(record.cost)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className={styles.recordsDesktop}>
                <div className={styles.tableContainer}>
                  <table className={styles.recordsTable}>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Provider</th>
                        <th>Voice</th>
                        <th>Voice Type</th>
                        <th>Text Length</th>
                        <th>Audio Duration</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {last24HoursRecords.map((record) => (
                        <tr key={record.id}>
                          <td>{new Date(record.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}</td>
                          <td>
                            <span className={`${styles.providerBadge} ${styles[`provider${record.provider.charAt(0).toUpperCase() + record.provider.slice(1)}`]}`}>
                              {formatProvider(record.provider)}
                            </span>
                          </td>
                          <td>{record.voiceId}</td>
                          <td>
                            <span className={styles.voiceTypeBadge}>{record.voiceType}</span>
                          </td>
                          <td>{record.textLength} chars</td>
                          <td>{formatDuration(record.audioLength)}</td>
                          <td className={styles.costValue}>{formatCost(record.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
} 