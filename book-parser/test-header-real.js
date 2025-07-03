const { isHeader, markHeadersInText } = require('./parser/steps/text-processor');

// Test with real book text that should contain headers
const testText = `yet had a general catalytic activity, unlike almost anything else known in biology at the time. Almost ...
Pulling hydrogen
The molecule is beautifully symmetrical, as my portrait shows. It has two carboxylate groups, one at each end.

The entire field got stuck for two decades. It took Mitchell's unprecedented conceptual leap to answer the question.
Circular reasoning
Only Krebs was thinking about the cryptic crossword in the right way; even his closest collaborators had little.

These 2H are not free in solution, nor are they shuttled by carboxylic acids, as Szent-Györgyi once thought.
Separating charge
I have talked about stripping hydrogen (2H) from molecules and feeding them to oxygen. These 2H are not free.`;

console.log('=== Testing Real Book Text ===');
console.log('Input text:');
console.log(testText);
console.log('');

// Test individual header detection
const lines = testText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
console.log('=== Individual Line Analysis ===');
for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const previousLine = i > 0 ? lines[i - 1] : null;
    const nextLine = i < lines.length - 1 ? lines[i + 1] : null;
    
    const isHeaderResult = isHeader(currentLine, previousLine, nextLine, lines, i);
    
    if (isHeaderResult) {
        console.log(`✓ HEADER: "${currentLine}"`);
    } else {
        console.log(`  text: "${currentLine.substring(0, 50)}..."`);
    }
}

console.log('');
console.log('=== markHeadersInText Test ===');
const markedText = markHeadersInText(testText);
console.log('Marked text:');
console.log(markedText); 