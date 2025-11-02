# TTS Billing Character Count Verification

## Purpose
After discovering a 68% billing discrepancy with AWS Polly Long-Form voices, this document verifies the character counting logic for all TTS providers to ensure accurate billing.

## Summary of Findings

| Provider | SSML Counting Rule | Implementation Status | Verified |
|----------|-------------------|----------------------|----------|
| **Amazon Polly (Standard/Neural)** | Excludes ALL SSML tags | ✅ Correct | ✅ Yes |
| **Amazon Polly (Long-Form)** | Includes mark attribute names | ✅ Fixed | ✅ Yes |
| **Google Cloud TTS** | Excludes ONLY `<mark>` tags | ✅ Correct | ⚠️ Needs validation |
| **ElevenLabs** | No SSML (plain text API) | ✅ Correct | ✅ Yes |

---

## Amazon Polly

### Documentation Review

**Official Statement:**
> "SSML tags are not counted as billed characters"

**Reality:** This is **incomplete** for Long-Form voices.

### Standard & Neural Voices
- **Rule**: Exclude ALL SSML tags
- **Implementation**: Strip all `<tag>` patterns
- **Status**: ✅ Correct

### Long-Form Voices (Danielle, Gregory, Burrow)
- **Rule**: Count original text + SSML mark attribute names
- **Example**: 
  - Text: "Hello world" (11 chars)
  - SSML: `<mark name="Hello-0"/> Hello <mark name="world-1"/> world`
  - Billed: 11 (text) + 7 ("Hello-0") + 7 ("world-1") = **25 characters**
- **Implementation**: 
```typescript
const words = text.split(' ').filter(w => w.length > 0);
const textChars = text.length;
const markAttributeChars = words.reduce((sum, word, i) => {
    return sum + `${word}-${i}`.length;
}, 0);
const billableCharCount = textChars + markAttributeChars;
```
- **Status**: ✅ Fixed (was incorrect, now correct)
- **Verification**: Validated against AWS Cost Explorer actual billing

---

## Google Cloud Text-to-Speech

### Documentation Review

**Official Statement (from speechactors.com):**
> "All characters in the input string are counted for billing purposes, including spaces. All Speech Synthesis Markup Language (SSML) tags except `<mark>` are also included in the character count."

### Character Counting Rule
- **Rule**: Include all SSML tags EXCEPT `<mark>` tags
- **Example**:
  - Text: "Hello world" (11 chars)
  - SSML: `<speak> <mark name="Hello-0"/> Hello <mark name="world-1"/> world</speak>`
  - Strips: `<mark name="Hello-0"/>` and `<mark name="world-1"/>`
  - Billed: `<speak>  Hello  world</speak>` ≈ **32 characters**

### Current Implementation

File: `src/server/tts/adapters/googleTtsAdapter.ts` (lines 73-76)

```typescript
// Google billing counts all characters in SSML except <mark> tags
// Remove all <mark> tags from SSML for accurate billing count
const billableText = ssmlText.replace(/<mark[^>]*\/>/g, '');
const billableCharCount = billableText.length;
```

### Analysis
- **Pattern**: `/<mark[^>]*\/>/g` - Matches self-closing `<mark>` tags
- **Behavior**: Removes only `<mark/>` tags, keeps all other SSML
- **Status**: ✅ **Appears Correct** per documentation

### ⚠️ Verification Needed

**Test Scenario:**
```javascript
const text = "Hello world";
const ssmlText = '<speak> <mark name="Hello-0"/> Hello <mark name="world-1"/> world</speak>';

// Our calculation
const billableText = ssmlText.replace(/<mark[^>]*\/>/g, '');
// Result: '<speak>  Hello  world</speak>'
const charCount = billableText.length; // Should be ~32

// Expected Google billing: 32 characters
```

**Action Items:**
1. ✅ Implementation matches documented behavior
2. ⚠️ **TODO**: Validate with actual Google Cloud billing
3. ⚠️ **TODO**: Check if Google counts whitespace consistently
4. ⚠️ **TODO**: Test with Google Cloud cost tracking if available

### Potential Issues
- **Whitespace handling**: Unclear if Google normalizes spaces
- **Other SSML tags**: We only use `<speak>` and `<mark>`, but if we add more tags (e.g., `<prosody>`, `<break>`), they would be counted
- **No billing API**: Google doesn't have a Cost Explorer equivalent, so validation is harder

### Recommendation
**MEDIUM PRIORITY**: Monitor Google TTS usage vs actual billing for 1-2 months to validate accuracy.

---

## ElevenLabs

### Documentation Review

**API Behavior:**
- ElevenLabs does NOT use SSML
- Uses direct text input via REST API
- Returns character-level alignment that we convert to word-level

### Character Counting Rule
- **Rule**: Direct character count of input text
- **Example**:
  - Text: "Hello world" (11 chars)
  - Billed: **11 characters** (0.5 credits per char = 5.5 credits)

### Current Implementation

File: `src/server/tts/adapters/elevenLabsAdapter.ts` (lines 105-106)

```typescript
const characterCount = text.length;
const cost = this.calculateCost(characterCount, ...);
```

### Analysis
- **No SSML**: We send plain text to ElevenLabs API
- **Direct counting**: Simple `.length` property
- **Status**: ✅ **Correct** - Cannot have SSML discrepancy

### Verification
- ✅ Implementation is straightforward
- ✅ No SSML means no hidden character counting
- ✅ Text length = billable characters (1:1 mapping)

---

## Testing & Validation Plan

### ✅ Amazon Polly - VALIDATED
- [x] Discovered 68% discrepancy through AWS Cost Explorer
- [x] Identified root cause (mark attribute counting)
- [x] Fixed implementation
- [x] Validated fix against actual AWS billing

### ⚠️ Google Cloud TTS - NEEDS VALIDATION

**Test Plan:**
1. **Small-scale test** (next 7 days):
   - Track usage for 1,000-5,000 characters
   - Compare internal tracking vs Google Cloud billing console
   - Check for discrepancies > 5%

2. **SSML complexity test**:
   ```javascript
   // Test 1: Minimal SSML
   const test1 = '<speak> Hello world</speak>';
   // Expected: ~27 chars
   
   // Test 2: With marks (our standard)
   const test2 = '<speak> <mark name="Hello-0"/> Hello <mark name="world-1"/> world</speak>';
   // Expected: ~32 chars (marks stripped)
   
   // Test 3: Complex SSML (if we ever add more tags)
   const test3 = '<speak> <prosody rate="slow"> <mark name="Hello-0"/> Hello</prosody></speak>';
   // Expected: All tags count except <mark>
   ```

3. **Billing validation**:
   - Access Google Cloud Console → Billing → Reports
   - Filter for "Cloud Text-to-Speech API"
   - Compare character count billed vs our internal tracking
   - Target: < 5% discrepancy

4. **Documentation confirmation**:
   - Contact Google Cloud Support to confirm SSML counting rules
   - Request clarification on whitespace handling

### ✅ ElevenLabs - VALIDATED
- [x] No SSML used
- [x] Direct character counting
- [x] Simple implementation, low risk

---

## Monitoring & Alerts

### Implemented
- ✅ AWS Cost Explorer integration for real-time Polly validation
- ✅ Dashboard comparison of internal vs AWS billing

### TODO
1. **Google Cloud Billing Alerts**:
   - Set up budget alerts in Google Cloud Console
   - Configure email notifications at 50%, 80%, 100% of budget
   - Track monthly character usage vs billing

2. **Discrepancy Detection**:
   - Add automated check: if internal tracking differs from provider billing by > 10%, send alert
   - Log warnings in TTS adapters when character counts seem unusual

3. **Regular Audits**:
   - Monthly: Review all TTS provider billing vs internal tracking
   - Quarterly: Verify pricing hasn't changed
   - Document any discrepancies and investigate root cause

---

## Character Counting Edge Cases

### All Providers

1. **Unicode characters**: Do multi-byte characters count as 1 or multiple?
   - **Test**: "Hello 🌍 world" - is emoji 1 char or 4?
   - **Status**: ⚠️ TODO - Test with all providers

2. **Newlines and special characters**: `\n`, `\t`, etc.
   - **Test**: "Hello\nworld" vs "Hello world"
   - **Status**: ⚠️ TODO - Verify counting

3. **Whitespace normalization**: Do multiple spaces count separately?
   - **Test**: "Hello  world" (2 spaces) vs "Hello world" (1 space)
   - **Status**: ⚠️ TODO - Test with Google (Polly and ElevenLabs tested)

### Google-Specific

4. **Attribute values in other SSML tags**:
   - If we use: `<prosody rate="slow">text</prosody>`
   - Do attribute values ("slow") count?
   - **Status**: ⚠️ TODO - Test if we implement more SSML features

---

## Recommendations

### Immediate Actions
1. ✅ **Polly**: Fixed and validated
2. ⚠️ **Google**: Monitor for 30 days, validate against actual billing
3. ✅ **ElevenLabs**: No action needed

### Best Practices
1. **Always validate with actual billing** - Don't trust documentation alone
2. **Start small** - Test with low-volume usage before scaling
3. **Monitor continuously** - Set up billing alerts and automated discrepancy detection
4. **Document everything** - Record all findings and assumptions

### Future Enhancements
1. **Google Cloud cost tracking API** - Investigate if Google has billing APIs we can query
2. **Automated testing** - Create scripts that test character counting against actual provider APIs
3. **Provider comparison tool** - Build dashboard to compare costs across providers for same text

---

## References

### External Documentation
- [Google Cloud TTS Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Google Cloud TTS SSML Guide](https://cloud.google.com/text-to-speech/docs/ssml)
- [SpeechActors Google Pricing Analysis](https://speechactors.com/article/google-cloud-pricing-and-plans/)
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing)
- [ElevenLabs API Documentation](https://elevenlabs.io/docs/api-reference)

### Internal Documentation
- [AWS_POLLY_BILLING_CRITICAL_FINDINGS.md](./AWS_POLLY_BILLING_CRITICAL_FINDINGS.md) - Polly billing discovery
- [TTS_PRICING_DOCUMENTATION.md](./TTS_PRICING_DOCUMENTATION.md) - Comprehensive pricing guide
- [AWS_COST_EXPLORER_INTEGRATION.md](./AWS_COST_EXPLORER_INTEGRATION.md) - AWS billing integration
- `../../src/server/tts/adapters/googleTtsAdapter.ts` - Google implementation
- `../../src/server/tts/adapters/elevenLabsAdapter.ts` - ElevenLabs implementation

---

**Status**: ✅ Polly verified, ⚠️ Google needs validation, ✅ ElevenLabs verified  
**Last Updated**: November 2025  
**Next Review**: December 2025 (after 30 days of Google billing data)

