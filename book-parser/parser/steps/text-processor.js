/**
 * Process and chunk text with heading detection and cleaning
 * @param {string} text - Raw text to process
 * @param {number} minWords - Minimum words per chunk (default: 5)
 * @param {number} maxWords - Maximum words per chunk (default: 15)
 * @returns {Array} Array of text chunks with metadata
 */
function chunkText(text, minWords = 5, maxWords = 15) {
    // First, extract any marked headings from the text
    const headingMarkers = [];
    let processedText = text;

    // Find all heading markers and extract them
    const headingRegex = /⟨⟨HEADING⟩⟩(.*?)⟨⟨\/HEADING⟩⟩/g;
    let match;
    while ((match = headingRegex.exec(text)) !== null) {
        headingMarkers.push({
            fullMatch: match[0],
            heading: match[1],
            index: match.index
        });
    }

    // Remove heading markers from text for processing
    processedText = processedText.replace(headingRegex, '⟨⟨HEADING_PLACEHOLDER⟩⟩');

    // Split by sentence endings, but be smarter about abbreviations
    const sentences = [];
    let currentSentence = '';
    const words = processedText.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        // Check if this is a heading placeholder
        if (word === '⟨⟨HEADING_PLACEHOLDER⟩⟩') {
            // Finish current sentence if exists
            if (currentSentence.trim()) {
                sentences.push(currentSentence.trim());
                currentSentence = '';
            }
            // Add the placeholder as its own sentence
            sentences.push('⟨⟨HEADING_PLACEHOLDER⟩⟩');
            continue;
        }

        currentSentence += (currentSentence ? ' ' : '') + word;

        // Check if this word ends a sentence
        if (/[.!?]+$/.test(word)) {
            // Don't split if it's a common abbreviation and next word is lowercase
            const nextWord = words[i + 1];
            const isAbbreviation = endsWithAbbreviation(currentSentence);
            const nextIsLowercase = nextWord && /^[a-z]/.test(nextWord);

            // Check if the next word is a footnote reference (numbers, letters, symbols)
            const nextIsFootnote = nextWord && /^[0-9a-zA-Z\*\†\‡\§\¶]{1,3}$/.test(nextWord);

            if (!isAbbreviation || !nextIsLowercase) {
                if (nextIsFootnote) {
                    // Include the footnote with the current sentence, then split
                    currentSentence += (currentSentence ? ' ' : '') + nextWord;
                    sentences.push(currentSentence.trim());
                    currentSentence = '';
                    i++; // Skip the footnote word since we've already processed it
                } else {
                    // This is a real sentence ending
                    sentences.push(currentSentence.trim());
                    currentSentence = '';
                }
            }
        }
    }

    // Add any remaining text as a sentence
    if (currentSentence.trim()) {
        sentences.push(currentSentence.trim());
    }

    const chunks = [];
    let currentChunk = '';
    let currentWords = [];
    let wordIndex = 0;
    let headingIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];

        // Check if this is a heading placeholder
        if (sentence === '⟨⟨HEADING_PLACEHOLDER⟩⟩') {
            // If we have accumulated text, create a chunk for it first
            if (currentChunk.trim().length > 0) {
                chunks.push({
                    text: currentChunk.trim(),
                    words: [...currentWords],
                    startIndex: wordIndex - currentWords.length,
                    endIndex: wordIndex - 1,
                    type: 'text'
                });
                currentChunk = '';
                currentWords = [];
            }

            // Get the actual heading text from our markers
            if (headingIndex < headingMarkers.length) {
                const headingText = headingMarkers[headingIndex].heading;
                const headingWords = headingText.trim().split(/\s+/).filter(w => w.length > 0);

                // Create a header chunk
                chunks.push({
                    text: headingText.trim(),
                    words: headingWords,
                    startIndex: wordIndex,
                    endIndex: wordIndex + headingWords.length - 1,
                    type: 'header'
                });

                wordIndex += headingWords.length;


                headingIndex++;
            }
            continue;
        }

        const sentenceWords = sentence.trim().split(/\s+/).filter(w => w.length > 0);

        // Regular text processing
        if (currentWords.length > 0 && currentWords.length + sentenceWords.length > maxWords) {
            chunks.push({
                text: currentChunk.trim(),
                words: [...currentWords],
                startIndex: wordIndex - currentWords.length,
                endIndex: wordIndex - 1,
                type: 'text'
            });
            currentChunk = '';
            currentWords = [];
        }

        if (currentChunk.length > 0) {
            currentChunk += ' ';
        }
        currentChunk += sentence.trim();
        currentWords.push(...sentenceWords);
        wordIndex += sentenceWords.length;

        if (currentWords.length >= minWords) {
            chunks.push({
                text: currentChunk.trim(),
                words: [...currentWords],
                startIndex: wordIndex - currentWords.length,
                endIndex: wordIndex - 1,
                type: 'text'
            });
            currentChunk = '';
            currentWords = [];
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push({
            text: currentChunk.trim(),
            words: [...currentWords],
            startIndex: wordIndex - currentWords.length,
            endIndex: wordIndex - 1,
            type: 'text'
        });
    }

    // Post-process to merge small chunks - BUT NEVER MERGE HEADERS
    const mergedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Never merge headers
        if (chunk.type === 'header') {
            mergedChunks.push(chunk);
            continue;
        }

        if (chunk.words.length < 10) {
            const isVerySmall = chunk.words.length <= 5;
            const maxAllowed = isVerySmall ? maxWords + 5 : maxWords;

            // Check next chunk exists and is not a header
            const nextChunk = chunks[i + 1];
            if (i < chunks.length - 1 && nextChunk.type !== 'header' &&
                chunk.words.length + nextChunk.words.length <= maxAllowed) {

                const mergedChunk = {
                    text: chunk.text + ' ' + nextChunk.text,
                    words: [...chunk.words, ...nextChunk.words],
                    startIndex: chunk.startIndex,
                    endIndex: nextChunk.endIndex,
                    type: 'text'
                };
                mergedChunks.push(mergedChunk);
                i++;
            } else if (mergedChunks.length > 0 &&
                mergedChunks[mergedChunks.length - 1].type !== 'header' &&
                mergedChunks[mergedChunks.length - 1].words.length + chunk.words.length <= maxAllowed) {

                const prevChunk = mergedChunks[mergedChunks.length - 1];
                prevChunk.text = prevChunk.text + ' ' + chunk.text;
                prevChunk.words = [...prevChunk.words, ...chunk.words];
                prevChunk.endIndex = chunk.endIndex;
            } else if (isVerySmall) {
                if (nextChunk && nextChunk.type !== 'header') {
                    const mergedChunk = {
                        text: chunk.text + ' ' + nextChunk.text,
                        words: [...chunk.words, ...nextChunk.words],
                        startIndex: chunk.startIndex,
                        endIndex: nextChunk.endIndex,
                        type: 'text'
                    };
                    mergedChunks.push(mergedChunk);
                    i++;
                } else if (mergedChunks.length > 0 && mergedChunks[mergedChunks.length - 1].type !== 'header') {
                    const prevChunk = mergedChunks[mergedChunks.length - 1];
                    prevChunk.text = prevChunk.text + ' ' + chunk.text;
                    prevChunk.words = [...prevChunk.words, ...chunk.words];
                    prevChunk.endIndex = chunk.endIndex;
                } else {
                    mergedChunks.push(chunk);
                }
            } else {
                mergedChunks.push(chunk);
            }
        } else {
            mergedChunks.push(chunk);
        }
    }

    return mergedChunks;
}

/**
 * Clean page numbers from text using observed pattern
 * @param {string} text - Text to clean
 * @param {number|null} pageNumber - PDF page number (optional)
 * @returns {string} Cleaned text
 */
function cleanPageNumbers(text, pageNumber = null) {
    if (!pageNumber) {
        return text; // If no page number provided, don't clean anything
    }

    // Use the observed pattern: book page number = PDF page number - 1
    const bookPageNumber = pageNumber - 1;
    if (bookPageNumber >= 1) {
        const bookPageRegex = new RegExp(`^\\s*${bookPageNumber}\\s+`, '');
        if (bookPageRegex.test(text)) {
            text = text.replace(bookPageRegex, '');
        }
    }

    // Handle Roman numerals for front matter pages (i, ii, iii, etc.)
    // These usually appear in the first few pages where the pattern might not apply
    if (pageNumber <= 20) {
        const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];
        for (const roman of romanNumerals) {
            const romanRegex = new RegExp(`^\\s*${roman}\\s+`, 'i');
            if (romanRegex.test(text)) {
                // Only remove if what follows looks like content
                const afterRoman = text.replace(romanRegex, '');
                if (afterRoman.match(/^[A-Z]/) || afterRoman.match(/^(the|and|or|but|in|on|at|to|for|of|with|by)/i)) {
                    text = afterRoman;
                    break;
                }
            }
        }
    }

    return text;
}

/**
 * Clean chapter heading from the beginning of text
 * @param {string} text - Text to clean
 * @param {string} chapterTitle - Chapter title to remove
 * @param {number} chapterNumber - Chapter number
 * @returns {string} Cleaned text
 */
function cleanChapterHeading(text, chapterTitle, chapterNumber) {
    let cleanedText = text;

    // Step 1: Remove ":" from chapter name and normalize it to uppercase
    const normalizedChapterTitle = chapterTitle.replace(/[:\?]/g, '').toUpperCase();

    // Step 2: Normalize the text to uppercase for comparison
    const normalizedText = text.toUpperCase();

    // Step 3: Find and remove ONLY the normalized chapter name from the text
    const chapterIndex = normalizedText.indexOf(normalizedChapterTitle);
    if (chapterIndex !== -1 && chapterIndex < 200) { // Only look in first 200 chars
        // Remove ONLY the chapter title, keeping everything before and after
        const beforeChapter = text.substring(0, chapterIndex);
        const afterChapter = text.substring(chapterIndex + normalizedChapterTitle.length);

        // Combine before + after, removing the chapter heading
        const combined = (beforeChapter + afterChapter).trim();

        if (combined.length > 10) { // Make sure we don't remove too much
            // Step 4: Remove extra spaces ONLY at the very beginning (fix split words like "I n" → "In")
            cleanedText = combined
                .replace(/^([A-Za-z])\s+([a-z])/, '$1$2') // Fix split words only at the beginning
                .trim();


        }
    }

    return cleanedText;
}

/**
 * Fix spaced first letter issue (e.g., "O   nce upon a time" -> "Once upon a time")
 * @param {string} text - Text to fix
 * @returns {string} Fixed text
 */
function fixSpacedFirstLetter(text) {
    // Look for pattern: single capital letter followed by one or more spaces and lowercase letter
    // This handles PDF formatting artifacts where the first letter is separated
    return text.replace(/^([A-Z])\s+([a-z])/, '$1$2');
}

/**
 * Normalize text for fuzzy matching
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
    return text
        .replace(/\s+/g, ' ')           // Multiple spaces → single space
        .replace(/[\u201C\u201D]/g, '"') // Smart quotes → straight quotes (U+201C, U+201D)
        .replace(/[\u2018\u2019]/g, "'") // Smart apostrophes → straight (U+2018, U+2019)
        .replace(/[\u2033\u2036]/g, '"') // Additional smart quotes (U+2033, U+2036)
        .replace(/\\/g, '')             // Remove escape characters from config
        .replace(/\s+(ix|xi{1,3}|[0-9]+)\s*$/i, '') // Remove page numbers at end
        .trim();
}

/**
 * Fuzzy match PDF line against config title
 * @param {string} pdfLine - Line from PDF
 * @param {string} configTitle - Title from config
 * @returns {boolean} Whether they match
 */
function fuzzyMatch(pdfLine, configTitle) {
    const normalizedLine = normalizeText(pdfLine);
    const normalizedTitle = normalizeText(configTitle);

    // Check exact match after normalization
    if (normalizedLine === normalizedTitle) {
        return true;
    }

    // Check if line starts with the title (handles joined content)
    if (normalizedLine.startsWith(normalizedTitle)) {
        return true;
    }

    // Check if title is contained in line (handles split lines)
    if (normalizedLine.includes(normalizedTitle) && normalizedTitle.length > 10) {
        return true;
    }

    // Handle split titles: check if line ends with most of the title
    if (normalizedTitle.length > 10) {
        // Try removing first 1-3 characters from title to handle split
        for (let skip = 1; skip <= 3; skip++) {
            const partialTitle = normalizedTitle.substring(skip);
            if (partialTitle.length > 8 && normalizedLine === partialTitle) {
                return true;
            }
            // Also check if line starts with partial title
            if (partialTitle.length > 8 && normalizedLine.startsWith(partialTitle)) {
                return true;
            }
        }
    }

    return false;
}

const fs = require('fs');
const path = require('path');

/**
 * Combine text items from PDF while preserving natural structure and line breaks
 * @param {Array} textItems - Array of PDF text items
 * @returns {string} Combined text with line break markers
 */
function combineTextItemsPreservingStructure(textItems, debugFolderPath = null, rawPageText = null) {
    // If raw page text is provided, use it instead of reconstructing from coordinates
    if (rawPageText) {
        return processRawTextIntoParagraphs(rawPageText, debugFolderPath);
    }

    // Extract raw text preserving reading order without coordinate-based line grouping
    if (!textItems || textItems.length === 0) return '';

    const rawText = extractRawTextFromItems(textItems);
    return processRawTextIntoParagraphs(rawText, debugFolderPath);
}

/**
 * Process raw PDF text into paragraphs using natural line breaks
 * @param {string} rawText - Raw PDF text with natural line breaks
 * @param {string} debugFolderPath - Path for debug output
 * @returns {string} Text with paragraph markers
 */
function processRawTextIntoParagraphs(rawText, debugFolderPath = null) {
    // Split raw text by actual newlines (preserves natural paragraph structure)
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    return processLinesIntoParagraphs(lines, debugFolderPath);
}

/**
 * Extract raw text from text items in reading order without coordinate-based line grouping
 * @param {Array} textItems - PDF text items
 * @returns {string} Raw text preserving natural reading flow
 */
function extractRawTextFromItems(textItems) {
    if (!textItems || textItems.length === 0) return '';

    // Sort items by Y coordinate (top to bottom) then X coordinate (left to right)
    const sortedItems = [...textItems].sort((a, b) => {
        const yDiff = Math.round(b.transform[5]) - Math.round(a.transform[5]); // Fixed: b - a for top to bottom
        if (Math.abs(yDiff) > 10) { // Different lines
            return yDiff;
        }
        // Same line, sort by X coordinate
        return a.transform[4] - b.transform[4];
    });

    // Join text items with spaces, preserving original text flow
    const textParts = [];
    let lastY = null;

    for (const item of sortedItems) {
        const currentY = Math.round(item.transform[5]);

        // Add newline if we're on a significantly different Y coordinate (new line)
        if (lastY !== null && Math.abs(currentY - lastY) > 10) {
            textParts.push('\n');
        }

        if (item.str.trim()) {
            textParts.push(item.str.trim());
        }

        lastY = currentY;
    }

    return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Process lines into paragraphs with proper detection logic
 * @param {Array} lines - Array of text lines
 * @param {string} debugFolderPath - Path for debug output
 * @returns {string} Text with paragraph markers
 */
function processLinesIntoParagraphs(lines, debugFolderPath = null) {

    // Smart paragraph detection: split on actual paragraph breaks, not sentence endings
    const paragraphs = [];
    let currentParagraph = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.length === 0) {
            // Empty line indicates paragraph break
            if (currentParagraph.trim().length > 0) {
                paragraphs.push(currentParagraph.trim());
                currentParagraph = '';
            }
            continue;
        }

        // Add line to current paragraph
        if (currentParagraph.length > 0) {
            currentParagraph += ' ';
        }
        currentParagraph += line;

        // FIXED: Proper paragraph detection - don't break at every sentence!
        // Only break paragraphs when there's an actual paragraph boundary
        // Most paragraphs contain multiple sentences, so we should continue
        // building the paragraph until we hit a real paragraph break
        
        // Look ahead to see if the next line suggests a paragraph break
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        const shouldBreakParagraph = nextLine.length > 0 && (
            // Next line starts with obvious paragraph indicators
            /^[A-Z][a-z]+/.test(nextLine) && /[.!?]$/.test(line) && nextLine !== nextLine.toUpperCase() ||
            // Current line ends with a period and next line starts with capital letter (common paragraph pattern)
            /\.$/.test(line) && /^[A-Z]/.test(nextLine) && currentParagraph.split(/\s+/).length > 40 ||
            // Next line looks like a new section/chapter
            /^(Chapter|Section|\d+\.|\w+:)/.test(nextLine)
        );
        
        if (shouldBreakParagraph) {
            paragraphs.push(currentParagraph.trim());
            currentParagraph = '';
        }
    }

    // Add any remaining text as final paragraph
    if (currentParagraph.trim().length > 0) {
        paragraphs.push(currentParagraph.trim());
    }

    // Debug: Save ALL original paragraphs before merging to output folder
    if (debugFolderPath) {
        try {
            const fs = require('fs');
            const path = require('path');

            const debugInfo = [
                'ALL ORIGINAL PARAGRAPHS BEFORE MERGING:',
                `Total paragraphs: ${paragraphs.length}`,
                `Paragraphs < 60 words: ${paragraphs.filter(p => p.trim().split(/\s+/).length < 60).length}`,
                `Paragraphs >= 60 words: ${paragraphs.filter(p => p.trim().split(/\s+/).length >= 60).length}`,
                '',
                ...paragraphs.map((para, i) => {
                    const wordCount = para.trim().split(/\s+/).length;
                    const shortFlag = wordCount < 60 ? ' [SHORT]' : '';
                    return `Paragraph ${i} (${wordCount} words)${shortFlag}: "${para.substring(0, 300)}${para.length > 300 ? '...' : ''}"`;
                }),
                ''
            ];

            fs.writeFileSync(path.join(debugFolderPath, 'raw-paragraphs-before-merging.txt'), debugInfo.join('\n'));
        } catch (error) {
            // Ignore write errors
        }
    }

    // Debug: Save original paragraphs before merging (ALL content) to output folder
    if (debugFolderPath) {
        try {
            const fs = require('fs');
            const path = require('path');

            const debugInfo = [
                `\n=== NEW SECTION: ${paragraphs.length} paragraphs ===`,
                ...paragraphs.map((para, i) => {
                    const wordCount = para.trim().split(/\s+/).length;
                    const shortFlag = wordCount < 60 ? ' [SHORT]' : '';
                    return `Paragraph ${i} (${wordCount} words)${shortFlag}: "${para.substring(0, 300)}${para.length > 300 ? '...' : ''}"`;
                }),
                ''
            ];

            fs.appendFileSync(path.join(debugFolderPath, 'all-sections-before-merge.txt'), debugInfo.join('\n'));
        } catch (error) {
            // Ignore write errors
        }
    }

    // Smart merging: merge short paragraphs with shorter neighboring paragraphs
    const mergedParagraphs = smartMergeParagraphs(paragraphs, 80);

    // Debug for problematic text
    if (mergedParagraphs.some(p => p.includes('inorganic') || p.includes('Yet at night') || p.includes('The structure'))) {
        try {
            const fs = require('fs');
            const debugDir = './debug';
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir);
            }

            const debugInfo = [
                'SMART PARAGRAPH DETECTION DEBUG:',
                `Original lines: ${lines.length}`,
                `Initial paragraphs: ${paragraphs.length}`,
                `After merging: ${mergedParagraphs.length}`,
                '',
                'Paragraphs containing target text:',
                ...mergedParagraphs.map((para, i) => {
                    if (para.includes('inorganic') || para.includes('Yet at night') || para.includes('The structure')) {
                        return `Paragraph ${i}: "${para.substring(0, 200)}${para.length > 200 ? '...' : ''}"`;
                    }
                    return null;
                }).filter(Boolean),
                ''
            ];

            fs.writeFileSync('./debug/smart-paragraph-debug.txt', debugInfo.join('\n'));
        } catch (error) {
            // Ignore write errors
        }
    }

    // Join paragraphs with line break markers
    return mergedParagraphs.join(' ⟨⟨LINE_BREAK⟩⟩ ').trim();
}

/**
 * Smart merging logic: merge short paragraphs with shorter neighboring paragraphs
 * @param {Array} paragraphs - Array of paragraph strings
 * @param {number} minWords - Minimum words for a paragraph to be considered complete (default: 8)
 * @returns {Array} Array of merged paragraphs
 */
function smartMergeParagraphs(paragraphs, minWords = 8) {
    if (paragraphs.length <= 1) return paragraphs;

    const result = [...paragraphs];
    let i = 0;

    while (i < result.length) {
        const currentWords = result[i].trim().split(/\s+/).length;

        // If current paragraph is too short, merge with shorter neighbor
        if (currentWords < minWords) {
            const prevWords = i > 0 ? result[i - 1].trim().split(/\s+/).length : Infinity;
            const nextWords = i < result.length - 1 ? result[i + 1].trim().split(/\s+/).length : Infinity;

            // Check if merging would create a paragraph that's too long
            const mergeWithPrev = prevWords <= nextWords && i > 0;
            const mergeWithNext = !mergeWithPrev && i < result.length - 1;

            if (mergeWithPrev) {
                const mergedWords = prevWords + currentWords;
                if (mergedWords <= 300) { // Hard limit for merged paragraphs
                    result[i - 1] = result[i - 1] + ' ' + result[i];
                    result.splice(i, 1);
                    i--; // Check the merged paragraph again
                } else {
                    i++; // Skip if would create too long paragraph
                }
            } else if (mergeWithNext) {
                const mergedWords = currentWords + nextWords;
                if (mergedWords <= 300) { // Hard limit for merged paragraphs
                    result[i] = result[i] + ' ' + result[i + 1];
                    result.splice(i + 1, 1);
                    // Don't increment i, check the merged paragraph again
                } else {
                    i++; // Skip if would create too long paragraph
                }
            } else {
                // Can't merge, move on
                i++;
            }
        } else {
            i++;
        }
    }

    return result;
}

/**
 * Preserve headings in page text by detecting them and adding special markers
 * @param {string} pageText - Page text with line break markers
 * @param {string} nextPageText - Next page text for context (optional)
 * @returns {string} Text with heading markers
 */
function preserveHeadingsInPageText(pageText, nextPageText = '') {
    // First, split by our line break markers
    const lines = pageText.split(' ⟨⟨LINE_BREAK⟩⟩ ');
    const nextPageLines = nextPageText ? nextPageText.split(' ⟨⟨LINE_BREAK⟩⟩ ') : [];
    const processedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1];
        const previousLine = i > 0 ? lines[i - 1] : null;

        if (line.length === 0) continue;

        // For the last line of the page, check next page's first line as context
        const contextNextLine = (i === lines.length - 1 && nextPageLines.length > 0)
            ? nextPageLines[0]?.trim()
            : nextLine;

        // Check if this line is likely a heading
        if (isLikelyHeading(line, contextNextLine, previousLine)) {
            // Add special markers around the heading
            processedLines.push(`⟨⟨HEADING⟩⟩${line}⟨⟨/HEADING⟩⟩`);

        } else {
            processedLines.push(line);
        }
    }

    // CRITICAL FIX: Preserve line break markers when rejoining
    return processedLines.join(' ⟨⟨LINE_BREAK⟩⟩ ');
}

/**
 * Detect if text appears to be a heading/subtitle
 * @param {string} text - Text to check
 * @param {string|null} nextText - Following text for context
 * @param {string|null} previousText - Previous text for context
 * @returns {boolean} Whether text is likely a heading
 */
function isLikelyHeading(text, nextText = null, previousText = null) {
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);

    // Skip very short fragments (likely extraction artifacts)
    if (trimmed.length < 3) return false;

    // Filter out email addresses
    if (/@/.test(trimmed)) {
        return false;
    }

    // Basic filters - ALL must be true for consideration  
    if (words.length > 10 || /[.!?;)@]$/.test(trimmed) || !/^[A-Z]/.test(trimmed)) {
        return false;
    }

    // Check if previous text ends properly for a heading to follow
    if (previousText && previousText.trim().length > 0) {
        const prevTrimmed = previousText.trim();
        const lastChar = prevTrimmed.slice(-1);

        // Previous text must end with sentence-ending punctuation or a number
        const endsWithPunctuation = /[.!?;]$/.test(lastChar);
        const endsWithNumber = /\d$/.test(lastChar);

        if (!endsWithPunctuation && !endsWithNumber) {
            // Exception: Allow if previous text ends with common abbreviations
            const commonAbbrevs = ['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'etc', 'vs', 'cf'];
            const endsWithAbbrev = commonAbbrevs.some(abbrev =>
                prevTrimmed.toLowerCase().endsWith(abbrev.toLowerCase() + '.')
            );

            if (!endsWithAbbrev) {
                return false;
            }
        }
    }

    // Filter out split chemical formulas and subscripts/superscripts
    // Pattern: single letter/short word + lowercase continuation (e.g., "C on", "CO2", "H2O")
    if (words.length >= 2) {
        const firstWord = words[0];
        const secondWord = words[1];

        // Check for chemical formula patterns
        if (firstWord.length <= 2 && /^[A-Z][a-z]?$/.test(firstWord) && /^[a-z]/.test(secondWord)) {
            // Pattern like "C on", "Ca and", "Mg in" - likely split chemical formulas
            return false;
        }

        // Check for split chemical formulas with numbers (CO 2, H 2)
        if (firstWord.length <= 2 && /^[A-Z][a-z]?$/.test(firstWord) && /^\d+$/.test(secondWord)) {
            return false;
        }
    }

    // Filter out single letters followed by lowercase words (split subscripts)
    if (words.length >= 1) {
        const firstWord = words[0];
        if (firstWord.length === 1 && /^[A-Z]$/.test(firstWord) && words.length > 1 && /^[a-z]/.test(words[1])) {
            // Pattern like "C on a larger scale" - likely split from "14C on a larger scale"
            return false;
        }
    }

    // Filter out index entries (alphabetically sorted entries with page numbers)
    // Pattern: name/term followed by page numbers like "Smith, John 45-46, 89" or "Smith, John 123"
    if (/\b\d+[-–]\d+|\b\d+n\d+|\b\d+,\s*\d+|\s\d+$/.test(trimmed)) {
        // Contains page number patterns: "45-46", "123n4", "45, 67", or ends with " 123"
        return false;
    }

    // Filter out entries that start with single letter + parenthesis (likely index sub-entries)
    if (/^[A-Z]\)\s/.test(trimmed)) {
        // Pattern like "C) 178, 180–82"
        return false;
    }

    // Strong indicators (immediate detection)
    if (trimmed === trimmed.toUpperCase() ||    // "THE FATE OF PYRUVATE"
        /:$/.test(trimmed) ||                   // "Introduction:"
        /^\d+\.?\s+/.test(trimmed)) {           // "1. Chapter"
        return true;
    }

    // Main pattern: short phrase + next text starts with capital or number
    // This catches headings like "The fate of pyruvate", "Deep breathing", etc.
    return words.length <= 6 && nextText && /^[A-Z0-9]/.test(nextText.trim());
}

/**
 * Check if text ends with a common abbreviation
 * @param {string} text - Text to check
 * @returns {boolean} Whether text ends with abbreviation
 */
function endsWithAbbreviation(text) {
    const COMMON_ABBREVIATIONS = [
        'Ph.D', 'M.D', 'Ph.D.', 'M.D.', 'B.A', 'B.A.', 'M.A', 'M.A.',
        'B.S', 'B.S.', 'M.S', 'M.S.', 'U.S', 'U.S.', 'U.K', 'U.K.',
        'Dr', 'Dr.', 'Mr', 'Mr.', 'Mrs', 'Mrs.', 'Ms', 'Ms.',
        'Prof', 'Prof.', 'vs', 'vs.', 'etc', 'etc.', 'i.e', 'i.e.',
        'e.g', 'e.g.', 'Inc', 'Inc.', 'Co', 'Co.', 'Corp', 'Corp.',
        'Ltd', 'Ltd.', 'St', 'St.', 'Ave', 'Ave.', 'Blvd', 'Blvd.'
    ];

    const trimmed = text.trim();
    return COMMON_ABBREVIATIONS.some(abbrev =>
        trimmed.toLowerCase().endsWith(abbrev.toLowerCase())
    );
}

/**
 * Determine if two text chunks should be merged because they contain a split sentence
 * @param {string} firstText - First chunk text
 * @param {string} secondText - Second chunk text
 * @param {string} firstType - First chunk type (default: 'text')
 * @param {string} secondType - Second chunk type (default: 'text')
 * @returns {boolean} Whether chunks should be merged
 */
function shouldMergeSentence(firstText, secondText, firstType = 'text', secondType = 'text') {
    // Never merge headers
    if (firstType === 'header' || secondType === 'header') {
        return false;
    }

    const first = firstText.trim();
    const second = secondText.trim();

    if (first.length === 0 || second.length === 0) return false;

    // Don't merge if second text looks like a heading (with first text as context)
    if (isLikelyHeading(second, null, first)) {
        return false;
    }

    const lastChar = first.slice(-1);
    const firstChar = second.charAt(0);

    // Core logic: not sentence ending + lowercase start
    const notSentenceEnding = !/[.!?;:]$/.test(lastChar);
    const startsWithLowercase = /[a-z]/.test(firstChar);

    if (notSentenceEnding && startsWithLowercase) {
        return true;
    }

    // Enhancement: handle common abbreviations
    // If ends with period but might be abbreviation (like "U.S. government")
    if (lastChar === '.' && startsWithLowercase) {
        // Check if it's likely an abbreviation (short word before period)
        const beforePeriod = first.match(/\b(\w{1,3})\.$$/);
        if (beforePeriod && beforePeriod[1].length <= 3) {
            return true; // Likely abbreviation, merge
        }

        // Also check against our hardcoded list
        if (endsWithAbbreviation(first)) {
            return true;
        }
    }

    return false;
}

/**
 * Process and chunk text with paragraph structure preservation
 * @param {string} text - Raw text with line break markers
 * @param {number} minWords - Minimum words per chunk (default: 5)
 * @param {number} maxWords - Maximum words per chunk (default: 15)
 * @param {number} pageNumber - Page number for context
 * @returns {Array} Array of paragraph objects with nested chunks
 */
function chunkTextWithParagraphs(text, minWords = 5, maxWords = 15, pageNumber = 1) {
    if (!text || text.trim().length === 0) {
        return [];
    }

    // Debug for Introduction page
    if (text.includes('The structure') || text.includes('A cell is a city') || text.includes('inorganic') || text.includes('Yet at night')) {
        try {
            const fs = require('fs');
            const debugDir = './debug';
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir);
            }

            const debugInfo = [
                `DEBUGGING chunkTextWithParagraphs for page ${pageNumber}:`,
                `Full text length: ${text.length}`,
                `Contains line breaks: ${text.includes('⟨⟨LINE_BREAK⟩⟩')}`,
                `Number of line breaks: ${(text.match(/⟨⟨LINE_BREAK⟩⟩/g) || []).length}`,
                ''
            ];

            fs.appendFileSync('./debug/chunk-processing-debug.txt', debugInfo.join('\n') + '\n');
        } catch (error) {
            // Ignore write errors
        }
    }

    // TRUST the LINE_BREAK markers from our sophisticated indentation-based paragraph detection
    // Split by line breaks to get paragraphs (not individual lines)
    const paragraphTexts = text.split(' ⟨⟨LINE_BREAK⟩⟩ ').filter(para => para.trim().length > 0);

    // Debug the split paragraphs
    if (text.includes('The structure') || text.includes('A cell is a city') || text.includes('inorganic') || text.includes('Yet at night')) {
        try {
            const debugInfo = [
                `Paragraphs after splitting by LINE_BREAK (showing first 10):`,
                ...paragraphTexts.slice(0, 10).map((para, i) => `Paragraph ${i}: "${para.substring(0, 200)}${para.length > 200 ? '...' : ''}"`),
                '',
                'Looking for specific text:',
                ...paragraphTexts.map((para, i) => {
                    if (para.includes('inorganic') || para.includes('Yet at night') || para.includes('The structure') || para.includes('A cell is a city')) {
                        return `*** FOUND Paragraph ${i}: "${para}"`;
                    }
                    return null;
                }).filter(Boolean),
                ''
            ];

            fs.appendFileSync('./debug/chunk-processing-debug.txt', debugInfo.join('\n') + '\n');
        } catch (error) {
            // Ignore write errors
        }
    }

    const paragraphs = [];
    let globalChunkIndex = 0;
    let paragraphId = 0;

    // Process each paragraph separately
    for (let i = 0; i < paragraphTexts.length; i++) {
        const paragraphText = paragraphTexts[i].trim();

        if (paragraphText.length === 0) continue;

        // Check if this paragraph is a heading
        const isHeading = paragraphText.includes('⟨⟨HEADING⟩⟩');

        if (isHeading) {
            // Create header paragraph
            const headerText = paragraphText.replace(/⟨⟨HEADING⟩⟩(.*?)⟨⟨\/HEADING⟩⟩/g, '$1').trim();
            const headerChunks = createChunksFromText(headerText, 1, 50, globalChunkIndex); // Headers can be longer

            paragraphs.push({
                id: paragraphId++,
                pageNumber: pageNumber,
                type: 'header',
                level: determineHeaderLevel(headerText, paragraphText), // h1, h2, h3, etc.
                chunks: headerChunks
            });

            globalChunkIndex += headerChunks.length;
        } else {
            // Create text paragraph - each LINE_BREAK separated text is one paragraph
            const chunks = createChunksFromText(paragraphText, minWords, maxWords, globalChunkIndex);

            paragraphs.push({
                id: paragraphId++,
                pageNumber: pageNumber,
                type: 'text',
                chunks: chunks
            });

            globalChunkIndex += chunks.length;
        }
    }

    // Debug final result
    if (text.includes('inorganic') || text.includes('Yet at night')) {
        try {
            const debugInfo = [
                `Final paragraphs created: ${paragraphs.length}`,
                ...paragraphs.map((para, i) => {
                    const chunkTexts = para.chunks.map(c => c.text.substring(0, 100) + (c.text.length > 100 ? '...' : '')).join(' | ');
                    return `Paragraph ${i} (${para.type}): ${chunkTexts}`;
                }),
                ''
            ];

            fs.appendFileSync('./debug/chunk-processing-debug.txt', debugInfo.join('\n') + '\n');
        } catch (error) {
            // Ignore write errors
        }
    }

    return paragraphs;
}

/**
 * Determine header level based on text content and formatting
 * @param {string} headerText - Clean header text
 * @param {string} originalLine - Original line with formatting markers
 * @returns {number} Header level (1-6)
 */
function determineHeaderLevel(headerText, originalLine) {
    // For now, default to h2 for most headers
    // This could be enhanced to detect different header levels based on:
    // - Font size indicators in the original text
    // - Text patterns (Chapter vs Section vs Subsection)
    // - Hierarchical position in document

    // Basic pattern matching for common header types
    if (/^chapter\s+\d+/i.test(headerText)) {
        return 1; // Chapter headers are h1
    }

    if (/^\d+\.\d+/.test(headerText)) {
        return 3; // Numbered subsections are h3
    }

    return 2; // Most section headers are h2
}

/**
 * Create chunks from text while preserving sentence structure and respecting line breaks
 * @param {string} text - Text to chunk (may contain ⟨⟨LINE_BREAK⟩⟩ markers)
 * @param {number} minWords - Minimum words per chunk
 * @param {number} maxWords - Maximum words per chunk  
 * @param {number} startingGlobalIndex - Starting global chunk index
 * @returns {Array} Array of chunk objects
 */
function createChunksFromText(text, minWords, maxWords, startingGlobalIndex) {
    if (!text || text.trim().length === 0) {
        return [];
    }

    // Split by LINE_BREAK markers to get natural paragraph segments
    const segments = text.split(' ⟨⟨LINE_BREAK⟩⟩ ').filter(seg => seg.trim().length > 0);
    
    const chunks = [];
    let chunkIndex = 0;
    let currentChunk = '';
    let currentWords = [];

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex].trim();
        
        // Split segment into sentences
        const sentences = [];
        let currentSentence = '';
        const words = segment.split(/\s+/);

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            currentSentence += (currentSentence ? ' ' : '') + word;

            // Check if this word ends a sentence
            if (/[.!?]+$/.test(word)) {
                const nextWord = words[i + 1];
                const isAbbreviation = endsWithAbbreviation(currentSentence);
                const nextIsLowercase = nextWord && /^[a-z]/.test(nextWord);

                if (!isAbbreviation || !nextIsLowercase) {
                    sentences.push(currentSentence.trim());
                    currentSentence = '';
                }
            }
        }

        // Add any remaining text as a sentence
        if (currentSentence.trim()) {
            sentences.push(currentSentence.trim());
        }

        // Process sentences in this segment
        for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
            const sentence = sentences[sentenceIndex];
            const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 0);

            // Add sentence to current chunk
            if (currentChunk) currentChunk += ' ';
            currentChunk += sentence;
            currentWords = currentWords.concat(sentenceWords);

            // Check if we should create a chunk
            const isLastSentenceInSegment = sentenceIndex === sentences.length - 1;
            const isLastSegment = segmentIndex === segments.length - 1;
            const hasEnoughWords = currentWords.length >= minWords;

            // Create chunk if:
            // 1. We have enough words AND it's the end of a segment (natural paragraph break)
            // 2. OR we've reached maxWords
            // 3. OR it's the very last chunk
            if ((hasEnoughWords && isLastSentenceInSegment) || 
                currentWords.length >= maxWords || 
                (isLastSegment && sentenceIndex === sentences.length - 1)) {
                
                chunks.push({
                    index: startingGlobalIndex + chunkIndex,
                    text: currentChunk.trim(),
                    wordCount: currentWords.length,
                    type: 'text'
                });

                chunkIndex++;
                currentChunk = '';
                currentWords = [];
            }
        }
    }

    // Add any remaining text as final chunk
    if (currentChunk.trim()) {
        chunks.push({
            index: startingGlobalIndex + chunkIndex,
            text: currentChunk.trim(),
            wordCount: currentWords.length,
            type: 'text'
        });
    }

    return chunks;
}

/**
 * Smart merging logic for chunks: merge short chunks with neighboring chunks, but NEVER break sentences
 * @param {Array} chunks - Array of chunk objects
 * @param {number} minWords - Minimum words for a chunk to be considered complete (default: 8)
 * @returns {Array} Array of merged chunks
 */
function smartMergeChunks(chunks, minWords = 8) {
    if (chunks.length <= 1) return chunks;

    const result = [...chunks];
    
    // First pass: Fix obvious sentence splits
    for (let i = 0; i < result.length - 1; i++) {
        const currentChunk = result[i];
        const nextChunk = result[i + 1];
        
        if (hasBrokenSentenceBoundary(currentChunk.text, nextChunk.text)) {
            // Merge these chunks to fix the broken sentence
            currentChunk.text = currentChunk.text + ' ' + nextChunk.text;
            currentChunk.wordCount = currentChunk.wordCount + nextChunk.wordCount;
            result.splice(i + 1, 1);
            i--; // Recheck this position
        }
    }
    
    // Second pass: Merge short chunks if possible without breaking sentences
    let i = 0;
    while (i < result.length) {
        const currentChunk = result[i];
        const currentWords = currentChunk.wordCount;

        // If current chunk is too short, try to merge with neighbors
        if (currentWords < minWords) {
            const prevChunk = i > 0 ? result[i - 1] : null;
            const nextChunk = i < result.length - 1 ? result[i + 1] : null;

            const prevWords = prevChunk ? prevChunk.wordCount : Infinity;
            const nextWords = nextChunk ? nextChunk.wordCount : Infinity;

            // Try to merge with the shorter neighbor, but only if it won't break sentences
            if (prevChunk && prevWords <= nextWords && !hasBrokenSentenceBoundary(prevChunk.text, currentChunk.text)) {
                // Merge with previous
                prevChunk.text = prevChunk.text + ' ' + currentChunk.text;
                prevChunk.wordCount = prevWords + currentWords;
                result.splice(i, 1);
                i--; // Check the merged chunk again
            } else if (nextChunk && !hasBrokenSentenceBoundary(currentChunk.text, nextChunk.text)) {
                // Merge with next
                currentChunk.text = currentChunk.text + ' ' + nextChunk.text;
                currentChunk.wordCount = currentWords + nextWords;
                result.splice(i + 1, 1);
                // Don't increment i, check the merged chunk again
            } else {
                // Can't merge without breaking sentences, move on
                i++;
            }
        } else {
            i++;
        }
    }

    return result;
}

/**
 * Check if there's a broken sentence boundary between two chunks
 * @param {string} firstText - Text of the first chunk
 * @param {string} secondText - Text of the second chunk
 * @returns {boolean} True if there's a broken sentence boundary
 */
function hasBrokenSentenceBoundary(firstText, secondText) {
    if (!firstText || !secondText) return false;
    
    const firstTrimmed = firstText.trim();
    const secondTrimmed = secondText.trim();
    
    if (!firstTrimmed || !secondTrimmed) return false;
    
    // Get the last few words of first chunk and first few words of second chunk
    const firstWords = firstTrimmed.split(/\s+/);
    const secondWords = secondTrimmed.split(/\s+/);
    
    const lastWord = firstWords[firstWords.length - 1];
    const firstWordOfSecond = secondWords[0];
    const secondWordOfSecond = secondWords[1] || '';
    
    // Remove punctuation from last word for analysis
    const lastWordClean = lastWord.replace(/[.,!?;:()[\]{}'"]/g, '');
    
    // PATTERN 1: Subject + verb continuation (like "We" + "can")
    const subjects = /^(I|We|You|He|She|It|They|This|That|These|Those|There|Here)$/i;
    const verbStarters = /^(can|could|will|would|should|shall|may|might|must|do|does|did|have|has|had|are|is|was|were|am|be|been|being|go|goes|went|come|comes|came|see|sees|saw|get|gets|got|make|makes|made|take|takes|took|give|gives|gave|know|knows|knew|think|thinks|thought|feel|feels|felt|look|looks|looked|seem|seems|seemed|become|becomes|became|find|finds|found|want|wants|wanted|need|needs|needed|try|tries|tried|work|works|worked|live|lives|lived|use|uses|used|say|says|said|tell|tells|told|call|calls|called|ask|asks|asked|help|helps|helped|move|moves|moved|turn|turns|turned|keep|keeps|kept|let|lets|show|shows|showed|bring|brings|brought|put|puts|put|set|sets|start|starts|started|stop|stops|stopped|run|runs|ran|walk|walks|walked|stand|stands|stood|sit|sits|sat|play|plays|played|read|reads|read|write|writes|wrote|hear|hears|heard|listen|listens|listened|watch|watches|watched|remember|remembers|remembered|forget|forgets|forgot|learn|learns|learned|teach|teaches|taught|understand|understands|understood|believe|believes|believed|hope|hopes|hoped|expect|expects|expected|imagine|imagines|imagined|wonder|wonders|wondered|worry|worries|worried|care|cares|cared|love|loves|loved|like|likes|liked|hate|hates|hated|enjoy|enjoys|enjoyed|prefer|prefers|preferred|choose|chooses|chose|decide|decides|decided|agree|agrees|agreed|disagree|disagrees|disagreed|accept|accepts|accepted|refuse|refuses|refused|allow|allows|allowed|require|requires|required|suggest|suggests|suggested|recommend|recommends|recommended|consider|considers|considered|discuss|discusses|discussed|explain|explains|explained|describe|describes|described|mention|mentions|mentioned|note|notes|noted|notice|notices|noticed|observe|observes|observed|realize|realizes|realized|recognize|recognizes|recognized|admit|admits|admitted|deny|denies|denied|claim|claims|claimed|argue|argues|argued|insist|insists|insisted|propose|proposes|proposed|offer|offers|offered|promise|promises|promised|threaten|threatens|threatened|warn|warns|warned|advise|advises|advised|inform|informs|informed|announce|announces|announced|declare|declares|declared|state|states|stated|report|reports|reported|confirm|confirms|confirmed|reveal|reveals|revealed|discover|discovers|discovered|explore|explores|explored|investigate|investigates|investigated|examine|examines|examined|study|studies|studied|research|researches|researched|test|tests|tested|prove|proves|proved|demonstrate|demonstrates|demonstrated|show|shows|showed|indicate|indicates|indicated|suggest|suggests|suggested|imply|implies|implied|mean|means|meant|represent|represents|represented|symbolize|symbolizes|symbolized|reflect|reflects|reflected|express|expresses|expressed|communicate|communicates|communicated|share|shares|shared|exchange|exchanges|exchanged|trade|trades|traded|sell|sells|sold|buy|buys|bought|pay|pays|paid|cost|costs|spend|spends|spent|save|saves|saved|earn|earns|earned|win|wins|won|lose|loses|lost|gain|gains|gained|achieve|achieves|achieved|accomplish|accomplishes|accomplished|succeed|succeeds|succeeded|fail|fails|failed|manage|manages|managed|handle|handles|handled|deal|deals|dealt|face|faces|faced|meet|meets|met|encounter|encounters|encountered|experience|experiences|experienced|undergo|undergoes|underwent|suffer|suffers|suffered|endure|endures|endured|survive|survives|survived|exist|exists|existed|occur|occurs|occurred|happen|happens|happened|appear|appears|appeared|disappear|disappears|disappeared|arrive|arrives|arrived|leave|leaves|left|enter|enters|entered|exit|exits|exited|return|returns|returned|stay|stays|stayed|remain|remains|remained|continue|continues|continued|begin|begins|began|start|starts|started|finish|finishes|finished|end|ends|ended|complete|completes|completed|follow|follows|followed|lead|leads|led|guide|guides|guided|direct|directs|directed|control|controls|controlled|influence|influences|influenced|affect|affects|affected|impact|impacts|impacted|change|changes|changed|alter|alters|altered|modify|modifies|modified|improve|improves|improved|develop|develops|developed|create|creates|created|build|builds|built|construct|constructs|constructed|design|designs|designed|plan|plans|planned|organize|organizes|organized|arrange|arranges|arranged|prepare|prepares|prepared|establish|establishes|established|form|forms|formed|produce|produces|produced|generate|generates|generated|cause|causes|caused|result|results|resulted|lead|leads|led|contribute|contributes|contributed|provide|provides|provided|supply|supplies|supplied|deliver|delivers|delivered|serve|serves|served|support|supports|supported|assist|assists|assisted|aid|aids|aided|enable|enables|enabled|facilitate|facilitates|facilitated|encourage|encourages|encouraged|motivate|motivates|motivated|inspire|inspires|inspired|influence|influences|influenced|persuade|persuades|persuaded|convince|convinces|convinced|force|forces|forced|pressure|pressures|pressured|push|pushes|pushed|pull|pulls|pulled|drag|drags|dragged|carry|carries|carried|lift|lifts|lifted|raise|raises|raised|lower|lowers|lowered|drop|drops|dropped|throw|throws|threw|catch|catches|caught|hold|holds|held|grab|grabs|grabbed|release|releases|released|free|frees|freed|open|opens|opened|close|closes|closed|lock|locks|locked|unlock|unlocks|unlocked|connect|connects|connected|link|links|linked|join|joins|joined|attach|attaches|attached|separate|separates|separated|divide|divides|divided|split|splits|split|break|breaks|broke|crack|cracks|cracked|damage|damages|damaged|destroy|destroys|destroyed|repair|repairs|repaired|fix|fixes|fixed|restore|restores|restored|replace|replaces|replaced|remove|removes|removed|eliminate|eliminates|eliminated|reduce|reduces|reduced|increase|increases|increased|expand|expands|expanded|extend|extends|extended|stretch|stretches|stretched|grow|grows|grew|shrink|shrinks|shrank|contract|contracts|contracted|spread|spreads|spread|scatter|scatters|scattered|gather|gathers|gathered|collect|collects|collected|accumulate|accumulates|accumulated|store|stores|stored|keep|keeps|kept|maintain|maintains|maintained|preserve|preserves|preserved|protect|protects|protected|defend|defends|defended|guard|guards|guarded|secure|secures|secured|ensure|ensures|ensured|guarantee|guarantees|guaranteed|check|checks|checked|verify|verifies|verified|confirm|confirms|confirmed|validate|validates|validated|monitor|monitors|monitored|track|tracks|tracked|follow|follows|followed|trace|traces|traced|locate|locates|located|identify|identifies|identified|recognize|recognizes|recognized|distinguish|distinguishes|distinguished|differentiate|differentiates|differentiated|compare|compares|compared|contrast|contrasts|contrasted|match|matches|matched|fit|fits|fitted|suit|suits|suited|adapt|adapts|adapted|adjust|adjusts|adjusted|modify|modifies|modified|customize|customizes|customized|personalize|personalizes|personalized|specialize|specializes|specialized|focus|focuses|focused|concentrate|concentrates|concentrated|emphasize|emphasizes|emphasized|highlight|highlights|highlighted|stress|stresses|stressed|prioritize|prioritizes|prioritized|rank|ranks|ranked|rate|rates|rated|evaluate|evaluates|evaluated|assess|assesses|assessed|judge|judges|judged|measure|measures|measured|calculate|calculates|calculated|estimate|estimates|estimated|predict|predicts|predicted|forecast|forecasts|forecasted|project|projects|projected|plan|plans|planned|schedule|schedules|scheduled|organize|organizes|organized|coordinate|coordinates|coordinated|manage|manages|managed|supervise|supervises|supervised|oversee|oversees|oversaw|monitor|monitors|monitored|regulate|regulates|regulated|govern|governs|governed|rule|rules|ruled|command|commands|commanded|order|orders|ordered|instruct|instructs|instructed|direct|directs|directed|guide|guides|guided|teach|teaches|taught|train|trains|trained|educate|educates|educated|inform|informs|informed|advise|advises|advised|counsel|counsels|counseled|consult|consults|consulted|recommend|recommends|recommended|suggest|suggests|suggested|propose|proposes|proposed|request|requests|requested|ask|asks|asked|demand|demands|demanded|require|requires|required|need|needs|needed|want|wants|wanted|desire|desires|desired|wish|wishes|wished|hope|hopes|hoped|expect|expects|expected|anticipate|anticipates|anticipated|await|awaits|awaited|wait|waits|waited|depend|depends|depended|rely|relies|relied|trust|trusts|trusted|believe|believes|believed|doubt|doubts|doubted|question|questions|questioned|challenge|challenges|challenged|oppose|opposes|opposed|resist|resists|resisted|fight|fights|fought|struggle|struggles|struggled|compete|competes|competed|contest|contests|contested|argue|argues|argued|debate|debates|debated|discuss|discusses|discussed|negotiate|negotiates|negotiated|bargain|bargains|bargained|compromise|compromises|compromised|settle|settles|settled|resolve|resolves|resolved|solve|solves|solved|address|addresses|addressed|tackle|tackles|tackled|approach|approaches|approached|handle|handles|handled|manage|manages|managed|cope|copes|coped|deal|deals|dealt|process|processes|processed|treat|treats|treated|respond|responds|responded|react|reacts|reacted|answer|answers|answered|reply|replies|replied|acknowledge|acknowledges|acknowledged|recognize|recognizes|recognized|accept|accepts|accepted|approve|approves|approved|endorse|endorses|endorsed|support|supports|supported|back|backs|backed|favor|favors|favored|prefer|prefers|preferred|choose|chooses|chose|select|selects|selected|pick|picks|picked|opt|opts|opted|decide|decides|decided|determine|determines|determined|conclude|concludes|concluded|resolve|resolves|resolved|settle|settles|settled|finalize|finalizes|finalized|complete|completes|completed|finish|finishes|finished|end|ends|ended|stop|stops|stopped|cease|ceases|ceased|quit|quits|quit|abandon|abandons|abandoned|give|gives|gave|surrender|surrenders|surrendered|yield|yields|yielded|submit|submits|submitted|comply|complies|complied|conform|conforms|conformed|obey|obeys|obeyed|follow|follows|followed|adhere|adheres|adhered|stick|sticks|stuck|keep|keeps|kept|maintain|maintains|maintained|uphold|upholds|upheld|preserve|preserves|preserved|retain|retains|retained|save|saves|saved|rescue|rescues|rescued|recover|recovers|recovered|retrieve|retrieves|retrieved|regain|regains|regained|restore|restores|restored|return|returns|returned|bring|brings|brought|fetch|fetches|fetched|get|gets|got|obtain|obtains|obtained|acquire|acquires|acquired|gain|gains|gained|receive|receives|received|accept|accepts|accepted|take|takes|took|capture|captures|captured|seize|seizes|seized|grab|grabs|grabbed|snatch|snatches|snatched|steal|steals|stole|rob|robs|robbed|cheat|cheats|cheated|trick|tricks|tricked|deceive|deceives|deceived|fool|fools|fooled|mislead|misleads|misled|lie|lies|lied|hide|hides|hid|conceal|conceals|concealed|cover|covers|covered|mask|masks|masked|disguise|disguises|disguised|pretend|pretends|pretended|fake|fakes|faked|imitate|imitates|imitated|copy|copies|copied|mimic|mimics|mimicked|reproduce|reproduces|reproduced|repeat|repeats|repeated|duplicate|duplicates|duplicated|replicate|replicates|replicated|clone|clones|cloned|mirror|mirrors|mirrored|reflect|reflects|reflected|echo|echoes|echoed|resemble|resembles|resembled|look|looks|looked|appear|appears|appeared|seem|seems|seemed|sound|sounds|sounded|feel|feels|felt|taste|tastes|tasted|smell|smells|smelled|touch|touches|touched|sense|senses|sensed|perceive|perceives|perceived|notice|notices|noticed|observe|observes|observed|spot|spots|spotted|detect|detects|detected|discover|discovers|discovered|find|finds|found|locate|locates|located|uncover|uncovers|uncovered|reveal|reveals|revealed|expose|exposes|exposed|show|shows|showed|display|displays|displayed|exhibit|exhibits|exhibited|present|presents|presented|demonstrate|demonstrates|demonstrated|illustrate|illustrates|illustrated|depict|depicts|depicted|portray|portrays|portrayed|represent|represents|represented|symbolize|symbolizes|symbolized|signify|signifies|signified|indicate|indicates|indicated|point|points|pointed|direct|directs|directed|aim|aims|aimed|target|targets|targeted|focus|focuses|focused|concentrate|concentrates|concentrated|center|centers|centered)$/i;
    
    if (subjects.test(lastWordClean) && verbStarters.test(firstWordOfSecond)) {
        return true;
    }
    
    // PATTERN 2: Obvious sentence fragments ending first chunk
    const sentenceStarters = /^(In|On|At|The|A|An|This|That|But|And|Yet|For|So|Because|Since|When|Where|What|How|Why|Who|Which|As|If|Unless|Although|While|Before|After|During|Through|Between|Among|Within|Without|Beyond|Behind|Beneath|Above|Below|Beside|Around|Across|Along|Against|Toward|Towards|Despite|Except|Including|Regarding|Concerning|According|Due|Thanks|Owing|Relating|Referring|Compared|Relative|Similar|Different|Contrary|Opposed|Addition|Response|Reaction|Relation|Respect|Regard|Reference|Contrast|Comparison|Many|Most|Some|Few|Several|All|Each|Every|Both|Either|Neither|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|First|Second|Third|Last|Next|Another|Other|Same|Different|New|Old|Young|Small|Large|Big|Little|Great|Good|Bad|Best|Worst|Better|Worse|High|Low|Long|Short|Wide|Narrow|Deep|Shallow|Fast|Slow|Quick|Early|Late|Soon|Now|Then|Here|There|Everywhere|Somewhere|Nowhere|Anywhere|Today|Tomorrow|Yesterday|Always|Never|Sometimes|Often|Usually|Rarely|Seldom|Frequently|Occasionally|Recently|Currently|Previously|Finally|Eventually|Immediately|Suddenly|Gradually|Slowly|Quickly|Carefully|Easily|Hardly|Nearly|Almost|Quite|Very|Really|Extremely|Completely|Totally|Partly|Partially|Mostly|Generally|Specifically|Particularly|Especially|Obviously|Clearly|Certainly|Definitely|Probably|Possibly|Maybe|Perhaps|However|Nevertheless|Nonetheless|Furthermore|Moreover|Additionally|Besides|Also|Too|Either|Neither|Instead|Otherwise|Therefore|Thus|Hence|Consequently|Accordingly|Similarly|Likewise|Meanwhile|Meanwhile|Furthermore|Moreover|Additionally|Besides|Also|Too|Either|Neither|Instead|Otherwise|Therefore|Thus|Hence|Consequently|Accordingly|Similarly|Likewise|Meanwhile)$/i;
    const startsWithLowercase = /^[a-z]/.test(firstWordOfSecond);
    
    if (sentenceStarters.test(lastWordClean) && startsWithLowercase) {
        return true;
    }
    
    // PATTERN 3: Incomplete phrases ending first chunk
    const incompleteEndings = /\b(of|to|in|on|at|by|for|with|from|into|onto|upon|beneath|above|below|behind|beside|between|among|through|during|before|after|since|until|about|around|across|along|against|toward|towards|beyond|within|without|despite|except|including|regarding|concerning|according|due|thanks|owing|relating|referring|compared|relative|similar|different|contrary|opposed|addition|response|reaction|relation|respect|regard|reference|contrast|comparison|such|like|unlike|as|than|more|less|most|least|better|worse|rather|instead|other|another|same|different|various|several|many|few|some|all|each|every|both|either|neither|not|never|always|sometimes|often|usually|rarely|seldom|frequently|occasionally|generally|specifically|particularly|especially|mainly|mostly|partly|completely|totally|entirely|fully|quite|very|really|extremely|highly|deeply|strongly|clearly|obviously|certainly|definitely|probably|possibly|maybe|perhaps|actually|really|truly|indeed|surely|definitely|absolutely|completely|totally|entirely|fully|quite|rather|somewhat|slightly|barely|hardly|scarcely|nearly|almost|just|only|even|still|yet|already|soon|now|then|here|there|where|when|while|since|until|before|after|during|through|throughout|within|without|beyond|behind|beneath|above|below|beside|around|across|along|against|toward|towards|despite|except|including|regarding|concerning|according|due|thanks|owing|relating|referring|compared|relative|similar|different|contrary|opposed|addition|response|reaction|relation|respect|regard|reference|contrast|comparison)$/i.test(firstTrimmed);
    
    if (incompleteEndings && startsWithLowercase) {
        return true;
    }
    
    // PATTERN 4: Check if first chunk doesn't end with sentence punctuation and second starts lowercase
    const endsWithoutPunctuation = !/[.!?]$/.test(firstTrimmed);
    if (endsWithoutPunctuation && startsWithLowercase) {
        // Additional check: make sure it's not just a natural paragraph break
        // If the last word is a complete word and the first word of second chunk is also complete,
        // and they could form a continuing sentence, then it's likely a broken sentence
        const couldBeContinuation = !/^[A-Z]/.test(firstWordOfSecond) && 
                                   firstWordOfSecond.length > 1 && 
                                   !['the', 'and', 'or', 'but', 'so', 'yet', 'for', 'nor'].includes(firstWordOfSecond.toLowerCase());
        
        if (couldBeContinuation) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if text starts with a clear sentence beginning
 * @param {string} text - Text to check
 * @returns {boolean} True if text starts with a sentence beginning
 */
function startsWithSentenceBeginning(text) {
    if (!text || text.trim().length === 0) return false;
    
    const trimmed = text.trim();
    
    // Check if starts with capital letter (indicating sentence start)
    if (/^[A-Z]/.test(trimmed)) return true;
    
    // Check if starts with common sentence starters
    const sentenceStarters = /^(In|On|At|The|A|An|This|That|These|Those|We|I|You|He|She|It|They|But|And|Or|So|Yet|For|Because|Since|When|Where|What|How|Why|Who|Which)/;
    return sentenceStarters.test(trimmed);
}

/**
 * Check if text ends with a clear sentence ending
 * @param {string} text - Text to check
 * @returns {boolean} True if text ends with a sentence ending
 */
function endsWithSentenceEnding(text) {
    if (!text || text.trim().length === 0) return false;
    
    const trimmed = text.trim();
    
    // Check if ends with sentence punctuation
    return /[.!?]+$/.test(trimmed);
}

module.exports = {
    chunkText,
    cleanPageNumbers,
    cleanChapterHeading,
    fixSpacedFirstLetter,
    normalizeText,
    fuzzyMatch,
    combineTextItemsPreservingStructure,
    preserveHeadingsInPageText,
    isLikelyHeading,
    endsWithAbbreviation,
    shouldMergeSentence,
    chunkTextWithParagraphs,
    determineHeaderLevel,
    createChunksFromText
}; 