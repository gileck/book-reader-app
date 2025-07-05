const fs = require('fs');
const path = require('path');

// Load the results file
const resultsPath = path.join(__dirname, 'output', 'integrated-pipeline-results.json');
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Re-run the chapter extraction to get fullText (since results only have truncated text)
const { mapChaptersToContent, extractTextByPages } = require('./poc-script.js');
const { extractTOCFromPdf } = require('../../../parser/steps/toc-extractor');

async function extractIntroductionRawText() {
    console.log('🔍 Extracting raw Introduction chapter text...');

    const CONFIG = {
        INPUT_PDF: path.join(__dirname, '../../../../files/Transformers/book.pdf'),
    };

    // Extract TOC
    const tocResult = await extractTOCFromPdf(CONFIG.INPUT_PDF);
    const mainChapters = tocResult.chapters.filter(chapter => {
        const title = chapter.chapterTitle.toLowerCase();
        const excludeTerms = ['praise', 'title page', 'copyright', 'dedication', 'contents', 'list of', 'acknowledgements', 'index'];
        return !excludeTerms.some(term => title.includes(term)) && chapter.startingPage;
    });

    // Extract text by pages
    const pageData = await extractTextByPages(CONFIG.INPUT_PDF);

    // Map chapters to content
    const chapters = mapChaptersToContent(pageData, mainChapters);

    // Find Introduction chapter
    const introChapter = chapters.find(ch =>
        ch.title.toLowerCase().includes('introduction') &&
        ch.title.toLowerCase().includes('life')
    );

    if (!introChapter) {
        console.error('❌ Introduction chapter not found');
        return;
    }

    // Write raw text to file
    const outputPath = path.join(__dirname, 'output', 'introduction-chapter-raw.txt');

    const header = `# Introduction Chapter - Raw Content (After Chapter Extraction, Before Paragraph Detection)
# Generated: ${new Date().toISOString()}
# Chapter: ${introChapter.title}
# Pages: ${introChapter.startPage}-${introChapter.endPage}
# Length: ${introChapter.textLength.toLocaleString()} characters
# 
# This is the raw chapter text with preserved newlines for paragraph detection.
# Newlines in this text mark the paragraph boundaries as intended.
#
========================================

`;

    fs.writeFileSync(outputPath, header + introChapter.fullText);

    console.log(`✅ Introduction chapter raw text saved to: ${outputPath}`);
    console.log(`📊 Chapter details:`);
    console.log(`   Title: "${introChapter.title}"`);
    console.log(`   Pages: ${introChapter.startPage}-${introChapter.endPage} (${introChapter.pageCount} pages)`);
    console.log(`   Length: ${introChapter.textLength.toLocaleString()} characters`);
    console.log(`   First 200 chars: "${introChapter.fullText.substring(0, 200)}..."`);
}

// Run if called directly
if (require.main === module) {
    extractIntroductionRawText().catch(console.error);
} 