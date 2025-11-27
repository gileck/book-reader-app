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
    // Map voice tiers to usage tracking keys
    switch (voiceTier) {
      case 'standard': return 'standard';
      case 'wavenet': return 'wavenet';
      case 'neural2': return 'neural2';
      case 'polyglot': return 'polyglot';
      case 'studio': return 'studio';
      case 'chirp3-hd': return 'chirp3hd';
      // Legacy mapping: 'neural' maps to 'neural2' for Google
      case 'neural': return 'neural2';
      default: return 'standard';
    }
  } else if (provider === 'polly') {
    switch (voiceTier) {
      case 'standard': return 'standard';
      case 'neural': return 'neural';
      case 'long-form': return 'longform';
      case 'longform': return 'longform';
      case 'generative': return 'generative';
      default: return 'standard';
    }
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
    switch (voiceTypeKey) {
      case 'standard':
        usedCharacters = freeTierMonthUsage.google.standard;
        freeLimit = FREE_TIER_LIMITS.google.standard;
        pricePerChar = PRICING_PER_CHARACTER.google.standard;
        break;
      case 'wavenet':
        usedCharacters = freeTierMonthUsage.google.wavenet;
        freeLimit = FREE_TIER_LIMITS.google.wavenet;
        pricePerChar = PRICING_PER_CHARACTER.google.wavenet;
        break;
      case 'neural2':
        usedCharacters = freeTierMonthUsage.google.neural2;
        freeLimit = FREE_TIER_LIMITS.google.neural2;
        pricePerChar = PRICING_PER_CHARACTER.google.neural2;
        break;
      case 'polyglot':
        usedCharacters = freeTierMonthUsage.google.polyglot;
        freeLimit = FREE_TIER_LIMITS.google.polyglot;
        pricePerChar = PRICING_PER_CHARACTER.google.polyglot;
        break;
      case 'studio':
        usedCharacters = freeTierMonthUsage.google.studio;
        freeLimit = FREE_TIER_LIMITS.google.studio;
        pricePerChar = PRICING_PER_CHARACTER.google.studio;
        break;
      case 'chirp3hd':
        usedCharacters = freeTierMonthUsage.google.chirp3hd;
        freeLimit = FREE_TIER_LIMITS.google.chirp3hd;
        pricePerChar = PRICING_PER_CHARACTER.google.chirp3hd;
        break;
      default:
        usedCharacters = freeTierMonthUsage.google.standard;
        freeLimit = FREE_TIER_LIMITS.google.standard;
        pricePerChar = PRICING_PER_CHARACTER.google.standard;
    }
  } else if (provider === 'polly') {
    switch (voiceTypeKey) {
      case 'standard':
        usedCharacters = freeTierMonthUsage.polly.standard;
        freeLimit = FREE_TIER_LIMITS.polly.standard;
        pricePerChar = PRICING_PER_CHARACTER.polly.standard;
        break;
      case 'neural':
        usedCharacters = freeTierMonthUsage.polly.neural;
        freeLimit = FREE_TIER_LIMITS.polly.neural;
        pricePerChar = PRICING_PER_CHARACTER.polly.neural;
        break;
      case 'longform':
        usedCharacters = freeTierMonthUsage.polly.longform;
        freeLimit = FREE_TIER_LIMITS.polly.longform;
        pricePerChar = PRICING_PER_CHARACTER.polly.longform;
        break;
      case 'generative':
        usedCharacters = freeTierMonthUsage.polly.generative;
        freeLimit = FREE_TIER_LIMITS.polly.generative;
        pricePerChar = PRICING_PER_CHARACTER.polly.generative;
        break;
      default:
        usedCharacters = freeTierMonthUsage.polly.standard;
        freeLimit = FREE_TIER_LIMITS.polly.standard;
        pricePerChar = PRICING_PER_CHARACTER.polly.standard;
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

  // Google - all voice tiers
  const googleStandard = getVoiceTypeUsage('google', 'standard', freeTierMonthUsage);
  const googleWavenet = getVoiceTypeUsage('google', 'wavenet', freeTierMonthUsage);
  const googleNeural2 = getVoiceTypeUsage('google', 'neural2', freeTierMonthUsage);
  const googlePolyglot = getVoiceTypeUsage('google', 'polyglot', freeTierMonthUsage);
  const googleStudio = getVoiceTypeUsage('google', 'studio', freeTierMonthUsage);
  const googleChirp3HD = getVoiceTypeUsage('google', 'chirp3-hd', freeTierMonthUsage);
  totalCost += googleStandard.costBeyondFreeTier + 
               googleWavenet.costBeyondFreeTier + 
               googleNeural2.costBeyondFreeTier +
               googlePolyglot.costBeyondFreeTier +
               googleStudio.costBeyondFreeTier +
               googleChirp3HD.costBeyondFreeTier;

  // Polly - all voice tiers
  const pollyStandard = getVoiceTypeUsage('polly', 'standard', freeTierMonthUsage);
  const pollyNeural = getVoiceTypeUsage('polly', 'neural', freeTierMonthUsage);
  const pollyLongform = getVoiceTypeUsage('polly', 'long-form', freeTierMonthUsage);
  const pollyGenerative = getVoiceTypeUsage('polly', 'generative', freeTierMonthUsage);
  totalCost += pollyStandard.costBeyondFreeTier + 
               pollyNeural.costBeyondFreeTier + 
               pollyLongform.costBeyondFreeTier +
               pollyGenerative.costBeyondFreeTier;

  // ElevenLabs
  const elevenlabs = getVoiceTypeUsage('elevenlabs', 'neural', freeTierMonthUsage);
  totalCost += elevenlabs.costBeyondFreeTier;

  return totalCost;
}

