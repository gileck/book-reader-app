import { useState, useEffect } from 'react';
import { getTtsUsageSummary } from '@/apis/ttsUsage/client';
import type { TtsUsageSummary } from '@/apis/ttsUsage/types';

interface UseTtsUsageResult {
  summary: TtsUsageSummary | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch TTS usage summary
 * Designed to be called when the Playback Settings modal opens,
 * not during initial reader loading
 */
export function useTtsUsage(enabled: boolean): UseTtsUsageResult {
  const [summary, setSummary] = useState<TtsUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const fetchUsage = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getTtsUsageSummary({ rangeDays: 30 });
        
        if (cancelled) return;

        if (result.data?.success && result.data.summary) {
          setSummary(result.data.summary);
        } else {
          setError(result.data?.error || 'Failed to fetch TTS usage');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUsage();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { summary, loading, error };
}

