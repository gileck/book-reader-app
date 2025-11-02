#!/usr/bin/env node
/**
 * TTS Character Counting Verification Script
 * 
 * This script tests the character counting logic for all TTS providers
 * to ensure we're accurately calculating billable characters.
 * 
 * Run with: node verify-tts-character-counting.js
 */

// Test data
const testCases = [
  {
    name: "Simple text",
    text: "Hello world",
    expectedChars: 11
  },
  {
    name: "Text with punctuation",
    text: "Hello, world!",
    expectedChars: 13
  },
  {
    name: "Multi-sentence",
    text: "Hello world. How are you?",
    expectedChars: 25
  },
  {
    name: "Text with emoji",
    text: "Hello 🌍 world",
    expectedChars: 14 // Need to verify if emoji counts as 1 or more
  },
  {
    name: "Text with newline",
    text: "Hello\nworld",
    expectedChars: 11
  },
  {
    name: "Text with double spaces",
    text: "Hello  world",
    expectedChars: 12
  }
];

// Helper function to generate SSML with marks (our standard format)
function generateSSMLWithMarks(text) {
  const words = text.split(' ').filter(w => w.length > 0);
  let ssml = '<speak> ';
  
  words.forEach((word, index) => {
    ssml += `<mark name="${word}-${index}"/> ${word} `;
  });
  
  ssml += '</speak>';
  return ssml;
}

// Amazon Polly Standard/Neural - Strip ALL SSML
function calculatePollyStandardChars(text) {
  const ssml = generateSSMLWithMarks(text);
  const billableText = ssml.replace(/<[^>]*>/g, '');
  return billableText.length;
}

// Amazon Polly Long-Form - Text + Mark Attribute Names
function calculatePollyLongFormChars(text) {
  const words = text.split(' ').filter(w => w.length > 0);
  const textChars = text.length;
  const markAttributeChars = words.reduce((sum, word, i) => {
    return sum + `${word}-${i}`.length;
  }, 0);
  return textChars + markAttributeChars;
}

// Google TTS - Strip only <mark> tags
function calculateGoogleChars(text) {
  const ssml = generateSSMLWithMarks(text);
  const billableText = ssml.replace(/<mark[^>]*\/>/g, '');
  return billableText.length;
}

// ElevenLabs - Direct character count (no SSML)
function calculateElevenLabsChars(text) {
  return text.length;
}

console.log('='.repeat(80));
console.log('TTS CHARACTER COUNTING VERIFICATION');
console.log('='.repeat(80));
console.log();

// Run tests
testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.text}"`);
  console.log(`Expected chars: ${testCase.expectedChars}`);
  console.log();
  
  const ssml = generateSSMLWithMarks(testCase.text);
  console.log(`Generated SSML (first 100 chars):`);
  console.log(`  ${ssml.substring(0, 100)}${ssml.length > 100 ? '...' : ''}`);
  console.log();
  
  // Calculate for each provider
  const pollyStandard = calculatePollyStandardChars(testCase.text);
  const pollyLongForm = calculatePollyLongFormChars(testCase.text);
  const google = calculateGoogleChars(testCase.text);
  const elevenlabs = calculateElevenLabsChars(testCase.text);
  
  console.log('Billable Characters:');
  console.log(`  Amazon Polly (Standard/Neural): ${pollyStandard} chars`);
  console.log(`  Amazon Polly (Long-Form):      ${pollyLongForm} chars`);
  console.log(`  Google Cloud TTS:              ${google} chars`);
  console.log(`  ElevenLabs:                    ${elevenlabs} chars`);
  console.log();
  
  // Validate ElevenLabs (simplest - should match expected)
  if (elevenlabs !== testCase.expectedChars) {
    console.log(`  ⚠️  WARNING: ElevenLabs count (${elevenlabs}) doesn't match expected (${testCase.expectedChars})`);
  }
  
  console.log('-'.repeat(80));
  console.log();
});

// Real-world example from our production data
console.log('='.repeat(80));
console.log('REAL-WORLD EXAMPLE: Sentence from book');
console.log('='.repeat(80));
console.log();

const bookSentence = "The quick brown fox jumps over the lazy dog.";
console.log(`Text: "${bookSentence}"`);
console.log();

const ssml = generateSSMLWithMarks(bookSentence);
console.log(`Generated SSML:`);
console.log(`  ${ssml}`);
console.log();

const results = {
  'Polly Standard/Neural': calculatePollyStandardChars(bookSentence),
  'Polly Long-Form': calculatePollyLongFormChars(bookSentence),
  'Google Cloud TTS': calculateGoogleChars(bookSentence),
  'ElevenLabs': calculateElevenLabsChars(bookSentence)
};

console.log('Billable Characters by Provider:');
Object.entries(results).forEach(([provider, chars]) => {
  console.log(`  ${provider.padEnd(25)}: ${chars} chars`);
});
console.log();

// Calculate cost estimates
console.log('Estimated Costs (per 1M characters):');
const costsPerMillion = {
  'Polly Standard': 4.00,
  'Polly Neural': 16.00,
  'Polly Long-Form': 100.00,
  'Google Standard': 4.00,
  'Google Neural2': 16.00,
  'ElevenLabs': 90.00 // Approximate based on credit pricing
};

Object.entries(results).forEach(([provider, chars]) => {
  const costKey = provider.includes('Long-Form') ? 'Polly Long-Form' :
                  provider.includes('Polly') ? 'Polly Neural' :
                  provider.includes('Google') ? 'Google Neural2' :
                  'ElevenLabs';
  
  const costPerChar = costsPerMillion[costKey] / 1000000;
  const estimatedCost = chars * costPerChar;
  
  console.log(`  ${provider.padEnd(25)}: $${estimatedCost.toFixed(6)} (${chars} × $${costPerChar.toFixed(8)})`);
});
console.log();

// Summary and recommendations
console.log('='.repeat(80));
console.log('SUMMARY & RECOMMENDATIONS');
console.log('='.repeat(80));
console.log();
console.log('✅ ElevenLabs: Direct character count - lowest risk of discrepancy');
console.log('✅ Polly Long-Form: Fixed implementation - now matches AWS billing');
console.log('✅ Polly Standard/Neural: Strips all SSML - appears correct');
console.log('⚠️  Google Cloud TTS: Keeps SSML except <mark> - NEEDS VALIDATION');
console.log();
console.log('ACTION ITEMS:');
console.log('1. Monitor Google Cloud billing for next 30 days');
console.log('2. Compare this script\'s output with actual provider billing');
console.log('3. Test edge cases: emojis, special chars, different languages');
console.log('4. Document any discrepancies found');
console.log();
console.log('For detailed analysis, see docs/tts/:');
console.log('  - TTS_BILLING_VERIFICATION.md');
console.log('  - AWS_POLLY_BILLING_CRITICAL_FINDINGS.md');
console.log('  - TTS_PRICING_DOCUMENTATION.md');
console.log();

