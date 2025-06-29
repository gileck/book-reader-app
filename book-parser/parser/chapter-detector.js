const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { extractTOCFromPdf } = require('./toc-extractor');
const { extractTextContentWithCoordinates } = require('./link-resolver');
const { fuzzyMatch } = require('./text-processor');
const { combineTextItemsPreservingStructure, preserveHeadingsInPageText, cleanPageNumbers } = require('./text-processor');

/**
 * Detect chapters using TOC or pattern-based fallback
 * @param {string} text - Full text content from PDF
 * @param {Object} config - Configuration object
 * @param {string|null} pdfPath - Path to PDF file (optional)
 * @returns {Array} Array of chapter objects with content and page information
 */
async function detectChapters(text, config, pdfPath = null) {
    // Try TOC extraction first if PDF path is provided
    if (pdfPath) {
    
        const tocData = await extractTOCFromPdf(pdfPath);

        // Save tocData to debug file (only in debug mode)
        if (process.env.DEBUG_TEXT || process.argv.includes('--debug') || process.argv.includes('-d')) {
            const debugFolder = path.join(path.dirname(pdfPath), 'debug');
            if (!fs.existsSync(debugFolder)) {
                fs.mkdirSync(debugFolder, { recursive: true });
            }
            fs.writeFileSync(path.join(debugFolder, 'tocData.json'), JSON.stringify(tocData, null, 2), 'utf8');
        }

        if (tocData && tocData.chapters && tocData.chapters.length > 0) {


            // Extract chapter content using TOC data and full text
            const chapters = await extractChapterContentFromTOC(tocData.chapters, text, pdfPath, config);

            if (chapters && chapters.length > 0) {

                return chapters;
            } else {

            }
        } else {

        }
    }

    // Fallback to original text-based detection
    return await detectChaptersFromText(text, config);
}

/**
 * Extract chapter content using TOC data
 * @param {Array} tocChapters - Array of TOC chapter objects
 * @param {string} fullText - Full text content (unused in this implementation)
 * @param {string} pdfPath - Path to PDF file
 * @param {Object|null} config - Configuration object
 * @returns {Array|null} Array of chapter objects or null if extraction fails
 */
async function extractChapterContentFromTOC(tocChapters, fullText, pdfPath, config = null) {
    try {
        // Filter out non-content chapters (appendix, bibliography, etc.)
        const contentChapters = tocChapters.filter(ch => {
            if (!ch.startingPage) return false;

            // Original numeric chapter logic (preserve existing functionality)
            if ((typeof ch.chapterNumber === 'number' && ch.chapterNumber >= 0) ||
                ch.chapterNumber === 'Epilogue' ||
                (typeof ch.chapterNumber === 'string' && ch.chapterNumber.toLowerCase().includes('epilogue'))) {
                return true;
            }

            // NEW: If config has chapterNames, also include chapters that match those names
            if (config && config.chapterNames && config.chapterNames.length > 0) {
                return config.chapterNames.some(configName =>
                    ch.chapterTitle === configName ||
                    ch.chapterTitle.includes(configName) ||
                    configName.includes(ch.chapterTitle)
                );
            }

            return false;
        });

            if (contentChapters.length === 0) {
        return null;
    }

        // Use pdfjs to extract text page by page for precise chapter boundaries
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const doc = await pdfjsLib.getDocument(data).promise;

        const chapters = [];

        for (let i = 0; i < contentChapters.length; i++) {
            const currentChapter = contentChapters[i];
            const nextChapter = contentChapters[i + 1];

            const startPage = currentChapter.startingPage;
            const endPage = nextChapter ? nextChapter.startingPage - 1 : doc.numPages;

    

            const chapterPages = [];

            // Extract text from pages for this chapter, preserving page information
            for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
                try {
                    const page = await doc.getPage(pageNum);
                    const textContent = await page.getTextContent();

                    // Extract text with coordinate information
                    const textWithCoords = extractTextContentWithCoordinates(textContent);
                    let pageText = textWithCoords.combinedText;

                    // Get next page text for cross-page header detection
                    let nextPageText = '';
                    if (pageNum < endPage) {
                        try {
                            const nextPage = await doc.getPage(pageNum + 1);
                            const nextTextContent = await nextPage.getTextContent();
                            const nextRawText = combineTextItemsPreservingStructure(nextTextContent.items);
                            // Take first few lines of next page
                            const nextLines = nextRawText.split(' ⟨⟨LINE_BREAK⟩⟩ ').slice(0, 3);
                            nextPageText = nextLines.join(' ⟨⟨LINE_BREAK⟩⟩ ');
                        } catch (error) {
                            // Ignore errors getting next page
                        }
                    }

                    // Apply heading detection with cross-page context
                    pageText = preserveHeadingsInPageText(pageText, nextPageText);

                    // Clean page number from beginning of page text - pass the actual page number
                    pageText = cleanPageNumbers(pageText, pageNum);

                    if (pageText.length > 50) { // Only include pages with substantial content
                        chapterPages.push({
                            pageNumber: pageNum,
                            text: pageText,
                            coordinateBounds: textWithCoords.coordinateBounds
                        });
                    }
                } catch (error) {
                    // Skip pages with errors
                }
            }

            if (chapterPages.length > 0) {
                // Combine all page text for content lines (for backward compatibility)
                const combinedContent = chapterPages.map(p => p.text).join(' ')
                    // Clean up the text
                    .replace(/\s+/g, ' ')
                    .trim();

                // Split into reasonable chunks/paragraphs for content array
                const contentLines = combinedContent
                    .split(/[.!?]+\s+/)
                    .filter(line => line.trim().length > 20)
                    .map(line => line.trim() + (line.endsWith('.') ? '' : '.'));

                // Assign sequential chapter numbers when using config-based extraction
                const assignedChapterNumber = (config && config.chapterNames && config.chapterNames.length > 0)
                    ? i + 1  // Sequential numbering for config-based chapters
                    : currentChapter.chapterNumber; // Preserve original for TOC-only extraction

                chapters.push({
                    chapterNumber: assignedChapterNumber,
                    title: currentChapter.chapterTitle,
                    content: contentLines,
                    pages: chapterPages, // Add page-by-page data
                    startingPage: startPage,
                    endingPage: endPage
                });
            } else {
    
            }
        }

        return chapters.length > 0 ? chapters : null;

    } catch (error) {
        console.error('Error extracting chapter content from TOC:', error);
        return null;
    }
}

/**
 * Detect chapters from text using pattern matching
 * @param {string} text - Full text content
 * @param {Object} config - Configuration object
 * @returns {Array} Array of chapter objects
 */
async function detectChaptersFromText(text, config) {
    // DEBUG: Output raw text to file for inspection
    if (process.env.DEBUG_TEXT) {
        const fs = require('fs');
        const debugPath = process.env.DEBUG_TEXT;
        fs.writeFileSync(debugPath, text, 'utf8');
        console.log(`DEBUG: Raw PDF text saved to ${debugPath}`);
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const chapters = [];
    let currentChapter = null;
    let chapterNumber = 1;
    let contentStarted = !config.skipFrontMatter;

    // Create regex patterns from config
    const chapterPatterns = config.chapterPatterns.map(pattern => new RegExp(pattern, 'i'));
    const excludePattern = config.excludePatterns.length > 0 ?
        new RegExp(config.excludePatterns.join('|'), 'i') : null;

    // Auto-detect content start by finding "Contents" page and looking for first chapter
    let contentStartIndex = 0;
    for (let i = 0; i < Math.min(lines.length, 200); i++) { // Check first 200 lines
        const line = lines[i].toLowerCase();
        if (line.includes('contents') || line.includes('table of contents')) {
            // Look for the first chapter title from config right after TOC
            contentStartIndex = i + 5; // Start looking just a few lines after Contents

            // Search for the first chapter title from our config
            let foundFirstChapter = false;
            for (let j = i + 5; j < Math.min(lines.length, i + 100); j++) {
                const candidateLine = lines[j];

                // Check if this line matches any chapter from config
                if (config.chapterNames && config.chapterNames.length > 0) {
                    const matchingTitle = config.chapterNames.find(title => fuzzyMatch(candidateLine, title));
                    if (matchingTitle) {
                        contentStartIndex = j - 2; // Start a bit before the chapter title
                        foundFirstChapter = true;
                        console.log(`DEBUG: Found first chapter "${matchingTitle}" at line ${j}, starting detection from line ${contentStartIndex}`);
                        break;
                    }
                }
            }

            // If no chapter found, fall back to conservative approach
            if (!foundFirstChapter) {
                contentStartIndex = i + 15; // More conservative than before
                console.log(`DEBUG: No first chapter found, using fallback start at line ${contentStartIndex}`);
            }

            console.log(`DEBUG: Found "Contents" at line ${i}, starting chapter detection from line ${contentStartIndex}`);

            // DEBUG: Show some lines around the content start
            if (process.env.DEBUG_TEXT) {
                console.log(`DEBUG: Lines around content start:`);
                for (let j = Math.max(0, contentStartIndex - 5); j < Math.min(lines.length, contentStartIndex + 20); j++) {
                    const prefix = j === contentStartIndex ? '>>> ' : '    ';
                    console.log(`${prefix}Line ${j}: "${lines[j]}"`);
                }
            }
            break;
        }
    }

    // For explicit chapters, find ALL occurrences of each chapter name and pick the best one
    if (config.chapterNames && config.chapterNames.length > 0) {
        return detectExplicitChapters(lines, config, contentStartIndex);
    } else {
        return detectPatternBasedChapters(lines, config, chapterPatterns, excludePattern, contentStarted, chapterNumber);
    }
}

/**
 * Detect chapters using explicit chapter names from config
 * @param {Array} lines - Array of text lines
 * @param {Object} config - Configuration object
 * @param {number} contentStartIndex - Index to start looking for chapters
 * @returns {Array} Array of chapter objects
 */
function detectExplicitChapters(lines, config, contentStartIndex) {
    const chapters = [];
    let allChapterOccurrences = {};

    // Find ALL occurrences of each chapter name using fuzzy matching
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Find matching title using fuzzy matching
        const matchingTitle = config.chapterNames.find(title => fuzzyMatch(line, title));

        if (matchingTitle) {
            if (!allChapterOccurrences[matchingTitle]) {
                allChapterOccurrences[matchingTitle] = [];
            }
            allChapterOccurrences[matchingTitle].push({ line: matchingTitle, index: i, originalLine: line });

            if (process.env.DEBUG_TEXT) {
                console.log(`DEBUG: Found occurrence of "${matchingTitle}" at line ${i}: "${line}"`);
            }
        }

        // Also check for multi-line titles (title split across consecutive lines)
        if (i < lines.length - 1) {
            const nextLine = lines[i + 1];
            const combinedLine = line + ' ' + nextLine;

            const multiLineMatchingTitle = config.chapterNames.find(title => fuzzyMatch(combinedLine, title));

            if (multiLineMatchingTitle) {
                if (!allChapterOccurrences[multiLineMatchingTitle]) {
                    allChapterOccurrences[multiLineMatchingTitle] = [];
                }
                allChapterOccurrences[multiLineMatchingTitle].push({
                    line: multiLineMatchingTitle,
                    index: i,
                    originalLine: combinedLine.trim(),
                    isMultiLine: true
                });

                if (process.env.DEBUG_TEXT) {
                    console.log(`DEBUG: Found multi-line occurrence of "${multiLineMatchingTitle}" at line ${i}: "${combinedLine.trim()}"`);
                }
            }
        }
    }

    // For each chapter, pick the occurrence that has the most content after it
    let chapterOccurrences = [];
    for (const [chapterTitle, occurrences] of Object.entries(allChapterOccurrences)) {
        let bestOccurrence = null;
        let maxContentLines = 0;

        for (const occurrence of occurrences) {
            // Count content lines after this occurrence
            let contentLines = 0;
            for (let j = occurrence.index + 1; j < Math.min(lines.length, occurrence.index + 100); j++) {
                const nextLine = lines[j];

                // Stop if we hit another chapter name
                const isNextChapter = config.chapterNames.some(title => fuzzyMatch(nextLine, title));
                if (isNextChapter) {
                    break;
                }

                // Count substantial content lines
                if (nextLine.length > 20 && !/^\d+$/.test(nextLine)) {
                    contentLines++;
                }
            }

            if (process.env.DEBUG_TEXT) {
                console.log(`DEBUG: "${chapterTitle}" at line ${occurrence.index} has ${contentLines} content lines`);
            }

            // Pick the occurrence with the most content
            if (contentLines > maxContentLines) {
                maxContentLines = contentLines;
                bestOccurrence = occurrence;
            }
        }

        if (bestOccurrence && maxContentLines >= 1) {
            chapterOccurrences.push(bestOccurrence);
            console.log(`DEBUG: Selected "${chapterTitle}" at line ${bestOccurrence.index} (${maxContentLines} content lines)`);
        } else if (process.env.DEBUG_TEXT) {
            console.log(`DEBUG: Rejected all occurrences of "${chapterTitle}" - insufficient content (${maxContentLines} lines)`);
        }
    }

    console.log(`DEBUG: Found ${chapterOccurrences.length} chapters with validated content`);

    // Sort chapters by their line index to ensure proper order
    chapterOccurrences.sort((a, b) => a.index - b.index);

    // Process the selected chapters
    let chapterNumber = 1;
    for (let chapterIdx = 0; chapterIdx < chapterOccurrences.length; chapterIdx++) {
        const currentChapterOcc = chapterOccurrences[chapterIdx];
        const nextChapterOcc = chapterOccurrences[chapterIdx + 1];

        const startLine = currentChapterOcc.index;
        const endLine = nextChapterOcc ? nextChapterOcc.index : lines.length;

        console.log(`DEBUG: Processing chapter "${currentChapterOcc.line}" from line ${startLine} to ${endLine}`);

        const chapterContent = [];
        for (let i = startLine + 1; i < endLine; i++) {
            const line = lines[i];

            // Skip page numbers and metadata
            const isPageNumber = /^\d+$/.test(line);
            const isMetadata = /^(isbn|copyright|typeset|printed|published|all rights|first published|volume)/i.test(line);

            if (line.length > 10 && !isPageNumber && !isMetadata) {
                chapterContent.push(line);
            }
        }

        console.log(`DEBUG: Chapter "${currentChapterOcc.line}" extracted ${chapterContent.length} content lines`);

        if (chapterContent.length > 0) {
            chapters.push({
                chapterNumber: chapterNumber++,
                title: currentChapterOcc.line,
                content: chapterContent
            });
            console.log(`DEBUG: Added chapter "${currentChapterOcc.line}" to final list (total chapters: ${chapters.length})`);
        } else {
            console.log(`DEBUG: Skipped chapter "${currentChapterOcc.line}" - no valid content lines`);
        }
    }

    return chapters;
}

/**
 * Detect chapters using pattern-based matching
 * @param {Array} lines - Array of text lines
 * @param {Object} config - Configuration object
 * @param {Array} chapterPatterns - Array of regex patterns for chapters
 * @param {RegExp|null} excludePattern - Pattern for content to exclude
 * @param {boolean} contentStarted - Whether content detection has started
 * @param {number} chapterNumber - Starting chapter number
 * @returns {Array} Array of chapter objects
 */
function detectPatternBasedChapters(lines, config, chapterPatterns, excludePattern, contentStarted, chapterNumber) {
    const chapters = [];
    let currentChapter = null;

    // Fallback to pattern-based detection (original logic)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip front matter if configured
        if (!contentStarted) {
            const isLikelyContent = line.length > 100 ||
                chapterPatterns.some(pattern => pattern.test(line));
            if (isLikelyContent) {
                contentStarted = true;
            } else {
                continue;
            }
        }

        // Check if we should stop (back matter)
        if (excludePattern && excludePattern.test(line)) {
            console.log(`DEBUG: Stopping at back matter: "${line}"`);
            break;
        }

        const isChapterHeading = chapterPatterns.some(pattern => pattern.test(line));

        // Additional filters
        const isPageNumber = /^\d+$/.test(line) || /^page\s+\d+$/i.test(line);
        const isMetadata = /^(isbn|copyright|typeset|printed|published|all rights|first published|volume)/i.test(line);
        const isTooShort = line.length < 5;
        const isTooLong = line.length > 50;
        const isPartialSentence = line.includes(',') || line.includes(';') ||
            line.endsWith('of') || line.endsWith('the') || line.endsWith('and');
        const isBibliography = /\(\w+,|\d{4}\)|press|oxford|university|journal/i.test(line);

        const isLikelyChapter = isChapterHeading && !isPageNumber &&
            !isMetadata && !isTooShort && !isTooLong && !isPartialSentence && !isBibliography;

        if (isLikelyChapter) {
            // Save previous chapter
            if (currentChapter && currentChapter.content.length > 0) {
                const contentLength = currentChapter.content.join(' ').length;
                if (contentLength > 200) {
                    chapters.push(currentChapter);
                }
            }

            // Start new chapter
            let title = line;
            const explicitChapterMatch = line.match(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*:?\s*/i);
            const numberedChapterMatch = line.match(/^(\d+)\.\s+([A-Za-z][a-zA-Z\s]{8,40})$/);

            if (explicitChapterMatch) {
                title = line.replace(explicitChapterMatch[0], '').trim();
                if (!title) title = `Chapter ${chapterNumber}`;
            } else if (numberedChapterMatch) {
                title = numberedChapterMatch[2].trim();
            }

            currentChapter = {
                chapterNumber: chapterNumber++,
                title: title,
                content: []
            };
        } else if (currentChapter && line.length > 20 && !isMetadata && !isPageNumber) {
            currentChapter.content.push(line);
        } else if (!currentChapter && line.length > 50) {
            // Create first chapter if none detected yet
            currentChapter = {
                chapterNumber: chapterNumber++,
                title: 'Chapter 1',
                content: [line]
            };
        }
    }

    // Add final chapter
    if (currentChapter && currentChapter.content.length > 0) {
        const contentLength = currentChapter.content.join(' ').length;
        if (contentLength > 200) {
            chapters.push(currentChapter);
        }
    }

    console.log(`DEBUG: Total chapters found: ${chapters.length}`);
    chapters.forEach((ch, idx) => {
        console.log(`DEBUG: Chapter ${idx + 1}: "${ch.title}" (${ch.content.length} lines)`);
    });

    // Fallback: create single chapter if no chapters detected
    if (chapters.length === 0) {
        console.log(`DEBUG: No chapters detected, creating fallback chapter`);
        const allContent = lines.filter(line =>
            line.length > 50 &&
            !/^(isbn|copyright|typeset|printed|published|all rights|first published)/i.test(line) &&
            !/^\d+$/.test(line)
        );

        if (allContent.length > 0) {
            chapters.push({
                chapterNumber: 1,
                title: 'Full Text',
                content: allContent
            });
        }
    }

    return chapters;
}

module.exports = {
    detectChapters,
    extractChapterContentFromTOC,
    detectChaptersFromText,
    detectExplicitChapters,
    detectPatternBasedChapters
}; 