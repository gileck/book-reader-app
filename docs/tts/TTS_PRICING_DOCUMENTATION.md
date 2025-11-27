# TTS Pricing Documentation

This document explains the pricing structure and character counting logic implemented for Text-to-Speech (TTS) services in this application.

## Overview

Our application supports three TTS providers with different pricing models and character counting rules:
- **Amazon Polly** - AWS Text-to-Speech service
- **Google Cloud Text-to-Speech** - Google Cloud TTS service
- **ElevenLabs** - Premium AI voice synthesis service

## Amazon Polly Pricing

### Pricing Structure
- **Standard Voices**: $4.00 per 1 million characters
- **Neural Voices**: $16.00 per 1 million characters  
- **Long-Form Voices**: $100.00 per 1 million characters
- **Generative Voices**: $30.00 per 1 million characters

### Free Tier (First 12 months)
- **Standard Voices**: 5 million characters/month
- **Neural Voices**: 1 million characters/month
- **Long-Form Voices**: 500,000 characters/month
- **Generative Voices**: 100,000 characters/month
\
### Character Counting Rules

⚠️ **CRITICAL**: AWS Polly has **different billing rules for Long-Form voices** vs Standard/Neural voices.

#### Standard & Neural Voices
According to Amazon Polly documentation:
> "SSML tags are not counted as billed characters"

**Implementation**: Remove ALL SSML tags before counting.
```javascript
// Standard/Neural voices: Strip all SSML
const billableText = ssmlText.replace(/<[^>]*>/g, '');
const billableCharCount = billableText.length;
```

#### Long-Form Voices (Danielle, Gregory, Burrow) - **SPECIAL CASE**
**CRITICAL FINDING**: AWS counts the original text **PLUS** the character count of SSML `<mark>` attribute names.

**Implementation**: Count text characters + mark attribute name lengths.
```javascript
// Long-Form voices: Text + mark attribute lengths
// Example: "Hello world" with marks "Hello-0" and "world-1"
//   Text: 11 chars + Mark attrs: 14 chars = 25 billable chars
const words = text.split(' ').filter(w => w.length > 0);
const textChars = text.length;
const markAttributeChars = words.reduce((sum, word, i) => {
    return sum + `${word}-${i}`.length;
}, 0);
const billableCharCount = textChars + markAttributeChars;
```

**Real-World Impact**: This caused a 68% discrepancy between our tracking and AWS billing.  
See [AWS_POLLY_BILLING_CRITICAL_FINDINGS.md](./AWS_POLLY_BILLING_CRITICAL_FINDINGS.md) for detailed analysis.

## Google Cloud Text-to-Speech Pricing

### Pricing Structure (November 2025)
- **Standard Voices**: $4.00 per 1 million characters
- **WaveNet Voices**: $4.00 per 1 million characters (same tier as standard)
- **Neural2 Voices**: $16.00 per 1 million characters
- **Polyglot Voices**: $16.00 per 1 million characters (preview)
- **Studio Voices**: $160.00 per 1 million characters (premium)

### Free Tier (Monthly)
- **Standard Voices**: 4 million characters/month
- **WaveNet Voices**: 4 million characters/month
- **Neural2 Voices**: 1 million characters/month
- **Polyglot Voices**: 1 million characters/month
- **Studio Voices**: 1 million characters/month

### Character Counting Rules
According to Google Cloud TTS documentation:
> "The total number of characters in the input string are counted for billing purposes, including spaces. **All Speech Synthesis Markup Language (SSML) tags except mark are also included in the character count.**"

**Implementation**: We remove only `<mark>` tags before counting characters for billing.
```javascript
// Google billing counts all characters in SSML except <mark> tags
const billableText = ssmlText.replace(/<mark[^>]*\/>/g, '');
const billableCharCount = billableText.length;
```

## ElevenLabs Pricing

### Pricing Structure (November 2025)
- **Free Plan**: 10,000 characters/month
- **Starter Plan**: $5/month for 30,000 characters (~$0.000167/char)
- **Creator Plan**: $22/month for 100,000 characters (~$0.00022/char)
- **Pro Plan**: $99/month for 500,000 characters (~$0.000198/char)
- **Scale Plan**: $330/month for 2 million characters (~$0.000165/char)

### Free Tier (Monthly)
- **Characters**: 10,000 characters/month
- **Audio Duration**: ~10 minutes
- **Features**: Text-to-Speech, Speech-to-Text, Music, Agents, Studio, API access

### Character Counting Rules
ElevenLabs counts characters directly:
- 1 character = 0.5 credits (Flash/Turbo models)
- Approximately 1000 characters = 1 minute of audio
- No SSML markup considerations (direct character count)

**Implementation**: Direct character count of input text.
```javascript
// ElevenLabs billing: Direct character count
const billableCharCount = text.length;
```

## SSML Usage in Our Application

Our application generates SSML with timing marks for audio synchronization:

```xml
<speak>
 <mark name="word1-0"/> Hello
 <mark name="word2-1"/> world
</speak>
```

### Character Count Examples

For the text "Hello world" (11 characters):

**Amazon Polly Billing (Standard/Neural)**:
- SSML: `<speak> <mark name="Hello-0"/> Hello <mark name="world-1"/> world</speak>`
- Billable text: ` Hello  world` (strips all SSML)
- Billed: ~13 characters (text + spaces only)

**Amazon Polly Billing (Long-Form)** ⚠️:
- SSML: `<speak> <mark name="Hello-0"/> Hello <mark name="world-1"/> world</speak>`
- Text: "Hello world" = 11 characters
- Mark attributes: "Hello-0" (7) + "world-1" (7) = 14 characters
- **Billed: 25 characters** (11 text + 14 mark attributes)

**Google TTS Billing**:
- SSML: `<speak> <mark name="word1-0"/> Hello <mark name="word2-1"/> world</speak>`
- Billable text: `<speak>  Hello  world</speak>` (32 characters - excludes only `<mark>` tags)
- Billed: 32 characters

**ElevenLabs Billing**:
- Text: `Hello world` (11 characters)
- Billable text: `Hello world` (11 characters - direct count)
- Billed: 11 characters (5.5 credits)

## Implementation Details

### Cost Calculation Functions

**Amazon Polly** (`src/server/tts/adapters/pollyTtsAdapter.ts`):
```javascript
private calculateCost(textLength: number, audioLength: number, voiceTier: string): number {
    let costPerCharacter: number;
    switch (voiceTier) {
        case 'neural': costPerCharacter = 0.000016; break;      // $16/1M
        case 'long-form': costPerCharacter = 0.0001; break;     // $100/1M
        case 'generative': costPerCharacter = 0.00003; break;   // $30/1M
        default: costPerCharacter = 0.000004; break;            // $4/1M (standard)
    }
    return textLength * costPerCharacter;
}
```

**Google TTS** (`src/server/tts/adapters/googleTtsAdapter.ts`):
```javascript
private calculateCost(textLength: number, audioLength: number, voiceTier: string): number {
    let costPerCharacter: number;
    switch (voiceTier) {
        case 'studio': costPerCharacter = 0.00016; break;       // $160/1M
        case 'neural2':
        case 'polyglot': costPerCharacter = 0.000016; break;    // $16/1M
        case 'wavenet':
        case 'standard':
        default: costPerCharacter = 0.000004; break;            // $4/1M
    }
    return textLength * costPerCharacter;
}
```

**ElevenLabs** (`src/server/tts/adapters/elevenLabsAdapter.ts`):
```javascript
private calculateCost(textLength: number, audioLength: number): number {
    // ElevenLabs pricing based on Creator plan: $22/month for 100,000 chars
    // Approximate cost per character: $0.00022
    return textLength * 0.00022;
}
```

### Usage Tracking

All adapters track usage with accurate character counts:
```javascript
addTtsUsageRecord(provider, voiceId, billableCharCount, audioLength, cost, 'tts-api', voiceTier, userId, fromCache)
```

**Cache Tracking**: The application tracks whether each TTS request was served from cache or required a fresh API call:
- `fromCache: true` - Response served from S3 cache (no API cost)
- `fromCache: false` - Fresh API call (billed normally)
- `fromCache: undefined` - Old records before cache tracking was implemented

This enables the TTS Usage Dashboard to display:
- Cache hit ratio (percentage of requests served from cache)
- Cost savings from caching (estimated based on average cost per character)
- Breakdown of cached vs. fresh requests per provider
- Daily and weekly cache performance trends

## Free Tier Monitoring

The application includes free tier usage tracking in the TTS Usage Dashboard:

### Amazon Polly Free Tier
- Tracks monthly usage per voice type
- Shows progress bars with percentage used
- Resets monthly for 12 months from first request

### Google TTS Free Tier  
- Tracks monthly usage per voice type
- Separate limits for Standard/WaveNet (4M), Neural2/Polyglot/Studio (1M each)
- Resets monthly (no time limit)

### ElevenLabs Free Tier
- Tracks monthly character usage
- 10,000 characters/month (free plan)
- Resets monthly (no time limit)

## Important Notes

1. **⚠️ CRITICAL: Amazon Polly Long-Form voices have special billing** - They count text + SSML mark attribute names, unlike Standard/Neural voices
2. **Character counting differs between providers** - Amazon varies by voice type, Google excludes only `<mark>` tags, ElevenLabs counts all characters
3. **Free tier limits are separate** - Each voice type has independent monthly allowances
4. **Billing accuracy validated with AWS Cost Explorer** - We use AWS Cost Explorer API to validate internal tracking against actual billing
5. **Monthly resets** - Free tier usage resets at the beginning of each month
6. **Cost estimates** - All pricing is approximate and based on current published rates
7. **ElevenLabs credits** - Uses credit-based system where 1 character = 0.5 credits
8. **Cache tracking** - S3 cache responses are tracked separately with zero cost, enabling accurate cost savings calculations
9. **68% discrepancy discovered** - Initial implementation undercounted Long-Form usage by 68%, see [AWS_POLLY_BILLING_CRITICAL_FINDINGS.md](./AWS_POLLY_BILLING_CRITICAL_FINDINGS.md)

## References

### External Documentation
- [Amazon Polly Pricing](https://aws.amazon.com/polly/pricing/)
- [Amazon Polly Quotas Documentation](https://docs.aws.amazon.com/polly/latest/dg/limits.html) ⚠️ Incomplete for Long-Form billing
- [Google Cloud Text-to-Speech Pricing](https://cloud.google.com/text-to-speech/pricing)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)

### Internal Documentation
- [AWS_POLLY_BILLING_CRITICAL_FINDINGS.md](./AWS_POLLY_BILLING_CRITICAL_FINDINGS.md) - Detailed analysis of Long-Form voice billing discovery
- [AWS_COST_EXPLORER_INTEGRATION.md](./AWS_COST_EXPLORER_INTEGRATION.md) - AWS Cost Explorer API integration for billing validation
- [TTS_BILLING_VERIFICATION.md](./TTS_BILLING_VERIFICATION.md) - Verification of character counting across all providers
- `../../src/server/tts/adapters/pollyTtsAdapter.ts` - Implementation with correct billing logic

---

*Last updated: November 2025*  
*Critical billing fix applied: November 2025* 