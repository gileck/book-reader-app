const fs = require('fs');

// Load the output
const output = JSON.parse(fs.readFileSync('transformers-output/output-step-3.json'));
const allPages = output.chapters.flatMap(ch => ch.pages);
const page13 = allPages.find(p => p.pageNumber === 13);
const page14 = allPages.find(p => p.pageNumber === 14);

console.log('=== DEBUGGING PAGES 13-14 SENTENCE MERGING ===');

const currentContent = page13.content.trim();
const nextContent = page14.content.trim();
const lastChar = currentContent[currentContent.length - 1];

console.log('Page 13 ends with:', JSON.stringify(currentContent.slice(-30)));
console.log('Page 13 last char:', JSON.stringify(lastChar));
console.log('Should trigger merging:', !['.', '!', '?', ':', ';'].includes(lastChar));
console.log('');

console.log('Page 14 starts with:', JSON.stringify(nextContent.slice(0, 100)));
console.log('');

// Simulate the exact sentence merging logic
console.log('=== SIMULATING SENTENCE MERGING LOGIC ===');
let fragmentEnd = -1;

for (let charIndex = 1; charIndex <= Math.min(400, nextContent.length); charIndex++) {
    const char = nextContent[charIndex - 1];
    
    if (['.', '!', '?'].includes(char)) {
        console.log(`Found ${char} at position ${charIndex - 1}`);
        
        if (char === '.') {
            // Period logic (existing)
            console.log('  Processing period...');
            // ... period logic would go here
        } else {
            // Exclamation/question mark logic
            console.log('  Processing exclamation/question mark...');
            const charAfter = nextContent[charIndex];
            console.log('  Character after:', JSON.stringify(charAfter), 'char code:', charAfter ? charAfter.charCodeAt(0) : 'undefined');
            
            if (charIndex === nextContent.length) {
                console.log('  -> End of content, treating as sentence end');
                fragmentEnd = charIndex;
                break;
            } else if (nextContent[charIndex] === ' ' || nextContent[charIndex] === '\n' || nextContent[charIndex] === '\t') {
                console.log('  -> Followed by whitespace, treating as sentence end');
                fragmentEnd = charIndex;
                break;
            } else if (/['"`\)\]\}]/.test(nextContent[charIndex])) {
                console.log('  -> Followed by closing punctuation, checking further...');
                let afterClosing = charIndex + 1;
                while (afterClosing < nextContent.length && /['"`\)\]\}]/.test(nextContent[afterClosing])) {
                    console.log(`    Skipping closing punctuation at ${afterClosing}: ${JSON.stringify(nextContent[afterClosing])}`);
                    afterClosing++;
                }
                
                if (afterClosing === nextContent.length) {
                    console.log('    -> End of content after closing punctuation');
                    fragmentEnd = charIndex;
                    break;
                } else if (nextContent[afterClosing] === ' ' || nextContent[afterClosing] === '\n' || nextContent[afterClosing] === '\t') {
                    console.log(`    -> Whitespace found after closing punctuation at ${afterClosing}`);
                    fragmentEnd = charIndex;
                    break;
                } else {
                    console.log(`    -> No whitespace after closing punctuation, continuing... Next char: ${JSON.stringify(nextContent[afterClosing])}`);
                }
            } else {
                console.log(`  -> Followed by non-whitespace: ${JSON.stringify(nextContent[charIndex])}`);
            }
        }
    }
}

if (fragmentEnd > 0) {
    console.log('');
    console.log('✅ FOUND SENTENCE COMPLETION AT POSITION:', fragmentEnd);
    console.log('Fragment would be:', JSON.stringify(nextContent.substring(0, fragmentEnd)));
    console.log('Merged sentence would be:', JSON.stringify(currentContent + ' ' + nextContent.substring(0, fragmentEnd)));
} else {
    console.log('');
    console.log('❌ NO SENTENCE COMPLETION FOUND');
}
