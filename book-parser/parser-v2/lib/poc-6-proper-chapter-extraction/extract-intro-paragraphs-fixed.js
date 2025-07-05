const fs = require('fs');
const path = require('path');

// Load the POC-6 functions (will work even with syntax error since we're not calling the broken function)
const { extractTextByPages, mapChaptersToContent, estimateParagraphPage } = require('./poc-script.js');
const { extractTOCFromPdf } = require('../../../parser/steps/toc-extractor');

/**
 * Fixed logical paragraph detection for Introduction chapter
 */
function detectLogicalParagraphs(rawText) {
    console.log(`📝 Detecting logical paragraph boundaries in Introduction...`);

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

async function extractIntroductionParagraphsFixed() {
    console.log('🔧 Extracting Introduction paragraphs with FIXED logical paragraph detection...\n');

    const CONFIG = {
        INPUT_PDF: path.join(__dirname, '../../../../files/Transformers/book.pdf'),
    };

    try {
        // Step 1: Extract TOC
        console.log('📖 Extracting TOC...');
        const tocResult = await extractTOCFromPdf(CONFIG.INPUT_PDF);
        if (!tocResult.success) {
            throw new Error('Failed to extract TOC');
        }

        // Step 2: Extract text by pages
        console.log('📄 Extracting text by pages...');
        const pageData = await extractTextByPages(CONFIG.INPUT_PDF);

        // Step 3: Find Introduction chapter
        const introChapter = tocResult.chapters.find(ch =>
            ch.chapterTitle && ch.chapterTitle.toLowerCase().includes('introduction')
        );

        if (!introChapter) {
            throw new Error('Introduction chapter not found in TOC');
        }

        console.log(`✅ Found Introduction: "${introChapter.chapterTitle}" (Pages ${introChapter.startingPage}-${tocResult.chapters[1]?.startingPage - 1 || pageData.totalPages})`);

        // Step 4: Extract chapter content with preserved newlines
        const chapterInfo = {
            number: 0,
            title: introChapter.chapterTitle,
            startPage: introChapter.startingPage,
            endPage: tocResult.chapters[1]?.startingPage - 1 || pageData.totalPages
        };

        const chapterPages = pageData.pages.filter(page =>
            page.pageNumber >= chapterInfo.startPage && page.pageNumber <= chapterInfo.endPage
        );

        const rawChapterText = chapterPages.map(page => page.text).join('\n');
        console.log(`📊 Chapter text: ${rawChapterText.length} characters, ${rawChapterText.split('\n').length} lines`);

        // Step 5: Apply fixed logical paragraph detection
        const logicalParagraphs = detectLogicalParagraphs(rawChapterText);

        // Step 6: Create paragraph objects
        const paragraphObjects = createParagraphObjects(logicalParagraphs, chapterInfo);

        // Step 7: Analysis and compliance check
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

        // Step 8: Save results
        const outputPath = path.join(__dirname, 'output', 'introduction-paragraphs-fixed.txt');
        let output = `# Introduction Chapter - FIXED Logical Paragraph Detection\n`;
        output += `# Generated: ${new Date().toISOString()}\n`;
        output += `# Total Paragraphs: ${paragraphObjects.length}\n`;
        output += `# Valid Paragraphs: ${validParagraphs.length}\n`;
        output += `# Algorithm: Logical paragraph boundaries (not line-by-line)\n\n`;

        paragraphObjects.slice(0, 10).forEach((paragraph, index) => {
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
            output += `Text: "${paragraph.text.slice(0, 400)}${paragraph.text.length > 400 ? '...' : ''}"\n\n`;
            output += `========\n`;
        });

        if (paragraphObjects.length > 10) {
            output += `\n... and ${paragraphObjects.length - 10} more paragraphs\n`;
        }

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
    extractIntroductionParagraphsFixed().catch(console.error);
}

module.exports = { extractIntroductionParagraphsFixed }; 