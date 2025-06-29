const fs = require('fs');
const path = require('path');

// Load existing parsed data
const outputPath = 'files/Transformers/output.json';
const debugPath = 'files/Transformers/debug/7-extracted-links.json';

console.log('📋 Loading test data...');

if (!fs.existsSync(outputPath)) {
    console.error('❌ Output file not found:', outputPath);
    process.exit(1);
}

if (!fs.existsSync(debugPath)) {
    console.error('❌ Debug links file not found:', debugPath);
    process.exit(1);
}

const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const extractedLinks = JSON.parse(fs.readFileSync(debugPath, 'utf8'));

// Extract all chunks from the parsed data
const allChunks = [];
output.chapters.forEach(chapter => {
    allChunks.push(...chapter.content.chunks);
});

console.log(`📊 Loaded ${allChunks.length} chunks and ${extractedLinks.length} links`);

// Our link resolution functions (copied from the parser)
function extractPageNumbersFromIndexText(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const pageNumbers = [];
    // Enhanced regex pattern to match various page number formats
    const pagePattern = /(?:\s|^)(\d{1,3}(?:–\d{1,3})?(?:,\s*\d{1,3}(?:–\d{1,3})?)*)(?=\s|$|[A-Za-z])/g;
    
    let match;
    while ((match = pagePattern.exec(text)) !== null) {
        const pageText = match[1];
        
        // Handle comma-separated page numbers (e.g., "59, 271")
        const parts = pageText.split(',').map(p => p.trim());
        
        for (const part of parts) {
            // Handle range notation (e.g., "150–51")
            if (part.includes('–')) {
                const [start, end] = part.split('–').map(p => parseInt(p.trim()));
                if (!isNaN(start)) {
                    pageNumbers.push(start);
                    if (!isNaN(end)) {
                        // Handle short form ranges like "150–51" (means 150-151)
                        const fullEnd = end < 100 && start >= 100 ? 
                            Math.floor(start / 100) * 100 + end : end;
                        for (let i = start + 1; i <= fullEnd; i++) {
                            pageNumbers.push(i);
                        }
                    }
                }
            } else {
                const pageNum = parseInt(part);
                if (!isNaN(pageNum) && pageNum > 0 && pageNum < 1000) {
                    pageNumbers.push(pageNum);
                }
            }
        }
    }
    
    return [...new Set(pageNumbers)].sort((a, b) => a - b);
}

function findChunksByCoordinates(chunks, targetX, targetY, tolerance = 50) {
    const matches = [];
    
    for (const chunk of chunks) {
        if (!chunk.coordinateBounds) continue;
        
        const { x1, y1, x2, y2 } = chunk.coordinateBounds;
        
        if (targetX >= x1 - tolerance && targetX <= x2 + tolerance &&
            targetY >= y1 - tolerance && targetY <= y2 + tolerance) {
            matches.push(chunk);
        }
    }
    
    return matches;
}

function findDestinationChunk(link, chunks) {
    console.log(`\n🔍 Processing link: "${link.linkText || link.text}" -> page ${link.destinationPage}`);
    
    // Get all chunks on the destination page
    const destinationChunks = chunks.filter(chunk => chunk.pageNumber === link.destinationPage);
    console.log(`📍 Found ${destinationChunks.length} chunks on page ${link.destinationPage}`);
    
    if (destinationChunks.length === 0) {
        console.log('❌ No chunks found on destination page');
        return null;
    }

    // Check for simple numbered footnotes (e.g., "1", "2", "3") that might be mismapped
    const linkText = link.linkText || link.text;
    const isSimpleFootnote = /^\d+$/.test(linkText);
    
    console.log(`🔍 Link text analysis: "${linkText}" - isSimpleFootnote: ${isSimpleFootnote}`);
    
    if (isSimpleFootnote) {
        const footnoteNumber = linkText;
        const footnoteChunks = destinationChunks.filter(chunk => 
            chunk.text.match(new RegExp(`^${footnoteNumber}\\s`))
        );
        
        console.log(`🔍 Footnote "${footnoteNumber}" - found ${footnoteChunks.length} matching chunks on page ${link.destinationPage}`);
        
        if (footnoteChunks.length > 0) {
            console.log(`✅ Found direct footnote match for "${footnoteNumber}" on page ${link.destinationPage}`);
            console.log(`📝 Target chunk ${footnoteChunks[0].index}: "${footnoteChunks[0].text.substring(0, 100)}..."`);
            return {
                chunk: footnoteChunks[0],
                method: 'footnote-direct',
                confidence: 'high'
            };
        } else {
            console.log(`⚠️  No footnote starting with "${footnoteNumber}" found on page ${link.destinationPage}`);
            // List all chunks that start with numbers on this page for debugging
            const numberChunks = destinationChunks.filter(chunk => chunk.text.match(/^\d+\s/));
            console.log(`🔍 All number-starting chunks on page ${link.destinationPage}:`);
            numberChunks.forEach((chunk, idx) => {
                console.log(`  ${idx + 1}. Chunk ${chunk.index}: "${chunk.text.substring(0, 50)}..."`);
            });
        }
    }
    
    // Check if this might be an index entry with embedded page numbers
    const pageNumbersInText = extractPageNumbersFromIndexText(linkText);
    
    if (pageNumbersInText.length > 0 && !pageNumbersInText.includes(link.destinationPage)) {
        console.log(`⚠️  Potential PDF link error: "${linkText}" points to page ${link.destinationPage} but text mentions pages ${pageNumbersInText.join(', ')}`);
        
        // Try to find a better match using the page numbers from the text
        for (const pageNum of pageNumbersInText) {
            const textBasedChunks = chunks.filter(chunk => 
                chunk.pageNumber === pageNum && 
                chunk.text.match(/^\d+\s/)
            );
            
            if (textBasedChunks.length > 0) {
                console.log(`🔧 Using text-based correction: page ${pageNum} instead of ${link.destinationPage}`);
                return {
                    chunk: textBasedChunks[0],
                    method: 'text-corrected',
                    confidence: 'medium'
                };
            }
        }
    }

    // Method 1: Use coordinates if available
    if (link.destinationCoordinates) {
        console.log(`🎯 Using coordinate method - coords: ${link.destinationCoordinates.x}, ${link.destinationCoordinates.y}`);
        const { x, y } = link.destinationCoordinates;
        const coordMatches = findChunksByCoordinates(destinationChunks, x, y);

        if (coordMatches.length > 0) {
            console.log(`🎯 Coordinate method found chunk ${coordMatches[0].index}: "${coordMatches[0].text.substring(0, 100)}..."`);
            return {
                chunk: coordMatches[0],
                method: 'coordinates',
                confidence: 'high'
            };
        }
    }

    // Fallback: Return first chunk on page
    console.log(`🔄 Using fallback: first chunk on page ${link.destinationPage}`);
    return {
        chunk: destinationChunks[0],
        method: 'page_fallback',
        confidence: 'very_low'
    };
}

// Test the specific problematic link (linkIndex 34)
console.log('\n🎯 Testing linkIndex 34 specifically...');

if (extractedLinks.length <= 34) {
    console.error('❌ Not enough links found. Expected at least 35 links.');
    process.exit(1);
}

const testLink = extractedLinks[34];
console.log(`📋 Link 34 details:`, {
    text: testLink.text,
    linkText: testLink.linkText,
    destinationPage: testLink.destinationPage,
    destinationCoordinates: testLink.destinationCoordinates
});

// Test our resolution logic
console.log('\n🧪 Testing resolution logic...');
const result = findDestinationChunk(testLink, allChunks);

if (result) {
    console.log(`\n✅ Resolution result:`);
    console.log(`   Method: ${result.method}`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Target chunk: ${result.chunk.index}`);
    console.log(`   Chunk text: "${result.chunk.text.substring(0, 200)}..."`);
    console.log(`   Page: ${result.chunk.pageNumber}`);
} else {
    console.log(`\n❌ Resolution failed - no result returned`);
}

// Also test a few other footnote links to ensure the logic works broadly
console.log('\n🔍 Testing other footnote links...');
const footnoteLinks = extractedLinks.filter((link, index) => {
    const linkText = link.linkText || link.text;
    return /^\d+$/.test(linkText) && index !== 34; // Simple numbered footnotes, excluding our test case
});

console.log(`📊 Found ${footnoteLinks.length} other footnote links to test`);

footnoteLinks.slice(0, 3).forEach((link, index) => {
    console.log(`\n--- Testing footnote link ${index + 1} ---`);
    const testResult = findDestinationChunk(link, allChunks);
    if (testResult) {
        console.log(`Result: ${testResult.method} -> chunk ${testResult.chunk.index} on page ${testResult.chunk.pageNumber}`);
    } else {
        console.log(`Result: FAILED`);
    }
});

console.log('\n🏁 POC test completed!'); 