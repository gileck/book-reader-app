const fs = require('fs');
const path = require('path');

// Load the results file from the latest POC-6 run
const resultsPath = path.join(__dirname, 'output', 'integrated-pipeline-results.json');

async function extractIntroductionParagraphs() {
    console.log('📖 Extracting all paragraphs from Introduction chapter...');

    if (!fs.existsSync(resultsPath)) {
        console.error('❌ Results file not found. Please run the main POC script first.');
        return;
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

    // Find the Introduction chapter
    const introChapter = results.chapters.find(ch =>
        ch.title && ch.title.toLowerCase().includes('introduction')
    );

    if (!introChapter) {
        console.error('❌ Introduction chapter not found in results');
        return;
    }

    console.log(`✅ Found Introduction chapter: "${introChapter.title}"`);
    console.log(`📊 Chapter info: Pages ${introChapter.startPage}-${introChapter.endPage}, ${introChapter.textLength} chars`);

    // Get paragraphs for the introduction chapter
    const introParagraphs = results.paragraphs.filter(p =>
        p.chapterNumber === introChapter.number
    );

    console.log(`📝 Found ${introParagraphs.length} paragraphs in Introduction chapter`);

    if (introParagraphs.length === 0) {
        console.error('❌ No paragraphs found for Introduction chapter');
        return;
    }

    // Create the output content
    let outputContent = `# Introduction Chapter - All Extracted Paragraphs\n`;
    outputContent += `# Generated: ${new Date().toISOString()}\n`;
    outputContent += `# Chapter: ${introChapter.title}\n`;
    outputContent += `# Pages: ${introChapter.startPage}-${introChapter.endPage}\n`;
    outputContent += `# Total Paragraphs: ${introParagraphs.length}\n`;
    outputContent += `# Using literal newline-based paragraph detection\n`;
    outputContent += `#\n`;
    outputContent += `========================================\n\n`;

    // Sort paragraphs by their ID to maintain order
    introParagraphs.sort((a, b) => {
        const aNum = parseInt(a.id.split('_')[1]);
        const bNum = parseInt(b.id.split('_')[1]);
        return aNum - bNum;
    });

    // Add each paragraph
    introParagraphs.forEach((paragraph, index) => {
        outputContent += `Paragraph ${index + 1} (ID: ${paragraph.id})\n`;
        outputContent += `Page: ${paragraph.page} | Words: ${paragraph.wordCount} | Chars: ${paragraph.text.length}\n`;

        // Compliance status
        const compliance = [];
        if (paragraph.startsWithCapital) compliance.push('✅ Capital');
        else compliance.push('❌ Capital');

        if (paragraph.endsWithPunctuation) compliance.push('✅ Punctuation');
        else compliance.push('❌ Punctuation');

        if (paragraph.wordCount >= 50 && paragraph.wordCount <= 500) compliance.push('✅ Word Count');
        else compliance.push('❌ Word Count');

        if (paragraph.wordCount >= 80 && paragraph.wordCount <= 300) compliance.push('🎯 Target Range');
        else compliance.push('📊 Outside Target');

        outputContent += `Compliance: ${compliance.join(' | ')}\n`;
        outputContent += `Text: "${paragraph.text}"\n\n`;
        outputContent += `========\n`;
    });

    // Add summary
    const validParagraphs = introParagraphs.filter(p =>
        p.startsWithCapital && p.endsWithPunctuation && p.wordCount >= 50 && p.wordCount <= 500
    );

    const targetRangeParagraphs = introParagraphs.filter(p =>
        p.wordCount >= 80 && p.wordCount <= 300
    );

    outputContent += `\n📊 SUMMARY:\n`;
    outputContent += `Total paragraphs: ${introParagraphs.length}\n`;
    outputContent += `Valid paragraphs: ${validParagraphs.length} (${Math.round(validParagraphs.length / introParagraphs.length * 100)}%)\n`;
    outputContent += `In target range (80-300 words): ${targetRangeParagraphs.length} (${Math.round(targetRangeParagraphs.length / introParagraphs.length * 100)}%)\n`;
    outputContent += `Average word count: ${Math.round(introParagraphs.reduce((sum, p) => sum + p.wordCount, 0) / introParagraphs.length)}\n`;

    // Word count distribution
    const distribution = {
        'Very short (<50)': introParagraphs.filter(p => p.wordCount < 50).length,
        'Short (50-79)': introParagraphs.filter(p => p.wordCount >= 50 && p.wordCount < 80).length,
        'Medium (80-150)': introParagraphs.filter(p => p.wordCount >= 80 && p.wordCount < 150).length,
        'Long (151-300)': introParagraphs.filter(p => p.wordCount >= 151 && p.wordCount <= 300).length,
        'Very long (301-500)': introParagraphs.filter(p => p.wordCount >= 301 && p.wordCount <= 500).length,
        'Too long (>500)': introParagraphs.filter(p => p.wordCount > 500).length
    };

    outputContent += `\n📈 Word Count Distribution:\n`;
    Object.entries(distribution).forEach(([range, count]) => {
        outputContent += `   ${range}: ${count}\n`;
    });

    // Save to file
    const outputPath = path.join(__dirname, 'output', 'introduction-paragraphs-all.txt');
    fs.writeFileSync(outputPath, outputContent, 'utf8');

    console.log(`💾 All Introduction paragraphs saved to: ${outputPath}`);
    console.log(`📊 Summary: ${introParagraphs.length} paragraphs, ${validParagraphs.length} valid (${Math.round(validParagraphs.length / introParagraphs.length * 100)}%)`);

    return outputPath;
}

// Run if called directly
if (require.main === module) {
    extractIntroductionParagraphs().catch(console.error);
}

module.exports = { extractIntroductionParagraphs }; 