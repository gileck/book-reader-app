/**
 * TTS Pricing Constants
 * 
 * Free tier limits for different TTS providers.
 * These are used for calculating usage across the application.
 * 
 * IMPORTANT: This is the single source of truth for free tier limits.
 * Do not duplicate these constants elsewhere.
 */

export const FREE_TIER_LIMITS = {
  polly: {
    standard: 5000000,    // 5 million characters/month
    neural: 1000000,      // 1 million characters/month
    longform: 500000      // 500 thousand characters/month
  },
  google: {
    standard: 4000000,    // 4 million characters/month
    neural2: 1000000      // 1 million characters/month (Neural2 voices)
  },
  elevenlabs: {
    total: 20000          // 20,000 characters/month (10,000 credits)
  }
} as const;

/**
 * Pricing per character for different providers and voice types
 * Used for calculating costs beyond free tier
 */
export const PRICING_PER_CHARACTER = {
  polly: {
    standard: 0.000004,    // $4 per 1M characters
    neural: 0.000016,      // $16 per 1M characters (calculated as $25 per 1M but using consistent rate)
    longform: 0.00010,     // $100 per 1M characters
    generative: 0.00020    // $200 per 1M characters
  },
  google: {
    standard: 0.000004,    // $4 per 1M characters
    neural2: 0.000016      // $16 per 1M characters (Neural2 voices)
  },
  elevenlabs: {
    total: 0.0003          // Approximate based on character usage
  }
} as const;

