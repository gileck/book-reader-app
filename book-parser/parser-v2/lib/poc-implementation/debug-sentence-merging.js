const fs = require('fs');

// Load the output
const output = JSON.parse(fs.readFileSync('transformers-output/output-step-3.json'));
const allPages = output.chapters.flatMap(ch => ch.pages);
const page10 = allPages.find(p => p.pageNumber === 10);
const page11 = allPages.find(p => p.pageNumber === 11);

console.log('=== DEBUGGING SENTENCE MERGING FOR PAGES 10-11 ===');
console.log('');

// Check the current content
const currentContent = page10.content.trim();
const nextContent = page11.content.trim();
const lastChar = currentContent[currentContent.length - 1];

console.log('Page 10 ends with:', JSON.stringify(currentContent.slice(-50)));
console.log('Page 10 last char:', JSON.stringify(lastChar));
console.log('Should trigger merging:', !['.', '!', '?', ':', ';'].includes(lastChar));
console.log('');

console.log('Page 11 starts with:', JSON.stringify(nextContent.slice(0, 100)));
console.log('');

// Simulate the sentence merging logic
console.log('=== SIMULATING SENTENCE MERGING LOGIC ===');
let fragmentEnd = -1;

// Look for sentence completion in first part of next page
for (let charIndex = 1; charIndex <= Math.min(200, nextContent.length); charIndex++) {
    const char = nextContent[charIndex - 1];
    
    if (['.', '!', '?'].includes(char)) {
        // Found potential sentence end - check if it's followed by appropriate spacing
        if (charIndex === nextContent.length || 
            nextContent[charIndex] === ' ' || 
            nextContent[charIndex] === '\n' ||
            nextContent[charIndex] === '\t') {
            fragmentEnd = charIndex;
            console.log(`Found sentence end at position ${charIndex}: "${char}"`);
            console.log(`Fragment would be: "${nextContent.substring(0, fragmentEnd)}"`);
            break;
        }
    }
}

if (fragmentEnd === -1) {
    console.log('No sentence completion found in first 200 characters');
    console.log('First 200 characters of next page:');
    console.log(JSON.stringify(nextContent.substring(0, 200)));
    
    // Look for period beyond 200 characters
    const periodIndex = nextContent.indexOf('.');
    console.log('');
    console.log('First period found at position:', periodIndex);
    if (periodIndex !== -1) {
        console.log('Text around period:', JSON.stringify(nextContent.substring(Math.max(0, periodIndex - 30), periodIndex + 30)));
    }
}

console.log('');
console.log('=== FULL CONTENT ANALYSIS ===');
console.log('Page 10 content length:', currentContent.length);
console.log('Page 11 content length:', nextContent.length);
console.log('Page 11 first 400 chars:', JSON.stringify(nextContent.substring(0, 400)));
