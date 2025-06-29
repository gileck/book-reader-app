import React, { useState, useEffect } from 'react';
import { getTtsUsageSummary, getTtsUsageRecords, getTtsErrorSummary } from '../../../apis/ttsUsage/client';
import type { TtsUsageSummary, TtsUsageRecord, TtsErrorSummary } from '../../../apis/ttsUsage/types';
import styles from './TtsUsage.module.css';

export function TtsUsage() {
  const [summary, setSummary] = useState<TtsUsageSummary | null>(null);
  const [records, setRecords] = useState<TtsUsageRecord[]>([]);
  const [errorSummary, setErrorSummary] = useState<TtsErrorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecordsExpanded, setIsRecordsExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryResult, recordsResult, errorSummaryResult] = await Promise.all([
        getTtsUsageSummary(),
        getTtsUsageRecords(),
        getTtsErrorSummary()
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
  const formatDuration = (seconds: number) => `${Math.round(seconds)}s`;
  const formatProvider = (provider: string) => {
    switch (provider) {
      case 'google': return 'Google TTS';
      case 'polly': return 'Amazon Polly';
      case 'elevenlabs': return 'ElevenLabs';
      default: return provider;
    }
  };

  // Free tier limits (characters per month)
  const POLLY_FREE_TIER_LIMITS = {
    standard: 5000000, // 5 million characters
    neural: 1000000,   // 1 million characters
    longform: 500000   // 500 thousand characters
  };

  const GOOGLE_FREE_TIER_LIMITS = {
    standard: 4000000,  // 4 million characters
    neural2: 1000000    // 1 million characters (Neural2 voices)
  };

  const ELEVENLABS_FREE_TIER_LIMITS = {
    total: 20000  // 20,000 characters (10,000 credits)
  };

  // Calculate current month's usage for free tier tracking
  const getCurrentMonthUsage = () => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Polly usage
    const pollyRecords = records.filter(record =>
      record.provider === 'polly' &&
      record.timestamp.startsWith(currentMonth)
    );

    const pollyUsage = {
      standard: 0,
      neural: 0,
      longform: 0
    };

    pollyRecords.forEach(record => {
      const voiceType = record.voiceType;
      if (voiceType === 'neural') {
        pollyUsage.neural += record.textLength;
      } else if (voiceType === 'long-form') {
        pollyUsage.longform += record.textLength;
      } else if (voiceType === 'standard') {
        pollyUsage.standard += record.textLength;
      }
    });

    // Google usage
    const googleRecords = records.filter(record =>
      record.provider === 'google' &&
      record.timestamp.startsWith(currentMonth)
    );

    const googleUsage = {
      standard: 0,
      neural2: 0
    };

    googleRecords.forEach(record => {
      const voiceType = record.voiceType;
      if (voiceType === 'standard') {
        googleUsage.standard += record.textLength;
      } else {
        // Default to neural2 for Google Neural2 voices
        googleUsage.neural2 += record.textLength;
      }
    });

    // ElevenLabs usage
    const elevenLabsRecords = records.filter(record =>
      record.provider === 'elevenlabs' &&
      record.timestamp.startsWith(currentMonth)
    );

    const elevenLabsUsage = {
      total: 0
    };

    elevenLabsRecords.forEach(record => {
      elevenLabsUsage.total += record.textLength;
    });

    return { polly: pollyUsage, google: googleUsage, elevenlabs: elevenLabsUsage };
  };

  const currentMonthUsage = getCurrentMonthUsage();
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
          switch (voiceType) {
            case 'standard': freeLimit = POLLY_FREE_TIER_LIMITS.standard; break;
            case 'neural': freeLimit = POLLY_FREE_TIER_LIMITS.neural; break;
            case 'long-form': freeLimit = POLLY_FREE_TIER_LIMITS.longform; break;
            default: freeLimit = 0;
          }

          const monthlyUsage = currentMonthUsage.polly[voiceType as keyof typeof currentMonthUsage.polly] || 0;
          const exceededUsage = Math.max(0, monthlyUsage - freeLimit);
          const originalCostPerChar = voiceStats.totalCost / voiceStats.totalTextLength;
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
          if (voiceType === 'standard') {
            freeLimit = GOOGLE_FREE_TIER_LIMITS.standard;
          } else {
            freeLimit = GOOGLE_FREE_TIER_LIMITS.neural2; // Neural2/WaveNet voices
          }

          const monthlyUsage = voiceType === 'standard'
            ? currentMonthUsage.google.standard
            : currentMonthUsage.google.neural2;
          const exceededUsage = Math.max(0, monthlyUsage - freeLimit);
          const originalCostPerChar = voiceStats.totalCost / voiceStats.totalTextLength;
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
        const exceededUsage = Math.max(0, monthlyUsage - ELEVENLABS_FREE_TIER_LIMITS.total);

        Object.entries(stats.usageByVoiceType).forEach(([voiceType, voiceStats]) => {
          const originalCostPerChar = voiceStats.totalCost / voiceStats.totalTextLength;
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

  // Get records from last 24 hours
  const getLast24HoursRecords = () => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return records.filter(record => new Date(record.timestamp) >= twentyFourHoursAgo);
  };

  const last24HoursRecords = getLast24HoursRecords();

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
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.detailCard}>
                <h3 className={styles.cardTitle}>Recent Daily Usage (7 Days)</h3>
                <div className={styles.dailyUsageChart}>
                  {Object.entries(summary.usageByDay)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .slice(-7)
                    .map(([day, stats]) => {
                      const maxCost = Math.max(...Object.values(summary.usageByDay).map(d => d.totalCost), 0.001);
                      const height = Math.max(5, (stats.totalCost / maxCost) * 100);
                      return (
                        <div key={day} className={styles.dailyUsageBar}>
                          <div className={styles.barContainer}>
                            <div
                              className={styles.costBar}
                              style={{ height: `${height}%` }}
                              title={`${new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${formatDailyCost(stats.totalCost)} (${stats.totalCalls} calls)`}
                            ></div>
                          </div>
                          <div className={styles.barLabel}>
                            <span className={styles.dateLabel}>{new Date(day).toLocaleDateString('en-US', { day: 'numeric' })}</span>
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

          {/* Free Tier Tracking Section */}
          <section className={styles.freeTierSection}>
            <div className={styles.freeTierCard}>
              <h3 className={styles.cardTitle}>
                Free Tier Usage - {new Date().toLocaleDateString('en-US', { month: 'long' })}
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
                          style={{ width: `${formatPercentage(currentMonthUsage.polly.standard, POLLY_FREE_TIER_LIMITS.standard)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.polly.standard)} / {formatNumber(POLLY_FREE_TIER_LIMITS.standard)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.polly.standard, POLLY_FREE_TIER_LIMITS.standard).toFixed(1)}%
                        </span>
                      </div>
                    </div>
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
                          style={{ width: `${formatPercentage(currentMonthUsage.polly.neural, POLLY_FREE_TIER_LIMITS.neural)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.polly.neural)} / {formatNumber(POLLY_FREE_TIER_LIMITS.neural)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.polly.neural, POLLY_FREE_TIER_LIMITS.neural).toFixed(1)}%
                        </span>
                      </div>
                    </div>
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
                          style={{ width: `${formatPercentage(currentMonthUsage.polly.longform, POLLY_FREE_TIER_LIMITS.longform)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.polly.longform)} / {formatNumber(POLLY_FREE_TIER_LIMITS.longform)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.polly.longform, POLLY_FREE_TIER_LIMITS.longform).toFixed(1)}%
                        </span>
                      </div>
                    </div>
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
                          style={{ width: `${formatPercentage(currentMonthUsage.google.standard, GOOGLE_FREE_TIER_LIMITS.standard)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.google.standard)} / {formatNumber(GOOGLE_FREE_TIER_LIMITS.standard)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.google.standard, GOOGLE_FREE_TIER_LIMITS.standard).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.voiceTypeItem}>
                    <div className={styles.voiceTypeHeader}>
                      <span className={styles.voiceTypeName}>Neural2/WaveNet Voices</span>
                      <span className={styles.voiceTypeBadge}>1M chars/month</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.google.neural2, GOOGLE_FREE_TIER_LIMITS.neural2)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.google.neural2)} / {formatNumber(GOOGLE_FREE_TIER_LIMITS.neural2)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.google.neural2, GOOGLE_FREE_TIER_LIMITS.neural2).toFixed(1)}%
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
                      <span className={styles.voiceTypeBadge}>20K chars/month (10K credits)</span>
                    </div>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${formatPercentage(currentMonthUsage.elevenlabs.total, ELEVENLABS_FREE_TIER_LIMITS.total)}%` }}
                        ></div>
                      </div>
                      <div className={styles.progressText}>
                        <span className={styles.usageText}>
                          {formatNumber(currentMonthUsage.elevenlabs.total)} / {formatNumber(ELEVENLABS_FREE_TIER_LIMITS.total)} chars
                        </span>
                        <span className={styles.percentageText}>
                          {formatPercentage(currentMonthUsage.elevenlabs.total, ELEVENLABS_FREE_TIER_LIMITS.total).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.freeTierNote}>
                  <p>
                    <strong>Amazon Polly:</strong> Free tier is available for the first 12 months starting from your first Polly request.
                    Usage tracking is based on the current month&apos;s Polly requests.
                  </p>
                  <p>
                    <strong>Google TTS:</strong> Free tier is ongoing with monthly limits that reset each month.
                    No time restriction - available as long as you stay within monthly limits.
                  </p>
                  <p>
                    <strong>ElevenLabs:</strong> Free tier provides 10,000 credits monthly (20,000 characters with Flash/Turbo models).
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