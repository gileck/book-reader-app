const fs = require('fs');

// Read the current output
const output = JSON.parse(fs.readFileSync('./output.json', 'utf8'));
const currentChunks = output.chapters[0].content.chunks;

console.log('=== COMPARISON: CURRENT vs EXPECTED ===\n');

console.log('CURRENT CHUNK 0:');
console.log(`"${currentChunks[0].text}"\n`);

console.log('CURRENT CHUNK 1:');
console.log(`"${currentChunks[1].text}"\n`);

console.log('CURRENT CHUNK 2:');
console.log(`"${currentChunks[2].text}"\n`);

console.log('=== ISSUES IDENTIFIED ===');
console.log('1. CHUNK 0 ends with: "If you shrink yourself 8"');
console.log('   - This should continue as one sentence: "If you shrink yourself down to the size of a molecule"');
console.log('   - The "8" is a page number artifact that should be removed');
console.log('   - Page breaks should not split sentences\n');

console.log('2. The sentence is incorrectly split across chunks 0 and 1');
console.log('   - Current: chunk 0 ends with "If you shrink yourself 8"');
console.log('   - Current: chunk 1 starts with "down to the size of a molecule"');
console.log('   - Expected: this should be one continuous sentence in chunk 2\n');

console.log('3. Paragraph structure is not preserved');
console.log('   - Natural paragraph breaks should be used for chunking');
console.log('   - Page breaks should be ignored for chunk boundaries\n');

console.log('=== NEXT STEPS ===');
console.log('1. Fix cross-page sentence merging in chapter-detector.js');
console.log('2. Improve paragraph detection to avoid splitting mid-sentence');
console.log('3. Remove page number artifacts from text');
console.log('4. Test with expected-chunks.txt as reference'); 