const fs = require('fs');

const output = JSON.parse(fs.readFileSync('transformers-output/output-step-4.json', 'utf8'));

console.log('✅ Final verification - paragraph structure with sentencesCount:');
console.log('- Total chapters:', output.chapters.length);
console.log('- Total paragraphs:', output.chapters.reduce((sum, ch) => sum + ch.paragraphs.length, 0));

// Check sample paragraphs
const sampleParagraphs = output.chapters[0].paragraphs.slice(0, 3);
console.log('\n📋 Sample paragraphs with all properties:');
sampleParagraphs.forEach((p, i) => {
  console.log(`  ${i+1}. pageNumber: ${p.pageNumber}, wordCount: ${p.wordCount}, sentencesCount: ${p.sentencesCount}`);
  console.log(`      content: ${p.content.substring(0, 60)}...`);
});

// Verify all paragraphs have all required properties
let allValid = true;
let totalParagraphs = 0;
let missingWordCount = 0;
let missingSentenceCount = 0;

output.chapters.forEach(chapter => {
  chapter.paragraphs.forEach(p => {
    totalParagraphs++;
    if (!p.pageNumber || !p.content) {
      allValid = false;
      console.log('Missing basic properties in paragraph:', Object.keys(p));
    }
    if (p.wordCount === undefined) {
      missingWordCount++;
      allValid = false;
    }
    if (p.sentencesCount === undefined) {
      missingSentenceCount++;
      allValid = false;
    }
  });
});

console.log('\n✅ All paragraphs have required properties:', allValid);
console.log('✅ Total paragraphs verified:', totalParagraphs);
console.log('- Missing wordCount:', missingWordCount);
console.log('- Missing sentencesCount:', missingSentenceCount);

// Show paragraph keys
console.log('\n📋 Paragraph properties:', Object.keys(output.chapters[0].paragraphs[0])); 