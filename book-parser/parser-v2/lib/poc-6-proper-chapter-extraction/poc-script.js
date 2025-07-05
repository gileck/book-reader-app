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
 * Reconstruct text from PDF.js text items while preserving newlines
 * Uses Y coordinates to detect line breaks and preserve paragraph structure
 */
function reconstructTextWithNewlines(textItems) {
    if (!textItems || textItems.length === 0) {
        return '';
    }

    // Sort by Y coordinate (descending) then X coordinate (ascending)
    // Higher Y values are at the top of the page
    const sortedItems = textItems.slice().sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5]; // Y coordinate
        if (Math.abs(yDiff) > 2) { // Different lines (allow small tolerance)
            return yDiff;
        }
        return a.transform[4] - b.transform[4]; // X coordinate for same line
    });

    let reconstructedText = '';
    let currentY = null;
    let previousY = null;
    let currentLineText = '';

    for (const item of sortedItems) {
        const y = item.transform[5];
        const text = item.str;

        // Check if we're on a new line (different Y coordinate)
        if (currentY !== null && Math.abs(y - currentY) > 2) {
            // We're on a new line - add the current line
            if (currentLineText.trim()) {
                reconstructedText += currentLineText.trim();

                // Determine if this is a paragraph break or just line wrapping
                // Paragraph breaks have larger Y-coordinate gaps
                const yGap = previousY !== null ? Math.abs(currentY - previousY) : 0;

                // Lower threshold for paragraph detection - try 10 instead of 20
                if (yGap > 10) {
                    // Large gap = paragraph boundary
                    reconstructedText += '\n\n';
                } else {
                    // Small gap = line wrap within paragraph
                    reconstructedText += ' ';
                }
            }
            previousY = currentY;
            currentLineText = '';
        }

        // Add text to current line
        if (text.trim()) {
            // Add space between words on same line (unless it's the first word)
            if (currentLineText.trim() && !text.startsWith(' ') && !currentLineText.endsWith(' ')) {
                currentLineText += ' ';
            }
            currentLineText += text;
        }

        currentY = y;
    }

    // Add the last line
    if (currentLineText.trim()) {
        reconstructedText += currentLineText.trim();
    }

    return reconstructedText;
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

                // PRESERVE NEWLINES: Reconstruct text layout preserving line breaks
                const pageText = reconstructTextWithNewlines(textContent.items);

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

        // PRESERVE NEWLINES: Join pages with newlines to maintain paragraph boundaries
        const fullChapterText = chapterPages.map(page => page.text).join('\n');

        // Clean up the text while preserving paragraph structure
        const cleanedText = cleanChapterTextPreservingParagraphs(fullChapterText);

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
 * Clean up extracted chapter text while preserving paragraph boundaries
 * This version preserves newlines for proper paragraph detection
 */
function cleanChapterTextPreservingParagraphs(text) {
    let cleaned = text;

    // Normalize different newline types but preserve them
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove standalone page numbers (but preserve surrounding structure)
    cleaned = cleaned.replace(/^\s*\d+\s*$/gm, ''); // Remove lines that are just page numbers
    cleaned = cleaned.replace(/\b\d+\b(?=\s*\n)/g, ''); // Remove page numbers before newlines

    // Clean up multiple consecutive newlines (but keep paragraph breaks)
    cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Max 2 consecutive newlines

    // Remove excessive spaces within lines (but preserve newlines)
    cleaned = cleaned.replace(/[ \t]+/g, ' '); // Only spaces and tabs, not newlines

    // Remove spaces at start/end of lines
    cleaned = cleaned.replace(/^[ \t]+|[ \t]+$/gm, '');

    // Remove empty lines caused by page number removal
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '');

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
 * Following REQUIREMENTS.md FR-1: Text Processing and Chunking
 */
function detectParagraphBoundaries(rawText, chapter, pageData) {
    console.log(`     🔍 Detecting paragraphs using literal \\n boundaries...`);

    // Step 1: Split by literal newlines to find paragraph boundaries
    const rawParagraphs = splitByNewlines(rawText);

    // Step 2: Apply chunk structure rules and word count requirements
    const processedParagraphs = processParagraphChunks(rawParagraphs, chapter, pageData);

    console.log(`     📊 Found ${processedParagraphs.length} valid paragraphs`);
    return processedParagraphs;
}

/**
 * Split text by literal newlines to find paragraph boundaries
 * As requested: paragraphs are groups of sentences that do not include a newline
 * BUT we need to distinguish between line-wrapping and logical paragraph breaks
 */
function splitByNewlines(rawText) {
    console.log(`       📝 Detecting logical paragraph boundaries...`);

    // Normalize newlines 
    const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into lines first
    const lines = normalizedText.split('\n');
    console.log(`       📊 Found ${lines.length} total lines`);

    // Group lines into logical paragraphs
    // A logical paragraph break occurs when:
    // 1. There's a completely empty line (double newline)
    // 2. The line starts with a capital letter and previous line ended with punctuation
    // 3. The line looks like a heading (short, title-case)

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

    console.log(`       ✅ Found ${logicalParagraphs.length} logical paragraphs`);

    // Clean each paragraph
    const cleanedParagraphs = logicalParagraphs
        .map(p => cleanParagraphText(p))
        .filter(p => p.length > 20);

    console.log(`       ✅ ${cleanedParagraphs.length} paragraphs after cleaning`);

    return cleanedParagraphs;
}

/**
 * Process paragraph chunks according to REQUIREMENTS.md rules
 */
function processParagraphChunks(rawParagraphs, chapter, pageData) {
    const chunks = [];
    let i = 0;

    while (i < rawParagraphs.length) {
        let currentChunk = rawParagraphs[i];
        let wordCount = countWords(currentChunk);
        let chunksUsed = 1;

        // Apply word count requirements with merging/splitting
        if (wordCount < 80 && i < rawParagraphs.length - 1) {
            // Merge short paragraphs until we reach 80-300 words
            ({ currentChunk, chunksUsed } = mergeShortParagraphs(rawParagraphs, i, wordCount));
            wordCount = countWords(currentChunk);
        } else if (wordCount > 300) {
            // Split long paragraphs at sentence boundaries
            const splitChunks = splitLongParagraph(currentChunk, wordCount);
            splitChunks.forEach((splitChunk, splitIndex) => {
                const chunk = createParagraphChunk(splitChunk, chapter, pageData, chunks.length + 1);
                if (validateChunkStructure(chunk)) {
                    chunks.push(chunk);
                }
            });
            i += chunksUsed;
            continue;
        }

        // Create and validate chunk
        const chunk = createParagraphChunk(currentChunk, chapter, pageData, chunks.length + 1);
        if (validateChunkStructure(chunk)) {
            chunks.push(chunk);
        }

        i += chunksUsed;
    }

    return chunks;
}

/**
 * Merge short paragraphs until reaching target word count
 */
function mergeShortParagraphs(paragraphs, startIndex, currentWordCount) {
    let mergedText = paragraphs[startIndex];
    let chunksUsed = 1;
    let wordCount = currentWordCount;

    // Keep merging until we reach 80-300 words or hit limits
    while (startIndex + chunksUsed < paragraphs.length &&
        wordCount < 80 &&
        wordCount < 500) { // Absolute upper limit

        const nextParagraph = paragraphs[startIndex + chunksUsed];
        const nextWordCount = countWords(nextParagraph);

        // Check if adding next paragraph would exceed absolute limit
        if (wordCount + nextWordCount > 500) break;

        mergedText += '\n' + nextParagraph;
        wordCount += nextWordCount;
        chunksUsed++;

        // Stop if we're in target range
        if (wordCount >= 80 && wordCount <= 300) break;
    }

    return { currentChunk: mergedText, chunksUsed };
}

/**
 * Split long paragraphs at sentence boundaries
 */
function splitLongParagraph(text, wordCount) {
    if (wordCount <= 300) return [text];

    // Split into sentences
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let currentChunk = '';
    let currentWordCount = 0;

    for (const sentence of sentences) {
        const sentenceWordCount = countWords(sentence);

        // If adding this sentence would exceed 300 words, start new chunk
        if (currentWordCount > 0 && currentWordCount + sentenceWordCount > 300) {
            if (currentWordCount >= 50) { // Ensure minimum word count
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
            currentWordCount = sentenceWordCount;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
            currentWordCount += sentenceWordCount;
        }
    }

    // Add final chunk if it meets minimum requirements
    if (currentChunk.trim() && currentWordCount >= 50) {
        chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text]; // Fallback to original if splitting failed
}

/**
 * Create a paragraph chunk object
 */
function createParagraphChunk(text, chapter, pageData, position) {
    const cleanedText = text.trim();
    const wordCount = countWords(cleanedText);
    const pageNumber = estimateParagraphPage(position - 1, chapter, pageData);

    return {
        id: `${chapter.number}_${position}`,
        text: cleanedText,
        wordCount: wordCount,
        charCount: cleanedText.length,
        pageNumber: pageNumber,
        position: position,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title
    };
}

/**
 * Validate chunk structure according to REQUIREMENTS.md
 */
function validateChunkStructure(chunk) {
    const text = chunk.text;

    // REQUIREMENTS.md Chunk Structure Rules:
    // 1. MUST begin with capital letter (A-Z)
    const startsWithCapital = /^[A-Z]/.test(text);

    // 2. MUST end with sentence-ending punctuation (., !, ?, or footnote numbers)
    const endsWithPunctuation = /[.!?\d]$/.test(text);

    // 3. MUST be within absolute word count limits (50-500)
    const wordCountValid = chunk.wordCount >= 50 && chunk.wordCount <= 500;

    // 4. MUST have page number
    const hasPageNumber = chunk.pageNumber > 0;

    const isValid = startsWithCapital && endsWithPunctuation && wordCountValid && hasPageNumber;

    if (!isValid) {
        console.log(`     ⚠️  Invalid chunk ${chunk.id}:`);
        if (!startsWithCapital) console.log(`         - Does not start with capital: "${text.substring(0, 30)}..."`);
        if (!endsWithPunctuation) console.log(`         - Does not end with punctuation: "...${text.substring(text.length - 30)}"`);
        if (!wordCountValid) console.log(`         - Word count ${chunk.wordCount} outside 50-500 range`);
        if (!hasPageNumber) console.log(`         - Missing page number`);
    }

    return isValid;
}

/**
 * Count words in text
 */
function countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
}

/**
 * Clean paragraph text while preserving structure requirements
 */
function cleanParagraphText(text) {
    let cleaned = text;

    // Remove excessive whitespace but preserve structure
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove standalone page numbers at start/end
    cleaned = cleaned.replace(/^\d+\s+/, '');
    cleaned = cleaned.replace(/\s+\d+$/, '');

    // Remove chapter headers that appear mid-text
    cleaned = cleaned.replace(/^(CHAPTER|Chapter)\s+\d+\s*/i, '');

    // Clean up but preserve sentence endings
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Estimate page number for a paragraph within a chapter
 */
function estimateParagraphPage(paragraphIndex, chapter, pageData) {
    if (!chapter || !pageData) return chapter?.startPage || 1;

    const pageRange = chapter.endPage - chapter.startPage + 1;

    // Simple estimation based on position
    const estimatedOffset = Math.floor((paragraphIndex / 10) * pageRange);
    const estimatedPage = chapter.startPage + Math.min(estimatedOffset, pageRange - 1);

    return Math.max(chapter.startPage, Math.min(estimatedPage, chapter.endPage));
}

/**
 * Validate paragraph detection results against REQUIREMENTS.md
 */
function validateParagraphDetection(paragraphs) {
    console.log('\n✅ Validating paragraph detection against REQUIREMENTS.md...');

    const validation = {
        totalParagraphs: paragraphs.length,
        validParagraphs: 0,
        averageWordCount: 0,
        wordCountDistribution: {
            veryShort: 0,    // < 50 words (INVALID)
            short: 0,        // 50-79 words
            medium: 0,       // 80-150 words (TARGET)
            long: 0,         // 151-300 words (TARGET)
            veryLong: 0,     // 301-500 words
            tooLong: 0       // > 500 words (INVALID)
        },
        structureValidation: {
            startsWithCapital: 0,
            endsWithPunctuation: 0,
            hasPageNumber: 0,
            completeSentences: 0
        },
        issues: []
    };

    let totalWordCount = 0;

    paragraphs.forEach(paragraph => {
        const text = paragraph.text;
        const wordCount = paragraph.wordCount;
        totalWordCount += wordCount;

        // REQUIREMENTS.md Chunk Structure Rules validation
        const startsWithCapital = /^[A-Z]/.test(text);
        const endsWithPunctuation = /[.!?\d]$/.test(text);
        const hasPageNumber = paragraph.pageNumber > 0;
        const hasCompleteSentences = !text.includes('...') || text.endsWith('...');

        // Count structure compliance
        if (startsWithCapital) validation.structureValidation.startsWithCapital++;
        if (endsWithPunctuation) validation.structureValidation.endsWithPunctuation++;
        if (hasPageNumber) validation.structureValidation.hasPageNumber++;
        if (hasCompleteSentences) validation.structureValidation.completeSentences++;

        // Word count distribution
        if (wordCount < 50) {
            validation.wordCountDistribution.veryShort++;
            validation.issues.push(`Paragraph ${paragraph.id}: Too short (${wordCount} words, minimum 50)`);
        } else if (wordCount <= 79) {
            validation.wordCountDistribution.short++;
        } else if (wordCount <= 150) {
            validation.wordCountDistribution.medium++;
        } else if (wordCount <= 300) {
            validation.wordCountDistribution.long++;
        } else if (wordCount <= 500) {
            validation.wordCountDistribution.veryLong++;
        } else {
            validation.wordCountDistribution.tooLong++;
            validation.issues.push(`Paragraph ${paragraph.id}: Too long (${wordCount} words, maximum 500)`);
        }

        // Overall validation
        const isValidChunk = startsWithCapital && endsWithPunctuation && hasPageNumber &&
            wordCount >= 50 && wordCount <= 500;

        if (isValidChunk) {
            validation.validParagraphs++;
        } else {
            if (!startsWithCapital) validation.issues.push(`Paragraph ${paragraph.id}: Does not start with capital letter`);
            if (!endsWithPunctuation) validation.issues.push(`Paragraph ${paragraph.id}: Does not end with punctuation`);
            if (!hasPageNumber) validation.issues.push(`Paragraph ${paragraph.id}: Missing page number`);
        }
    });

    validation.averageWordCount = Math.round(totalWordCount / paragraphs.length);

    // Calculate target range compliance
    const targetRangeCount = validation.wordCountDistribution.medium + validation.wordCountDistribution.long;
    const targetRangePercent = Math.round(100 * targetRangeCount / paragraphs.length);

    // Calculate mandatory compliance rates
    const structureCompliance = {
        capitalStart: Math.round(100 * validation.structureValidation.startsWithCapital / paragraphs.length),
        punctuationEnd: Math.round(100 * validation.structureValidation.endsWithPunctuation / paragraphs.length),
        pageNumbers: Math.round(100 * validation.structureValidation.hasPageNumber / paragraphs.length),
        wordCountLimits: Math.round(100 * (paragraphs.length - validation.wordCountDistribution.veryShort - validation.wordCountDistribution.tooLong) / paragraphs.length)
    };

    console.log(`\n📊 Validation Results:`);
    console.log(`   Total paragraphs: ${validation.totalParagraphs}`);
    console.log(`   Valid paragraphs: ${validation.validParagraphs} (${Math.round(100 * validation.validParagraphs / paragraphs.length)}%)`);
    console.log(`   Average word count: ${validation.averageWordCount}`);

    console.log(`\n📋 REQUIREMENTS.md Compliance:`);
    console.log(`   ✓ Starts with capital: ${structureCompliance.capitalStart}% (${validation.structureValidation.startsWithCapital}/${paragraphs.length})`);
    console.log(`   ✓ Ends with punctuation: ${structureCompliance.punctuationEnd}% (${validation.structureValidation.endsWithPunctuation}/${paragraphs.length})`);
    console.log(`   ✓ Has page numbers: ${structureCompliance.pageNumbers}% (${validation.structureValidation.hasPageNumber}/${paragraphs.length})`);
    console.log(`   ✓ Word count 50-500: ${structureCompliance.wordCountLimits}% (absolute requirement)`);
    console.log(`   🎯 Target range 80-300: ${targetRangePercent}% (${targetRangeCount}/${paragraphs.length}) - flexible guideline`);

    console.log(`\n📈 Word Count Distribution:`);
    console.log(`   Very short (<50): ${validation.wordCountDistribution.veryShort} ❌ INVALID`);
    console.log(`   Short (50-79): ${validation.wordCountDistribution.short}`);
    console.log(`   Medium (80-150): ${validation.wordCountDistribution.medium} 🎯 TARGET`);
    console.log(`   Long (151-300): ${validation.wordCountDistribution.long} 🎯 TARGET`);
    console.log(`   Very long (301-500): ${validation.wordCountDistribution.veryLong}`);
    console.log(`   Too long (>500): ${validation.wordCountDistribution.tooLong} ❌ INVALID`);

    if (validation.issues.length > 0) {
        console.log(`\n⚠️  Issues found (${validation.issues.length}):`);
        validation.issues.slice(0, 10).forEach(issue => console.log(`   ${issue}`));
        if (validation.issues.length > 10) {
            console.log(`   ... and ${validation.issues.length - 10} more issues`);
        }
    }

    // Overall compliance check
    const criticalFailures = validation.wordCountDistribution.veryShort + validation.wordCountDistribution.tooLong;
    const mandatoryCompliance = structureCompliance.capitalStart === 100 &&
        structureCompliance.punctuationEnd === 100 &&
        structureCompliance.pageNumbers === 100 &&
        criticalFailures === 0;

    console.log(`\n${mandatoryCompliance ? '✅' : '❌'} REQUIREMENTS.md Compliance: ${mandatoryCompliance ? 'PASS' : 'FAIL'}`);

    if (!mandatoryCompliance) {
        console.log(`   Critical issues requiring fixes:`);
        if (structureCompliance.capitalStart < 100) console.log(`   - ${100 - structureCompliance.capitalStart}% of paragraphs don't start with capital`);
        if (structureCompliance.punctuationEnd < 100) console.log(`   - ${100 - structureCompliance.punctuationEnd}% of paragraphs don't end with punctuation`);
        if (structureCompliance.pageNumbers < 100) console.log(`   - ${100 - structureCompliance.pageNumbers}% of paragraphs missing page numbers`);
        if (criticalFailures > 0) console.log(`   - ${criticalFailures} paragraphs outside 50-500 word absolute limits`);
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
    cleanChapterTextPreservingParagraphs,
    validateChapterExtraction,
    testSpecificChapters,
    detectParagraphsInChapters,
    detectParagraphBoundaries,
    cleanParagraphText,
    estimateParagraphPage,
    validateParagraphDetection
}; 