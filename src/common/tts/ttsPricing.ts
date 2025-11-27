/**
 * TTS Pricing Constants (Updated November 2025)
 * 
 * Free tier limits for different TTS providers.
 * These are used for calculating usage across the application.
 * 
 * IMPORTANT: This is the single source of truth for free tier limits.
 * Do not duplicate these constants elsewhere.
 * 
 * Sources:
 * - Google: https://cloud.google.com/text-to-speech/pricing
 * - AWS Polly: https://aws.amazon.com/polly/pricing/
 * - ElevenLabs: https://elevenlabs.io/pricing
 */

export const FREE_TIER_LIMITS = {
  polly: {
    standard: 5000000,    // 5 million characters/month (first 12 months)
    neural: 1000000,      // 1 million characters/month (first 12 months)
    longform: 500000,     // 500 thousand characters/month (first 12 months)
    generative: 100000    // 100 thousand characters/month (first 12 months)
  },
  google: {
    standard: 4000000,    // 4 million characters/month
    wavenet: 4000000,     // 4 million characters/month (same as standard)
    neural2: 1000000,     // 1 million characters/month
    polyglot: 1000000,    // 1 million characters/month (preview)
    studio: 1000000,      // 1 million characters/month
    chirp3hd: 1000000     // 1 million characters/month (Chirp 3: HD voices)
  },
  elevenlabs: {
    total: 10000          // 10,000 characters/month (free plan)
  }
} as const;

/**
 * Pricing per character for different providers and voice types
 * Used for calculating costs beyond free tier
 */
export const PRICING_PER_CHARACTER = {
  polly: {
    standard: 0.000004,    // $4 per 1M characters
    neural: 0.000016,      // $16 per 1M characters
    longform: 0.0001,      // $100 per 1M characters
    generative: 0.00003    // $30 per 1M characters
  },
  google: {
    standard: 0.000004,    // $4 per 1M characters
    wavenet: 0.000004,     // $4 per 1M characters (same as standard tier pricing)
    neural2: 0.000016,     // $16 per 1M characters
    polyglot: 0.000016,    // $16 per 1M characters (preview)
    studio: 0.00016,       // $160 per 1M characters (premium voices)
    chirp3hd: 0.00003      // $30 per 1M characters (Chirp 3: HD voices)
  },
  elevenlabs: {
    // ElevenLabs uses subscription-based pricing, this is approximate per-character cost
    // Based on Creator plan: $22/month for 100,000 characters = $0.00022/char
    total: 0.00022
  }
} as const;

