const { chunkTextWithParagraphs, markHeadersInText } = require('./parser/steps/text-processor');

// Test the complete pipeline
const testText = `yet had a general catalytic activity, unlike almost anything else known in biology at the time. Almost ...
Pulling hydrogen
The molecule is beautifully symmetrical, as my portrait shows. It has two carboxylate groups, one at each end.

The entire field got stuck for two decades. It took Mitchell's unprecedented conceptual leap to answer the question.
Circular reasoning
Only Krebs was thinking about the cryptic crossword in the right way; even his closest collaborators had little.

These 2H are not free in solution, nor are they shuttled by carboxylic acids, as Szent-Györgyi once thought.
Separating charge
I have talked about stripping hydrogen (2H) from molecules and feeding them to oxygen. These 2H are not free.`;

console.log('=== Complete Pipeline Test ===');
console.log('Step 1: Original text');
console.log(testText);
console.log('');

console.log('Step 2: Mark headers in text');
const markedText = markHeadersInText(testText);
console.log(markedText);
console.log('');

console.log('Step 3: Chunk text with paragraphs');
const chunks = chunkTextWithParagraphs(markedText, 5, 15, 1);
console.log(`Found ${chunks.length} paragraphs`);
console.log('');

console.log('Step 4: Extract all chunks');
const allChunks = [];
for (let i = 0; i < chunks.length; i++) {
    const paragraph = chunks[i];
    console.log(`Paragraph ${i}: type=${paragraph.type}, chunks=${paragraph.chunks.length}`);
    
    for (let j = 0; j < paragraph.chunks.length; j++) {
        const chunk = paragraph.chunks[j];
        allChunks.push(chunk);
        console.log(`  Chunk ${j}: type="${chunk.type}", text="${chunk.text}"`);
    }
}

console.log('');
console.log('Step 5: Summary');
const headerChunks = allChunks.filter(chunk => chunk.type === 'header');
const textChunks = allChunks.filter(chunk => chunk.type === 'text');

console.log(`Total chunks: ${allChunks.length}`);
console.log(`Header chunks: ${headerChunks.length}`);
console.log(`Text chunks: ${textChunks.length}`);
console.log('');

console.log('Headers found:');
headerChunks.forEach((chunk, i) => {
    console.log(`${i + 1}. "${chunk.text}" (${chunk.wordCount} words)`);
}); 