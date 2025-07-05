const fs = require('fs');
const path = require('path');

// Function to split text by literal newlines (from the POC script)
function splitByNewlines(rawText) {
    console.log(`📝 Using literal newlines as paragraph boundaries...`);

    // Normalize newlines 
    const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split by single newlines - each newline marks end of paragraph
    const paragraphs = normalizedText.split('\n');

    console.log(`📊 Found ${paragraphs.length} raw paragraph boundaries`);

    // Clean and filter paragraphs
    const cleanedParagraphs = paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .filter(p => !/^\d+$/.test(p)) // Remove standalone page numbers
        .filter(p => p.length >= 10);  // Minimum 10 characters

    console.log(`✅ ${cleanedParagraphs.length} paragraphs after cleaning`);

    return cleanedParagraphs;
}

async function testIntroductionParagraphDetection() {
    console.log('🧪 Testing literal newline paragraph detection on Introduction chapter...\n');

    // Read the raw introduction chapter text
    const rawTextPath = path.join(__dirname, 'output', 'introduction-chapter-raw.txt');

    if (!fs.existsSync(rawTextPath)) {
        console.error('❌ Raw introduction text file not found. Please run extract-intro-raw.js first.');
        return;
    }

    const rawText = fs.readFileSync(rawTextPath, 'utf8');

    // Skip the header comments and find the actual content
    const lines = rawText.split('\n');
    const contentStartIndex = lines.findIndex(line => line.includes('========================================'));
    const chapterText = lines.slice(contentStartIndex + 2).join('\n'); // Skip header and separator

    console.log(`📊 Raw chapter text info:`);
    console.log(`   Total length: ${chapterText.length} characters`);
    console.log(`   Total lines: ${chapterText.split('\n').length}`);

    console.log(`\n📝 First 500 characters:`);
    console.log(`"${chapterText.slice(0, 500)}..."\n`);

    // Test the literal newline splitting
    const paragraphs = splitByNewlines(chapterText);

    console.log(`\n📋 Results:`);
    console.log(`   Total paragraphs detected: ${paragraphs.length}`);

    // Show first few paragraphs
    console.log(`\n📖 First 5 paragraphs:`);
    paragraphs.slice(0, 5).forEach((paragraph, index) => {
        const wordCount = paragraph.split(/\s+/).length;
        console.log(`\nParagraph ${index + 1} (${wordCount} words):`);
        console.log(`"${paragraph.slice(0, 200)}${paragraph.length > 200 ? '...' : ''}"`);
    });

    // Word count analysis
    const wordCounts = paragraphs.map(p => p.split(/\s+/).length);
    const avgWords = Math.round(wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length);

    console.log(`\n📊 Word Count Analysis:`);
    console.log(`   Average words per paragraph: ${avgWords}`);
    console.log(`   Shortest paragraph: ${Math.min(...wordCounts)} words`);
    console.log(`   Longest paragraph: ${Math.max(...wordCounts)} words`);

    // Check compliance
    const validParagraphs = paragraphs.filter(p => {
        const words = p.split(/\s+/).length;
        const startsWithCapital = /^[A-Z]/.test(p.trim());
        const endsWithPunctuation = /[.!?]$/.test(p.trim());
        return words >= 50 && words <= 500 && startsWithCapital && endsWithPunctuation;
    });

    console.log(`\n✅ Compliance Analysis:`);
    console.log(`   Valid paragraphs: ${validParagraphs.length}/${paragraphs.length} (${Math.round(validParagraphs.length / paragraphs.length * 100)}%)`);

    // Save results for comparison
    const resultsPath = path.join(__dirname, 'output', 'manual-paragraph-test.txt');
    let output = `# Manual Paragraph Detection Test - Introduction Chapter\n`;
    output += `# Generated: ${new Date().toISOString()}\n`;
    output += `# Total Paragraphs: ${paragraphs.length}\n`;
    output += `# Valid Paragraphs: ${validParagraphs.length}\n\n`;

    paragraphs.forEach((paragraph, index) => {
        const wordCount = paragraph.split(/\s+/).length;
        const startsWithCapital = /^[A-Z]/.test(paragraph.trim());
        const endsWithPunctuation = /[.!?]$/.test(paragraph.trim());

        output += `Paragraph ${index + 1} (${wordCount} words)\n`;
        output += `Compliance: ${startsWithCapital ? '✅' : '❌'} Capital | ${endsWithPunctuation ? '✅' : '❌'} Punctuation\n`;
        output += `"${paragraph}"\n\n`;
        output += `---\n`;
    });

    fs.writeFileSync(resultsPath, output, 'utf8');
    console.log(`\n💾 Manual test results saved to: ${resultsPath}`);
}

// Run the test
testIntroductionParagraphDetection().catch(console.error); 