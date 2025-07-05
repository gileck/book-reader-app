const fs = require('fs');
const data = JSON.parse(fs.readFileSync('output/integrated-pipeline-results.json', 'utf8'));

console.log('=== PARAGRAPH VALIDATION AGAINST REQUIREMENTS.md ===\n');

// Get first chapter paragraphs for detailed validation
const firstChapter = data.chapters[0];
const firstChapterParagraphs = data.paragraphs.filter(p => p.chapterNumber === firstChapter.number);

console.log('CHAPTER:', firstChapter.title);
console.log('PAGES:', firstChapter.startPage + '-' + firstChapter.endPage);
console.log('PARAGRAPH COUNT:', firstChapterParagraphs.length);
console.log('');

// Validation stats
let stats = {
  total: firstChapterParagraphs.length,
  startsWithCapital: 0,
  endsWithPunctuation: 0,
  wordCountValid: 0,
  targetRange: 0,
  absoluteRangeViolations: [],
  structureViolations: [],
  minWords: 999999,
  maxWords: 0,
  totalWords: 0
};

console.log('=== DETAILED VALIDATION ===\n');

firstChapterParagraphs.forEach((p, index) => {
  const text = p.text.replace('...', ''); // Remove truncation marker
  const wordCount = p.wordCount;
  
  // Check mandatory chunk structure rules from REQUIREMENTS.md
  const startsWithCapital = /^[A-Z]/.test(text.trim());
  const endsWithPunctuation = /[.!?]$/.test(text.trim()) || text.includes('...');
  const wordCountInAbsoluteRange = wordCount >= 50 && wordCount <= 500;
  const wordCountInTargetRange = wordCount >= 80 && wordCount <= 300;
  
  // Count successes
  if (startsWithCapital) stats.startsWithCapital++;
  if (endsWithPunctuation) stats.endsWithPunctuation++;
  if (wordCountInAbsoluteRange) stats.wordCountValid++;
  if (wordCountInTargetRange) stats.targetRange++;
  
  // Track violations
  if (!startsWithCapital) {
    stats.structureViolations.push(`${p.id}: Does not start with capital - "${text.substring(0, 30)}..."`);
  }
  if (!endsWithPunctuation) {
    stats.structureViolations.push(`${p.id}: Does not end with punctuation - "...${text.substring(text.length - 30)}"`);
  }
  if (!wordCountInAbsoluteRange) {
    stats.absoluteRangeViolations.push(`${p.id}: Word count ${wordCount} outside 50-500 range`);
  }
  
  // Track word count stats
  stats.minWords = Math.min(stats.minWords, wordCount);
  stats.maxWords = Math.max(stats.maxWords, wordCount);
  stats.totalWords += wordCount;
});

const avgWords = Math.round(stats.totalWords / stats.total);

// Show violations
if (stats.structureViolations.length > 0) {
  console.log('STRUCTURE VIOLATIONS:');
  stats.structureViolations.forEach(v => console.log('❌', v));
  console.log('');
}

if (stats.absoluteRangeViolations.length > 0) {
  console.log('WORD COUNT VIOLATIONS:');
  stats.absoluteRangeViolations.forEach(v => console.log('❌', v));
  console.log('');
}

console.log('=== REQUIREMENTS COMPLIANCE SUMMARY ===\n');

// Mandatory requirements from REQUIREMENTS.md
console.log('**MANDATORY CHUNK STRUCTURE RULES:**');
const allStartCapital = stats.startsWithCapital === stats.total;
const allEndPunctuation = stats.endsWithPunctuation === stats.total;
const allValidWordCount = stats.wordCountValid === stats.total;

console.log(allStartCapital ? '✅ PASS' : '❌ FAIL', 
           `- Chunk starts with capital: ${stats.startsWithCapital}/${stats.total} (${Math.round(100 * stats.startsWithCapital / stats.total)}%)`);
console.log(allEndPunctuation ? '✅ PASS' : '❌ FAIL', 
           `- Chunk ends with punctuation: ${stats.endsWithPunctuation}/${stats.total} (${Math.round(100 * stats.endsWithPunctuation / stats.total)}%)`);
console.log(allValidWordCount ? '✅ PASS' : '❌ FAIL', 
           `- Word count 50-500 (absolute): ${stats.wordCountValid}/${stats.total} (${Math.round(100 * stats.wordCountValid / stats.total)}%)`);

console.log('\n**TARGET GUIDELINES (FLEXIBLE):**');
console.log(`🎯 Target range 80-300 words: ${stats.targetRange}/${stats.total} (${Math.round(100 * stats.targetRange / stats.total)}%)`);

console.log('\n**WORD COUNT STATISTICS:**');
console.log('Min words:', stats.minWords);
console.log('Max words:', stats.maxWords);
console.log('Average words:', avgWords);

console.log('\n**OTHER REQUIREMENTS TO VERIFY:**');
console.log('⚠️  Paragraph-based chunking: NEED SOURCE VALIDATION');
console.log('⚠️  Literal \\n detection: NEED SOURCE VALIDATION');
console.log('⚠️  Sentence integrity: NEED FULL TEXT VALIDATION');
console.log('⚠️  Cross-page merging: NEED VALIDATION');
console.log('⚠️  Page number accuracy: NEED VALIDATION');

console.log('\n=== FINAL COMPLIANCE STATUS ===\n');

const criticalFailures = !allStartCapital || !allEndPunctuation || !allValidWordCount;

if (criticalFailures) {
  console.log('❌ CRITICAL FAILURE: Mandatory requirements not met');
  console.log('   Required actions:');
  if (!allStartCapital) console.log('   - Fix paragraphs that don\'t start with capital letters');
  if (!allEndPunctuation) console.log('   - Fix paragraphs that don\'t end with punctuation');
  if (!allValidWordCount) console.log('   - Fix paragraphs outside 50-500 word absolute range');
} else {
  console.log('✅ SUCCESS: All mandatory chunk structure requirements met!');
  console.log('   - All paragraphs start with capital letters');
  console.log('   - All paragraphs end with proper punctuation');
  console.log('   - All paragraphs within 50-500 word absolute range');
  console.log(`   - ${Math.round(100 * stats.targetRange / stats.total)}% of paragraphs in target 80-300 word range`);
}

