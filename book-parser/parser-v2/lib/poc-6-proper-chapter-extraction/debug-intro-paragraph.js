const fs = require('fs');
const path = require('path');

// Load the results file
const resultsPath = path.join(__dirname, 'output', 'integrated-pipeline-results.json');
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

console.log('🔍 Debugging Introduction Chapter Paragraph Detection...\n');

// Find the Introduction chapter
const introChapter = results.chapters.find(ch => ch.number === 0);
console.log('📊 Introduction Chapter Info:');
console.log(`   Title: "${introChapter.title}"`);
console.log(`   Pages: ${introChapter.startPage}-${introChapter.endPage}`);
console.log(`   Text Length: ${introChapter.textLength} chars`);
console.log(`   Paragraph Count: ${introChapter.paragraphCount}`);

console.log('\n📝 Chapter Text Start (first 1000 chars):');
console.log(`"${introChapter.textStart}"`);

console.log('\n📝 Chapter Text End (last 1000 chars):');
console.log(`"${introChapter.textEnd}"`);

// Find the single paragraph
const introParagraph = results.paragraphs.find(p => p.chapterNumber === 0);
console.log('\n🔍 Single Paragraph Found:');
console.log(`   ID: ${introParagraph.id}`);
console.log(`   Word Count: ${introParagraph.wordCount}`);
console.log(`   Char Count: ${introParagraph.charCount}`);
console.log(`   Page: ${introParagraph.pageNumber}`);
console.log(`   Position: ${introParagraph.position}`);

console.log('\n📝 Paragraph Text (full):');
console.log(`"${introParagraph.text}"`);

// Check newlines in paragraph text
const newlineCount = (introParagraph.text.match(/\n/g) || []).length;
console.log(`\n🔍 Paragraph Analysis:`);
console.log(`   Contains ${newlineCount} newline characters`);
console.log(`   Text ends with: "${introParagraph.text.slice(-50)}"`);
console.log(`   Text starts with: "${introParagraph.text.slice(0, 50)}"`);

// Check if chapter text has newlines
const chapterNewlineCount = (introChapter.textStart.match(/\n/g) || []).length;
console.log(`\n🔍 Chapter Text Analysis:`);
console.log(`   Chapter textStart contains ${chapterNewlineCount} newline characters`);
console.log(`   Should have been split into multiple paragraphs based on these newlines`);

console.log('\n❓ ISSUE: Despite having newlines in chapter text, only 1 paragraph was detected');
console.log('   This suggests the paragraph detection algorithm is not working correctly'); 