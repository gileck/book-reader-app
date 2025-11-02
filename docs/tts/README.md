# TTS (Text-to-Speech) Documentation

This directory contains comprehensive documentation for the Text-to-Speech system, including pricing, billing, usage tracking, and implementation guides.

## 📚 Documentation Overview

### Core Documentation

#### [TTS_PRICING_DOCUMENTATION.md](./TTS_PRICING_DOCUMENTATION.md)
**Comprehensive pricing guide for all TTS providers**
- Pricing structure for Amazon Polly, Google Cloud TTS, and ElevenLabs
- Character counting rules (critical for accurate billing)
- Free tier limits and monthly allowances
- Cost calculation examples
- Implementation details for each adapter

**Key Topics:**
- Amazon Polly: Standard, Neural, Long-Form, and Generative voices
- Google Cloud TTS: Standard and Neural2/WaveNet voices
- ElevenLabs: Credit-based pricing system
- SSML character counting differences

---

#### [AWS_POLLY_BILLING_CRITICAL_FINDINGS.md](./AWS_POLLY_BILLING_CRITICAL_FINDINGS.md)
**⚠️ Critical billing discovery and fix**
- **68% billing discrepancy** discovered for Long-Form voices
- Root cause: AWS counts SSML mark attribute names for Long-Form voices
- Real-world impact: $15.66 unexpected charge
- Complete analysis with examples and fix implementation

**Must Read If:**
- Using Amazon Polly Long-Form voices (Danielle, Gregory, Burrow)
- Implementing TTS billing tracking
- Experiencing discrepancies between internal tracking and AWS billing

---

#### [TTS_BILLING_VERIFICATION.md](./TTS_BILLING_VERIFICATION.md)
**Verification of character counting across all providers**
- Status of implementation for each provider
- Testing and validation plans
- Edge cases and monitoring recommendations
- Google Cloud TTS validation TODO items

**Current Status:**
- ✅ Amazon Polly: Verified and fixed
- ⚠️ Google Cloud TTS: Needs 30-day validation
- ✅ ElevenLabs: Verified (no SSML = no issues)

---

#### [AWS_COST_EXPLORER_INTEGRATION.md](./AWS_COST_EXPLORER_INTEGRATION.md)
**AWS Cost Explorer API integration for real billing validation**
- How we validate internal tracking against actual AWS billing
- Implementation details of the AWS wrapper
- Dashboard integration for real-time cost comparison
- Free-tier tracking with progress bars

**Key Features:**
- 24-48 hour delayed but accurate AWS billing data
- Automatic voice type categorization (Standard, Neural, Long-Form)
- Non-blocking: works even if AWS credentials are missing
- Polly-only (Google TTS and ElevenLabs use internal tracking)

---

#### [TTS_ADAPTER_GUIDE.md](./TTS_ADAPTER_GUIDE.md)
**Technical implementation guide for TTS adapters**
- Adapter pattern architecture
- Supported providers and their features
- Environment setup and configuration
- Word highlighting implementation
- How to add new TTS providers

---

### Testing & Verification

#### [verify-tts-character-counting.js](./verify-tts-character-counting.js)
**Automated test script for character counting validation**

Run with:
```bash
node docs/tts/verify-tts-character-counting.js
```

**What it does:**
- Tests 6 different text scenarios
- Calculates billable characters for all providers
- Shows real-world cost estimates
- Validates implementation against expected behavior

**Example Output:**
```
Test: "Hello world"
  Amazon Polly (Standard/Neural): 15 chars
  Amazon Polly (Long-Form):      25 chars
  Google Cloud TTS:              30 chars
  ElevenLabs:                    11 chars
```

---

## 🎯 Quick Start Guide

### For Developers

1. **Read first**: [TTS_PRICING_DOCUMENTATION.md](./TTS_PRICING_DOCUMENTATION.md)
2. **Understand the critical issue**: [AWS_POLLY_BILLING_CRITICAL_FINDINGS.md](./AWS_POLLY_BILLING_CRITICAL_FINDINGS.md)
3. **Verify your implementation**: Run `node docs/tts/verify-tts-character-counting.js`
4. **Set up AWS validation**: [AWS_COST_EXPLORER_INTEGRATION.md](./AWS_COST_EXPLORER_INTEGRATION.md)

### For Cost Monitoring

1. **Set up AWS Cost Explorer** (for Polly validation)
2. **Configure budget alerts** in AWS Console and Google Cloud Console
3. **Monitor the TTS Usage Dashboard** at `/tts-usage`
4. **Review monthly**: Compare internal tracking vs actual billing

### For Adding New Providers

1. Read: [TTS_ADAPTER_GUIDE.md](./TTS_ADAPTER_GUIDE.md)
2. Implement: Extend `BaseTtsAdapter` class
3. Test: Use `verify-tts-character-counting.js` as a template
4. Document: Add pricing and character counting rules to `TTS_PRICING_DOCUMENTATION.md`

---

## ⚠️ Critical Warnings

### Amazon Polly Long-Form Voices
**DO NOT** assume SSML tags are excluded from billing for Long-Form voices!

- Standard/Neural: Exclude all SSML ✅
- Long-Form: Include mark attribute names ⚠️

**Example:**
```
Text: "Hello world" (11 chars)
SSML: <mark name="Hello-0"/> Hello <mark name="world-1"/> world
Billed: 11 (text) + 7 ("Hello-0") + 7 ("world-1") = 25 chars
```

See [AWS_POLLY_BILLING_CRITICAL_FINDINGS.md](./AWS_POLLY_BILLING_CRITICAL_FINDINGS.md) for full details.

### Google Cloud TTS
**Needs validation**: Implementation appears correct but hasn't been validated against actual billing.

- Monitor for 30 days
- Compare internal tracking vs Google Cloud Console billing
- Report discrepancies > 5%

---

## 📊 Character Counting Summary

| Provider | SSML Handling | Status |
|----------|--------------|--------|
| **Polly Standard/Neural** | Strip ALL SSML | ✅ Verified |
| **Polly Long-Form** | Text + mark attrs | ✅ Fixed & Verified |
| **Google Cloud TTS** | Strip only `<mark>` | ⚠️ Needs validation |
| **ElevenLabs** | No SSML (plain text) | ✅ Verified |

---

## 🔗 Related Files

### Implementation
- `../../src/server/tts/adapters/pollyTtsAdapter.ts` - Amazon Polly implementation
- `../../src/server/tts/adapters/googleTtsAdapter.ts` - Google TTS implementation
- `../../src/server/tts/adapters/elevenLabsAdapter.ts` - ElevenLabs implementation
- `../../src/server/aws-cost-explorer/index.ts` - AWS Cost Explorer wrapper
- `../../src/server/tts-usage-monitoring/index.ts` - Usage tracking service

### UI
- `../../src/client/routes/TtsUsage/` - TTS Usage Dashboard

### Configuration
- `../../src/common/tts/ttsPricing.ts` - Free tier limits and pricing constants

---

## 📅 Maintenance

### Monthly Tasks
- [ ] Review TTS billing vs internal tracking for all providers
- [ ] Check for pricing changes from providers
- [ ] Run `verify-tts-character-counting.js` to ensure calculations are still accurate
- [ ] Update free tier limits if changed

### Quarterly Tasks
- [ ] Audit all TTS documentation for accuracy
- [ ] Review and update cost estimates
- [ ] Test edge cases (emojis, special characters, different languages)

### When Adding Features
- [ ] Update character counting logic if SSML usage changes
- [ ] Test with small volumes before scaling
- [ ] Validate against actual provider billing
- [ ] Document any new findings

---

## 📞 Support & Issues

### Billing Discrepancies
1. Check the verification script output
2. Review [TTS_BILLING_VERIFICATION.md](./TTS_BILLING_VERIFICATION.md)
3. Compare with actual provider billing console
4. Document findings and update relevant docs

### Provider Issues
- **AWS Polly**: Check AWS Cost Explorer for actual usage
- **Google TTS**: Check Google Cloud Console → Billing → Reports
- **ElevenLabs**: Check ElevenLabs Dashboard → Usage

---

**Last Updated**: November 2025  
**Next Review**: December 2025

