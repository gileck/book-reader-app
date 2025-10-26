import { FREE_TIER_LIMITS, PRICING_PER_CHARACTER } from './ttsPricing';
import type { FreeTierMonthUsage } from '../../apis/ttsUsage/types';
import type { TtsProvider } from './ttsUtils';

export interface VoiceTypeUsageInfo {
  usedCharacters: number;
  freeLimit: number;
  percentageUsed: number;
  isInFreeTier: boolean;
  exceededCharacters: number;
  costBeyondFreeTier: number;
}

export interface ProviderUsageInfo {
  provider: TtsProvider;
  voiceType: string;
  usageInfo: VoiceTypeUsageInfo;
}

/**
 * Maps voice tier to the correct key in freeTierMonthUsage
 */
function getVoiceTypeKey(provider: TtsProvider, voiceTier: string): string {
  if (provider === 'google') {
    return voiceTier === 'standard' ? 'standard' : 'neural2';
  } else if (provider === 'polly') {
    return voiceTier === 'long-form' ? 'longform' : voiceTier;
  }
  return 'total'; // elevenlabs
}

/**
 * Get usage information for a specific provider and voice type
 */
export function getVoiceTypeUsage(
  provider: TtsProvider,
  voiceTier: string,
  freeTierMonthUsage: FreeTierMonthUsage
): VoiceTypeUsageInfo {
  const voiceTypeKey = getVoiceTypeKey(provider, voiceTier);
  
  let usedCharacters = 0;
  let freeLimit = 0;
  let pricePerChar = 0;

  if (provider === 'google') {
    usedCharacters = voiceTypeKey === 'standard' 
      ? freeTierMonthUsage.google.standard 
      : freeTierMonthUsage.google.neural2;
    freeLimit = voiceTypeKey === 'standard'
      ? FREE_TIER_LIMITS.google.standard
      : FREE_TIER_LIMITS.google.neural2;
    pricePerChar = voiceTypeKey === 'standard'
      ? PRICING_PER_CHARACTER.google.standard
      : PRICING_PER_CHARACTER.google.neural2;
  } else if (provider === 'polly') {
    if (voiceTypeKey === 'standard') {
      usedCharacters = freeTierMonthUsage.polly.standard;
      freeLimit = FREE_TIER_LIMITS.polly.standard;
      pricePerChar = PRICING_PER_CHARACTER.polly.standard;
    } else if (voiceTypeKey === 'neural') {
      usedCharacters = freeTierMonthUsage.polly.neural;
      freeLimit = FREE_TIER_LIMITS.polly.neural;
      pricePerChar = PRICING_PER_CHARACTER.polly.neural;
    } else if (voiceTypeKey === 'longform') {
      usedCharacters = freeTierMonthUsage.polly.longform;
      freeLimit = FREE_TIER_LIMITS.polly.longform;
      pricePerChar = PRICING_PER_CHARACTER.polly.longform;
    }
  } else if (provider === 'elevenlabs') {
    usedCharacters = freeTierMonthUsage.elevenlabs.total;
    freeLimit = FREE_TIER_LIMITS.elevenlabs.total;
    pricePerChar = PRICING_PER_CHARACTER.elevenlabs.total;
  }

  const percentageUsed = freeLimit > 0 ? Math.min((usedCharacters / freeLimit) * 100, 100) : 0;
  const isInFreeTier = usedCharacters < freeLimit;
  const exceededCharacters = Math.max(0, usedCharacters - freeLimit);
  const costBeyondFreeTier = exceededCharacters * pricePerChar;

  return {
    usedCharacters,
    freeLimit,
    percentageUsed,
    isInFreeTier,
    exceededCharacters,
    costBeyondFreeTier
  };
}

/**
 * Calculate total cost beyond free tier for all providers
 */
export function getTotalCostBeyondFreeTier(
  freeTierMonthUsage: FreeTierMonthUsage
): number {
  let totalCost = 0;

  // Google
  const googleStandard = getVoiceTypeUsage('google', 'standard', freeTierMonthUsage);
  const googleNeural = getVoiceTypeUsage('google', 'neural', freeTierMonthUsage);
  totalCost += googleStandard.costBeyondFreeTier + googleNeural.costBeyondFreeTier;

  // Polly
  const pollyStandard = getVoiceTypeUsage('polly', 'standard', freeTierMonthUsage);
  const pollyNeural = getVoiceTypeUsage('polly', 'neural', freeTierMonthUsage);
  const pollyLongform = getVoiceTypeUsage('polly', 'long-form', freeTierMonthUsage);
  totalCost += pollyStandard.costBeyondFreeTier + pollyNeural.costBeyondFreeTier + pollyLongform.costBeyondFreeTier;

  // ElevenLabs
  const elevenlabs = getVoiceTypeUsage('elevenlabs', 'neural', freeTierMonthUsage);
  totalCost += elevenlabs.costBeyondFreeTier;

  return totalCost;
}

