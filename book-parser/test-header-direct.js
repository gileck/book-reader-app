const { chunkTextWithParagraphs } = require('./parser/steps/text-processor');

// Test text with heading markers as would be created by preserveHeadingsInPageText
const testText = '⟨⟨HEADING⟩⟩Chapter 1: Introduction⟨⟨/HEADING⟩⟩ ⟨⟨LINE_BREAK⟩⟩ This is regular text content that follows the header. It should be marked as text type. ⟨⟨LINE_BREAK⟩⟩ ⟨⟨HEADING⟩⟩Section 1.1: Overview⟨⟨/HEADING⟩⟩ ⟨⟨LINE_BREAK⟩⟩ More regular text content here.';

console.log('=== Direct Header Test ===');
console.log('Input text:', testText);
console.log('');

const result = chunkTextWithParagraphs(testText, 5, 15, 1);

console.log('Results:');
result.forEach((paragraph, i) => {
    console.log(`\nParagraph ${i}:`);
    console.log(`  Type: ${paragraph.type}`);
    if (paragraph.level) console.log(`  Level: h${paragraph.level}`);
    console.log(`  Chunks: ${paragraph.chunks.length}`);
    paragraph.chunks.forEach((chunk, j) => {
        console.log(`    Chunk ${j} (${chunk.type}): "${chunk.text}"`);
    });
});

// Test with processChapter function too
const { processChapter } = require('./parser/steps/chunk-processor');

console.log('\n=== ProcessChapter Test ===');
const fakeChapter = {
    chapterNumber: 1,
    title: 'Test Chapter',
    content: [testText],
    pages: [{pageNumber: 1}],
    startPageNumber: 1
};

const processedChapter = processChapter(fakeChapter, null);
console.log('Flat chunks:');
processedChapter.content.chunks.forEach((chunk, i) => {
    console.log(`Chunk ${i}: type="${chunk.type}", paragraphType="${chunk.paragraphType}", text="${chunk.text.substring(0, 50)}..."`);
}); 