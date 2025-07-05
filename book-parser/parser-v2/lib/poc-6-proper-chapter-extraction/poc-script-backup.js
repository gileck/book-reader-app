const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { extractTOCFromPdf } = require('../../../parser/steps/toc-extractor');

// Configuration
const CONFIG = {
    INPUT_PDF: path.join(__dirname, '../../../../files/Transformers/book.pdf'),
    OUTPUT_DIR: path.join(__dirname, 'output')
};

// Ensure output directory exists
function ensureDirectories() {
    if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
        fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    }
}

/**
 * Extract text from PDF page by page
 * This preserves page boundaries which is crucial for accurate chapter mapping
 */
async function extractTextByPages(pdfPath) {
    console.log('📖 Extracting text page by page...');

    const pdfBuffer = fs.readFileSync(pdfPath);

    // Extract each page individually using pdfjs
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const doc = await pdfjsLib.getDocument(pdfBuffer).promise;

    const pagePromises = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        pagePromises.push(
            doc.getPage(pageNum).then(async (page) => {
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                return {
                    pageNumber: pageNum,
                    text: pageText,
                    charCount: pageText.length
                };
            })
        );
    }

    const pageResults = await Promise.all(pagePromises);

    // Sort by page number to ensure correct order
    pageResults.sort((a, b) => a.pageNumber - b.pageNumber);

    console.log(`✅ Extracted ${pageResults.length} pages`);
    console.log(`📊 Page statistics:`);
    console.log(`   - Total pages: ${pageResults.length}`);
    console.log(`   - Average chars per page: ${Math.round(pageResults.reduce((sum, p) => sum + p.charCount, 0) / pageResults.length)}`);
    console.log(`   - Min chars per page: ${Math.min(...pageResults.map(p => p.charCount))}`);
    console.log(`   - Max chars per page: ${Math.max(...pageResults.map(p => p.charCount))}`);

    return {
        pages: pageResults,
        totalPages: pageResults.length,
        totalChars: pageResults.reduce((sum, p) => sum + p.charCount, 0)
    };
}

/**
 * Map TOC chapters to actual page content
 * This is the core algorithm that uses exact page numbers from TOC
 */
function mapChaptersToContent(pageData, tocChapters) {
    console.log('\n🔍 Mapping TOC chapters to page content...');

    const chapters = [];

    for (let i = 0; i < tocChapters.length; i++) {
        const tocChapter = tocChapters[i];
        const nextChapter = tocChapters[i + 1];

        // Use exact page numbers from TOC
        const startPage = tocChapter.startingPage;
        const endPage = nextChapter ? nextChapter.startingPage - 1 : pageData.totalPages;

        if (!startPage) {
            console.warn(`⚠️  Skipping chapter "${tocChapter.chapterTitle}" - no page number`);
            continue;
        }

        // Get all pages for this chapter
        const chapterPages = pageData.pages.filter(page =>
            page.pageNumber >= startPage && page.pageNumber <= endPage
        );

        if (chapterPages.length === 0) {
            console.warn(`⚠️  No pages found for chapter "${tocChapter.chapterTitle}" (pages ${startPage}-${endPage})`);
            continue;
        }

        // Combine all chapter pages into full text
        const fullChapterText = chapterPages.map(page => page.text).join(' ');

        // Clean up the text
        const cleanedText = cleanChapterText(fullChapterText);

        // Create chapter object
        const chapter = {
            number: tocChapter.chapterNumber,
            title: tocChapter.chapterTitle,
            startPage: startPage,
            endPage: endPage,
            pageCount: chapterPages.length,
            textLength: cleanedText.length,
            textStart: cleanedText.substring(0, 400).trim(),
            textEnd: cleanedText.substring(Math.max(0, cleanedText.length - 400)).trim(),
            fullText: cleanedText,
            originalTitle: tocChapter.originalTitle || tocChapter.chapterTitle
        };

        chapters.push(chapter);

        console.log(`✅ Mapped: "${chapter.title}"`);
        console.log(`   Pages: ${chapter.startPage}-${chapter.endPage} (${chapter.pageCount} pages)`);
        console.log(`   Length: ${chapter.textLength.toLocaleString()} chars`);
        console.log(`   Start: "${chapter.textStart.substring(0, 100)}..."`);
    }

    return chapters;
}

/**
 * Clean up extracted chapter text
 * Remove page numbers, fix spacing, etc.
 */
function cleanChapterText(text) {
    let cleaned = text;

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove page numbers (standalone numbers)
    cleaned = cleaned.replace(/\b\d+\b(?=\s|$)/g, '');

    // Remove extra spaces created by page number removal
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Trim
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Validate chapter extraction results
 */
function validateChapterExtraction(chapters) {
    console.log('\n✅ Validating chapter extraction...');

    const validationResults = {
        totalChapters: chapters.length,
        validChapters: 0,
        issues: []
    };

    chapters.forEach((chapter, index) => {
        let isValid = true;

        // Check minimum length
        if (chapter.textLength < 1000) {
            validationResults.issues.push(`Chapter "${chapter.title}" too short (${chapter.textLength} chars)`);
            isValid = false;
        }

        // Check for meaningful content
        if (!chapter.textStart || chapter.textStart.length < 50) {
            validationResults.issues.push(`Chapter "${chapter.title}" has no meaningful start text`);
            isValid = false;
        }

        // Check page range
        if (chapter.pageCount < 1) {
            validationResults.issues.push(`Chapter "${chapter.title}" has invalid page range`);
            isValid = false;
        }

        if (isValid) {
            validationResults.validChapters++;
        }
    });

    console.log(`📊 Validation Results:`);
    console.log(`   Total chapters: ${validationResults.totalChapters}`);
    console.log(`   Valid chapters: ${validationResults.validChapters}`);
    console.log(`   Success rate: ${Math.round(validationResults.validChapters / validationResults.totalChapters * 100)}%`);

    if (validationResults.issues.length > 0) {
        console.log(`⚠️  Issues found:`);
        validationResults.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    return validationResults;
}

/**
 * Test specific chapters against expected content
 */
function testSpecificChapters(chapters) {
    console.log('\n🧪 Testing specific chapters...');

    const tests = [
        {
            name: 'Introduction Start Text',
            test: () => {
                const intro = chapters.find(ch => ch.title.toLowerCase().includes('introduction'));
                if (!intro) return { pass: false, reason: 'Introduction chapter not found' };

                const expectedStart = 'From space it looks grey and crystalline';
                const hasExpectedStart = intro.textStart.includes(expectedStart.replace(/\s+/g, ' '));

                return {
                    pass: hasExpectedStart,
                    reason: hasExpectedStart ? 'Found expected start text' : `Expected "${expectedStart}" but got "${intro.textStart.substring(0, 100)}..."`
                };
            }
        },
        {
            name: 'Path of Carbon Start Text',
            test: () => {
                const pathChapter = chapters.find(ch => ch.title.toLowerCase().includes('path') && ch.title.toLowerCase().includes('carbon'));
                if (!pathChapter) return { pass: false, reason: 'Path of carbon chapter not found' };

                const expectedStart = 'Picture a tree in new leaf';
                const hasExpectedStart = pathChapter.textStart.includes(expectedStart);

                return {
                    pass: hasExpectedStart,
                    reason: hasExpectedStart ? 'Found expected start text' : `Expected "${expectedStart}" but got "${pathChapter.textStart.substring(0, 100)}..."`
                };
            }
        },
        {
            name: 'Discovering Nanocosm Start Text',
            test: () => {
                const nanoChapter = chapters.find(ch => ch.title.toLowerCase().includes('discovering') && ch.title.toLowerCase().includes('nanocosm'));
                if (!nanoChapter) return { pass: false, reason: 'Discovering nanocosm chapter not found' };

                const expectedStart = 'Burlington House, Piccadilly';
                const hasExpectedStart = nanoChapter.textStart.includes(expectedStart);

                return {
                    pass: hasExpectedStart,
                    reason: hasExpectedStart ? 'Found expected start text' : `Expected "${expectedStart}" but got "${nanoChapter.textStart.substring(0, 100)}..."`
                };
            }
        }
    ];

    const testResults = [];
    tests.forEach(test => {
        const result = test.test();
        testResults.push({
            name: test.name,
            pass: result.pass,
            reason: result.reason
        });

        console.log(`${result.pass ? '✅' : '❌'} ${test.name}: ${result.reason}`);
    });

    const passedTests = testResults.filter(t => t.pass).length;
    console.log(`\n📊 Test Summary: ${passedTests}/${tests.length} tests passed`);

    return testResults;
}

/**
 * Detect paragraph boundaries within chapters
 * Following Step 3 from STEP_BY_STEP_PLAN.md
 */
function detectParagraphsInChapters(chapters, pageData) {
    console.log('\n🔍 Detecting paragraphs within chapters...');

    let totalParagraphs = 0;
    const allParagraphs = [];

    chapters.forEach((chapter, chapterIndex) => {
        console.log(`\n📝 Processing chapter: "${chapter.title}"`);

        // Get the raw text with preserved newlines for this chapter's pages
        const chapterPages = pageData.pages.filter(page =>
            page.pageNumber >= chapter.startPage && page.pageNumber <= chapter.endPage
        );

        // Join pages with newlines to preserve paragraph structure
        const rawChapterText = chapterPages.map(page => page.text).join('\n');

        // Detect paragraph boundaries using literal \n analysis
        const paragraphs = detectParagraphBoundaries(rawChapterText, chapter, pageData);

        // Assign chapter reference to each paragraph
        paragraphs.forEach(paragraph => {
            paragraph.chapterNumber = chapter.number;
            paragraph.chapterTitle = chapter.title;
            allParagraphs.push(paragraph);
        });

        totalParagraphs += paragraphs.length;
        console.log(`   ✅ Found ${paragraphs.length} paragraphs (${Math.round(paragraphs.reduce((sum, p) => sum + p.wordCount, 0) / paragraphs.length)} avg words)`);
    });

    console.log(`\n📊 Paragraph Detection Summary:`);
    console.log(`   Total paragraphs: ${totalParagraphs}`);
    console.log(`   Average per chapter: ${Math.round(totalParagraphs / chapters.length)}`);
    console.log(`   Total words: ${allParagraphs.reduce((sum, p) => sum + p.wordCount, 0).toLocaleString()}`);

    return allParagraphs;
}

/**
 * Detect paragraph boundaries using literal newline analysis
 */
function detectParagraphBoundaries(rawText, chapter, pageData) {
    const paragraphs = [];

    // Split by double newlines first (most common paragraph separator)
    let textBlocks = rawText.split(/\n\s*\n/);

    // If that doesn't give us enough paragraphs, try single newlines
    if (textBlocks.length < 3) {
        textBlocks = rawText.split(/\n/);
    }

    textBlocks.forEach((block, index) => {
        const cleanedText = cleanParagraphText(block);

        if (cleanedText.length < 50) return; // Skip very short blocks

        const wordCount = cleanedText.split(/\s+/).length;

        // Estimate page number for this paragraph
        const estimatedPage = estimateParagraphPage(index, textBlocks.length, chapter, pageData);

        const paragraph = {
            id: `${chapter.number}_${index + 1}`,
            text: cleanedText,
            wordCount: wordCount,
            charCount: cleanedText.length,
            pageNumber: estimatedPage,
            position: index + 1,
            isFirst: index === 0,
            isLast: index === textBlocks.length - 1
        };

        paragraphs.push(paragraph);
    });

    return paragraphs;
}

/**
 * Clean paragraph text
 */
function cleanParagraphText(text) {
    let cleaned = text;

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove page numbers (standalone numbers)
    cleaned = cleaned.replace(/\b\d+\b(?=\s|$)/g, '');

    // Remove chapter titles that might appear in text
    cleaned = cleaned.replace(/^(CHAPTER|Chapter)\s+\w+\s*/i, '');

    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned.trim();
}

/**
 * Estimate page number for a paragraph within a chapter
 */
function estimateParagraphPage(paragraphIndex, totalParagraphs, chapter, pageData) {
    const pageRange = chapter.endPage - chapter.startPage + 1;
    const paragraphRatio = paragraphIndex / totalParagraphs;
    const estimatedPageOffset = Math.floor(paragraphRatio * pageRange);

    return Math.min(chapter.startPage + estimatedPageOffset, chapter.endPage);
}

/**
 * Validate paragraph detection results
 */
function validateParagraphDetection(paragraphs) {
    console.log('\n✅ Validating paragraph detection...');

    const validation = {
        totalParagraphs: paragraphs.length,
        validParagraphs: 0,
        averageWordCount: 0,
        wordCountDistribution: {
            veryShort: 0, // < 50 words
            short: 0,     // 50-100 words
            medium: 0,    // 100-200 words
            long: 0,      // 200-300 words
            veryLong: 0   // > 300 words
        },
        issues: []
    };

    let totalWords = 0;

    paragraphs.forEach(paragraph => {
        let isValid = true;
        totalWords += paragraph.wordCount;

        // Check minimum length
        if (paragraph.wordCount < 10) {
            validation.issues.push(`Paragraph ${paragraph.id} too short (${paragraph.wordCount} words)`);
            isValid = false;
        }

        // Check for meaningful content
        if (!paragraph.text || paragraph.text.length < 20) {
            validation.issues.push(`Paragraph ${paragraph.id} has no meaningful content`);
            isValid = false;
        }

        // Word count distribution
        if (paragraph.wordCount < 50) validation.wordCountDistribution.veryShort++;
        else if (paragraph.wordCount < 100) validation.wordCountDistribution.short++;
        else if (paragraph.wordCount < 200) validation.wordCountDistribution.medium++;
        else if (paragraph.wordCount < 300) validation.wordCountDistribution.long++;
        else validation.wordCountDistribution.veryLong++;

        if (isValid) validation.validParagraphs++;
    });

    validation.averageWordCount = Math.round(totalWords / paragraphs.length);

    console.log(`📊 Paragraph Validation Results:`);
    console.log(`   Total paragraphs: ${validation.totalParagraphs}`);
    console.log(`   Valid paragraphs: ${validation.validParagraphs}`);
    console.log(`   Success rate: ${Math.round(validation.validParagraphs / validation.totalParagraphs * 100)}%`);
    console.log(`   Average word count: ${validation.averageWordCount}`);
    console.log(`   Word count distribution:`);
    console.log(`     Very short (<50): ${validation.wordCountDistribution.veryShort}`);
    console.log(`     Short (50-100): ${validation.wordCountDistribution.short}`);
    console.log(`     Medium (100-200): ${validation.wordCountDistribution.medium}`);
    console.log(`     Long (200-300): ${validation.wordCountDistribution.long}`);
    console.log(`     Very long (>300): ${validation.wordCountDistribution.veryLong}`);

    if (validation.issues.length > 0) {
        console.log(`⚠️  Issues found (showing first 5):`);
        validation.issues.slice(0, 5).forEach(issue => console.log(`   - ${issue}`));
        if (validation.issues.length > 5) {
            console.log(`   - ... and ${validation.issues.length - 5} more issues`);
        }
    }

    return validation;
}

/**
 * Main execution function
 */
async function main() {
    console.log('🚀 POC 6: Integrated Pipeline - Chapter & Paragraph Detection');
    console.log('==============================================================\n');

    try {
        ensureDirectories();

        // Step 1: Extract TOC from PDF
        console.log('=== STEP 1: Extract TOC ===');
        const tocResult = await extractTOCFromPdf(CONFIG.INPUT_PDF);

        if (!tocResult) {
            throw new Error('Could not extract TOC from PDF');
        }

        console.log(`✅ TOC extracted from: ${tocResult.source}`);
        console.log(`📋 Found ${tocResult.chapters.length} chapters`);

        // Filter main content chapters
        const mainChapters = tocResult.chapters.filter(chapter => {
            const title = chapter.chapterTitle.toLowerCase();
            const excludeTerms = ['praise', 'title page', 'copyright', 'dedication', 'contents', 'list of', 'acknowledgements', 'index'];
            return !excludeTerms.some(term => title.includes(term)) && chapter.startingPage;
        });

        console.log(`📚 Processing ${mainChapters.length} main content chapters`);

        // Step 2: Extract text page by page
        console.log('\n=== STEP 2: Extract Text By Pages ===');
        const pageData = await extractTextByPages(CONFIG.INPUT_PDF);

        // Step 3: Map chapters to content using exact page numbers  
        console.log('\n=== STEP 3: Map Chapters to Content ===');
        const chapters = mapChaptersToContent(pageData, mainChapters);

        // Step 4: Detect paragraphs within chapters
        console.log('\n=== STEP 4: Paragraph Detection ===');
        const paragraphs = detectParagraphsInChapters(chapters, pageData);

        // Step 5: Validate chapter extraction
        console.log('\n=== STEP 5: Validate Chapter Extraction ===');
        const chapterValidation = validateChapterExtraction(chapters);

        // Step 6: Validate paragraph detection
        console.log('\n=== STEP 6: Validate Paragraph Detection ===');
        const paragraphValidation = validateParagraphDetection(paragraphs);

        // Step 7: Test specific chapters
        console.log('\n=== STEP 7: Test Specific Chapters ===');
        const testResults = testSpecificChapters(chapters);

        // Step 8: Save results
        console.log('\n=== STEP 8: Save Results ===');
        const output = {
            timestamp: new Date().toISOString(),
            tocSource: tocResult.source,
            totalChapters: chapters.length,
            totalParagraphs: paragraphs.length,
            chapterValidation: chapterValidation,
            paragraphValidation: paragraphValidation,
            testResults: testResults,
            chapters: chapters.map(ch => ({
                number: ch.number,
                title: ch.title,
                startPage: ch.startPage,
                endPage: ch.endPage,
                pageCount: ch.pageCount,
                textLength: ch.textLength,
                textStart: ch.textStart,
                textEnd: ch.textEnd,
                paragraphCount: paragraphs.filter(p => p.chapterNumber === ch.number).length
            })),
            paragraphs: paragraphs.map(p => ({
                id: p.id,
                chapterNumber: p.chapterNumber,
                chapterTitle: p.chapterTitle,
                text: p.text.substring(0, 200) + (p.text.length > 200 ? '...' : ''), // Truncate for output
                wordCount: p.wordCount,
                charCount: p.charCount,
                pageNumber: p.pageNumber,
                position: p.position
            }))
        };

        const outputPath = path.join(CONFIG.OUTPUT_DIR, 'integrated-pipeline-results.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`💾 Results saved to: ${outputPath}`);

        // Create summary report
        const summaryPath = path.join(CONFIG.OUTPUT_DIR, 'pipeline-summary.txt');
        const summaryText = `
POC 6: Integrated Pipeline Results (Steps 1-4)
==============================================

Execution Time: ${new Date().toISOString()}
TOC Source: ${tocResult.source}

STEP COMPLETION STATUS:
======================
✅ Step 1: TOC Extraction - COMPLETED
✅ Step 2: Page-by-Page Text Extraction - COMPLETED  
✅ Step 3: Chapter Detection - COMPLETED
✅ Step 4: Paragraph Detection - COMPLETED

CHAPTER DETECTION RESULTS:
==========================
- Total chapters: ${chapters.length}
- Valid chapters: ${chapterValidation.validChapters}/${chapterValidation.totalChapters}
- Chapter success rate: ${Math.round(chapterValidation.validChapters / chapterValidation.totalChapters * 100)}%

PARAGRAPH DETECTION RESULTS:
============================
- Total paragraphs: ${paragraphs.length}
- Valid paragraphs: ${paragraphValidation.validParagraphs}/${paragraphValidation.totalParagraphs}
- Paragraph success rate: ${Math.round(paragraphValidation.validParagraphs / paragraphValidation.totalParagraphs * 100)}%
- Average word count: ${paragraphValidation.averageWordCount}
- Average paragraphs per chapter: ${Math.round(paragraphs.length / chapters.length)}

VALIDATION TESTS:
================
${testResults.map(t => `- ${t.name}: ${t.pass ? 'PASS' : 'FAIL'} - ${t.reason}`).join('\n')}

CHAPTER SUMMARY:
===============
${chapters.map(ch => `- "${ch.title}" (Pages ${ch.startPage}-${ch.endPage}, ${ch.textLength.toLocaleString()} chars, ${paragraphs.filter(p => p.chapterNumber === ch.number).length} paragraphs)`).join('\n')}

PARAGRAPH WORD COUNT DISTRIBUTION:
==================================
- Very short (<50 words): ${paragraphValidation.wordCountDistribution.veryShort}
- Short (50-100 words): ${paragraphValidation.wordCountDistribution.short}
- Medium (100-200 words): ${paragraphValidation.wordCountDistribution.medium}
- Long (200-300 words): ${paragraphValidation.wordCountDistribution.long}
- Very long (>300 words): ${paragraphValidation.wordCountDistribution.veryLong}

${chapterValidation.issues.length > 0 ? `\nCHAPTER ISSUES:\n${chapterValidation.issues.map(issue => `- ${issue}`).join('\n')}` : '\nNo chapter issues found!'}

${paragraphValidation.issues.length > 5 ? `\nPARAGRAPH ISSUES (showing first 5):\n${paragraphValidation.issues.slice(0, 5).map(issue => `- ${issue}`).join('\n')}\n... and ${paragraphValidation.issues.length - 5} more issues` : paragraphValidation.issues.length > 0 ? `\nPARAGRAPH ISSUES:\n${paragraphValidation.issues.map(issue => `- ${issue}`).join('\n')}` : '\nNo paragraph issues found!'}

NEXT STEPS:
===========
✅ Step 1-4 completed successfully
📋 Ready for Step 5: Header Detection
📋 Ready for Step 6: Chunking Algorithm  
📋 Ready for Step 7: Cross-Page Merging
📋 Ready for Step 8: Final Output Generation

STATUS: ${Math.round(4 / 8 * 100)}% COMPLETE (4/8 steps)
`;

        fs.writeFileSync(summaryPath, summaryText);
        console.log(`📄 Summary saved to: ${summaryPath}`);

        console.log('\n🎉 Integrated Pipeline (Steps 1-4) completed successfully!');
        console.log(`📊 Final Statistics:`);
        console.log(`   - Chapters: ${chapters.length} (${Math.round(chapterValidation.validChapters / chapterValidation.totalChapters * 100)}% valid)`);
        console.log(`   - Paragraphs: ${paragraphs.length} (${Math.round(paragraphValidation.validParagraphs / paragraphValidation.totalParagraphs * 100)}% valid)`);
        console.log(`   - Average words per paragraph: ${paragraphValidation.averageWordCount}`);
        console.log(`   - Pipeline progress: 50% complete (4/8 steps)`);
        console.log(`\n🚀 Ready to proceed with Step 5: Header Detection!`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    extractTextByPages,
    mapChaptersToContent,
    cleanChapterText,
    validateChapterExtraction,
    testSpecificChapters,
    detectParagraphsInChapters,
    detectParagraphBoundaries,
    cleanParagraphText,
    estimateParagraphPage,
    validateParagraphDetection
}; 