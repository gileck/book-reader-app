# TTS Pricing Documentation

This document explains the pricing structure and character counting logic implemented for Text-to-Speech (TTS) services in this application.

## Overview

Our application supports two TTS providers with different pricing models and character counting rules:
- **Amazon Polly** - AWS Text-to-Speech service
- **Google Cloud Text-to-Speech** - Google Cloud TTS service

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

### Character Counting Rules
According to Amazon Polly documentation:
> "The size of the input text can be up to 3000 billed characters (6000 total characters). **SSML tags are not counted as billed characters.**"

**Implementation**: We remove ALL SSML tags before counting characters for billing.
```javascript
// Amazon Polly billing: "SSML tags are not counted as billed characters"
const billableText = ssmlText.replace(/<[^>]*>/g, '');
const billableCharCount = billableText.length;
```

## Google Cloud Text-to-Speech Pricing

### Pricing Structure
- **Standard Voices**: $4.00 per 1 million characters
- **WaveNet/Neural2/Polyglot/Chirp/Studio Voices**: $16.00 per 1 million characters

### Free Tier (Monthly)
- **Standard Voices**: 4 million characters/month
- **WaveNet/Neural2/Polyglot/Chirp/Studio Voices**: 1 million characters/month each

### Character Counting Rules
According to Google Cloud TTS documentation:
> "The total number of characters in the input string are counted for billing purposes, including spaces. **All Speech Synthesis Markup Language (SSML) tags except mark are also included in the character count.**"

**Implementation**: We remove only `<mark>` tags before counting characters for billing.
```javascript
// Google billing counts all characters in SSML except <mark> tags
const billableText = ssmlText.replace(/<mark[^>]*\/>/g, '');
const billableCharCount = billableText.length;
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

**Amazon Polly Billing**:
- SSML: `<speak> <mark name="word1-0"/> Hello <mark name="word2-1"/> world</speak>`
- Billable text: ` Hello  world` (13 characters - includes spaces)
- Billed: 13 characters

**Google TTS Billing**:
- SSML: `<speak> <mark name="word1-0"/> Hello <mark name="word2-1"/> world</speak>`
- Billable text: `<speak>  Hello  world</speak>` (32 characters - excludes only `<mark>` tags)
- Billed: 32 characters

## Implementation Details

### Cost Calculation Functions

**Amazon Polly** (`src/server/tts/adapters/pollyTtsAdapter.ts`):
```javascript
private calculateCost(textLength: number, audioLength: number, voiceTier: string): number {
    let costPerCharacter: number;
    switch (voiceTier) {
        case 'neural': costPerCharacter = 0.000025; break;
        case 'long-form': costPerCharacter = 0.00010; break;
        case 'generative': costPerCharacter = 0.00020; break;
        default: costPerCharacter = 0.000004; break; // standard
    }
    return textLength * costPerCharacter;
}
```

**Google TTS** (`src/server/tts/adapters/googleTtsAdapter.ts`):
```javascript
private calculateCost(textLength: number, audioLength: number, voiceTier: string): number {
    const costPerCharacter = voiceTier === 'neural' ? 0.000016 : 0.000004;
    return textLength * costPerCharacter;
}
```

### Usage Tracking

Both adapters track usage with accurate character counts:
```javascript
addTtsUsageRecord(provider, voiceId, billableCharCount, audioLength, cost, 'tts-api', voiceTier)
```

## Free Tier Monitoring

The application includes free tier usage tracking in the TTS Usage Dashboard:

### Amazon Polly Free Tier
- Tracks monthly usage per voice type
- Shows progress bars with percentage used
- Resets monthly for 12 months from first request

### Google TTS Free Tier  
- Tracks monthly usage per voice type
- Separate limits for Standard vs Neural2/WaveNet voices
- Resets monthly (no time limit)

## Important Notes

1. **Character counting differs between providers** - Amazon excludes all SSML, Google excludes only `<mark>` tags
2. **Free tier limits are separate** - Each voice type has independent monthly allowances
3. **Billing accuracy** - Our implementation follows each provider's official documentation
4. **Monthly resets** - Free tier usage resets at the beginning of each month
5. **Cost estimates** - All pricing is approximate and based on current published rates

## References

- [Amazon Polly Pricing](https://aws.amazon.com/polly/pricing/)
- [Amazon Polly Quotas Documentation](https://docs.aws.amazon.com/polly/latest/dg/limits.html)
- [Google Cloud Text-to-Speech Pricing](https://cloud.google.com/text-to-speech/pricing)

---

*Last updated: January 2025* 