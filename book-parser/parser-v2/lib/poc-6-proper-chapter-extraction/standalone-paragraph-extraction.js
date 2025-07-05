const fs = require('fs');
const path = require('path');

/**
 * Fixed logical paragraph detection for Introduction chapter
 */
function detectLogicalParagraphs(rawText) {
    console.log(`📝 Detecting logical paragraph boundaries...`);

    // Normalize newlines 
    const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into lines first
    const lines = normalizedText.split('\n');
    console.log(`📊 Found ${lines.length} total lines`);

    // Group lines into logical paragraphs
    const logicalParagraphs = [];
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip completely empty lines - they indicate paragraph breaks
        if (line.length === 0) {
            if (currentParagraph.length > 0) {
                const paragraphText = currentParagraph.join(' ').trim();
                if (paragraphText.length > 20) {
                    logicalParagraphs.push(paragraphText);
                }
                currentParagraph = [];
            }
            continue;
        }

        // Skip page numbers and very short fragments
        if (/^\d+$/.test(line) || line.length < 10) {
            continue;
        }

        const prevLine = currentParagraph.length > 0 ? currentParagraph[currentParagraph.length - 1] : '';

        // Check for logical paragraph boundary indicators
        const isNewParagraph = (
            // Line starts with capital and previous line ended with sentence punctuation
            (/^[A-Z]/.test(line) && /[.!?]$/.test(prevLine.trim())) ||
            // Line looks like a heading (short, mostly capitals, or title case)
            (line.length < 50 && (/^[A-Z\s]+$/.test(line) || /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(line))) ||
            // Line starts with special markers
            /^(Chapter|CHAPTER|Figure|Fig\.|Table|[IVX]+\.|\d+\.)/.test(line)
        );

        if (isNewParagraph && currentParagraph.length > 0) {
            // End current paragraph and start new one
            const paragraphText = currentParagraph.join(' ').trim();
            if (paragraphText.length > 20) {
                logicalParagraphs.push(paragraphText);
            }
            currentParagraph = [line];
        } else {
            // Continue current paragraph
            currentParagraph.push(line);
        }
    }

    // Don't forget the last paragraph
    if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ').trim();
        if (paragraphText.length > 20) {
            logicalParagraphs.push(paragraphText);
        }
    }

    console.log(`✅ Found ${logicalParagraphs.length} logical paragraphs`);
    return logicalParagraphs;
}

/**
 * Simple word count function
 */
function countWords(text) {
    return text.trim().split(/\s+/).length;
}

/**
 * Create paragraph objects with proper structure
 */
function createParagraphObjects(paragraphs, chapterInfo) {
    return paragraphs.map((text, index) => {
        const wordCount = countWords(text);
        const startsWithCapital = /^[A-Z]/.test(text.trim());
        const endsWithPunctuation = /[.!?]$/.test(text.trim());

        return {
            id: `0_${index + 1}`,
            chapterNumber: 0,
            chapterTitle: chapterInfo.title,
            text: text,
            wordCount: wordCount,
            charCount: text.length,
            pageNumber: chapterInfo.startPage + Math.floor(index / 10), // Rough page estimate
            position: index + 1,
            startsWithCapital: startsWithCapital,
            endsWithPunctuation: endsWithPunctuation
        };
    });
}

async function extractIntroductionParagraphsStandalone() {
    console.log('🔧 Extracting Introduction paragraphs with FIXED logical paragraph detection...\n');

    try {
        // Read the raw introduction chapter text that we already extracted
        const rawTextPath = path.join(__dirname, 'output', 'introduction-chapter-raw.txt');

        if (!fs.existsSync(rawTextPath)) {
            console.error('❌ Raw introduction text file not found. Please run extract-intro-raw.js first.');
            return;
        }

        const rawFileContent = fs.readFileSync(rawTextPath, 'utf8');

        // Skip the header comments and find the actual content
        const lines = rawFileContent.split('\n');
        const contentStartIndex = lines.findIndex(line => line.includes('========================================'));
        const chapterText = lines.slice(contentStartIndex + 2).join('\n'); // Skip header and separator

        console.log(`📊 Chapter text: ${chapterText.length} characters, ${chapterText.split('\n').length} lines`);

        // Apply fixed logical paragraph detection
        const logicalParagraphs = detectLogicalParagraphs(chapterText);

        // Create paragraph objects
        const chapterInfo = {
            number: 0,
            title: "Introduction: Life itself",
            startPage: 9,
            endPage: 27
        };

        const paragraphObjects = createParagraphObjects(logicalParagraphs, chapterInfo);

        // Analysis and compliance check
        const validParagraphs = paragraphObjects.filter(p =>
            p.startsWithCapital && p.endsWithPunctuation && p.wordCount >= 50 && p.wordCount <= 500
        );

        const targetRangeParagraphs = paragraphObjects.filter(p =>
            p.wordCount >= 80 && p.wordCount <= 300
        );

        console.log(`\n📊 RESULTS:`);
        console.log(`   Total paragraphs: ${paragraphObjects.length}`);
        console.log(`   Valid paragraphs: ${validParagraphs.length} (${Math.round(validParagraphs.length / paragraphObjects.length * 100)}%)`);
        console.log(`   In target range (80-300): ${targetRangeParagraphs.length} (${Math.round(targetRangeParagraphs.length / paragraphObjects.length * 100)}%)`);
        console.log(`   Average word count: ${Math.round(paragraphObjects.reduce((sum, p) => sum + p.wordCount, 0) / paragraphObjects.length)}`);

        // Save results
        const outputPath = path.join(__dirname, 'output', 'introduction-paragraphs-fixed.txt');
        let output = `# Introduction Chapter - FIXED Logical Paragraph Detection\n`;
        output += `# Generated: ${new Date().toISOString()}\n`;
        output += `# Chapter: ${chapterInfo.title}\n`;
        output += `# Pages: ${chapterInfo.startPage}-${chapterInfo.endPage}\n`;
        output += `# Total Paragraphs: ${paragraphObjects.length}\n`;
        output += `# Valid Paragraphs: ${validParagraphs.length}\n`;
        output += `# Algorithm: Logical paragraph boundaries (not line-by-line)\n`;
        output += `# Using literal newline-based paragraph detection with logical grouping\n\n`;

        paragraphObjects.forEach((paragraph, index) => {
            const compliance = [];
            if (paragraph.startsWithCapital) compliance.push('✅ Capital');
            else compliance.push('❌ Capital');

            if (paragraph.endsWithPunctuation) compliance.push('✅ Punctuation');
            else compliance.push('❌ Punctuation');

            if (paragraph.wordCount >= 50 && paragraph.wordCount <= 500) compliance.push('✅ Word Count');
            else compliance.push('❌ Word Count');

            if (paragraph.wordCount >= 80 && paragraph.wordCount <= 300) compliance.push('🎯 Target Range');
            else compliance.push('📊 Outside Target');

            output += `Paragraph ${index + 1} (ID: ${paragraph.id})\n`;
            output += `Page: ${paragraph.pageNumber} | Words: ${paragraph.wordCount} | Chars: ${paragraph.text.length}\n`;
            output += `Compliance: ${compliance.join(' | ')}\n`;
            output += `Text: "${paragraph.text}"\n\n`;
            output += `========\n`;
        });

        output += `\n📊 SUMMARY:\n`;
        output += `Total paragraphs: ${paragraphObjects.length}\n`;
        output += `Valid paragraphs: ${validParagraphs.length} (${Math.round(validParagraphs.length / paragraphObjects.length * 100)}%)\n`;
        output += `In target range (80-300 words): ${targetRangeParagraphs.length} (${Math.round(targetRangeParagraphs.length / paragraphObjects.length * 100)}%)\n`;
        output += `Average word count: ${Math.round(paragraphObjects.reduce((sum, p) => sum + p.wordCount, 0) / paragraphObjects.length)}\n`;

        fs.writeFileSync(outputPath, output, 'utf8');
        console.log(`💾 Results saved to: ${outputPath}`);

        return paragraphObjects;

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    extractIntroductionParagraphsStandalone().catch(console.error);
}

module.exports = { extractIntroductionParagraphsStandalone }; 