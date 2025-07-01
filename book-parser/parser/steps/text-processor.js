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
function combineTextItemsPreservingStructure(textItems) {
    if (!textItems || textItems.length === 0) return '';

    const lines = [];
    let currentLine = [];
    let lastY = null;
    let lastLineStartX = null;
    const allItemsDebug = [];

    // Group text items by approximate Y position (line)
    for (const item of textItems) {
        const y = Math.round(item.transform[5]); // Y coordinate
        const x = Math.round(item.transform[4]); // X coordinate

        // Debug ALL items around our problematic text
        if (item.str.includes('structure') || item.str.includes('cell') || item.str.includes('building') || 
            item.str.includes('inorganic') || item.str.includes('spreading') || item.str.includes('Yet at night')) {
            allItemsDebug.push(`"${item.str}" | Y: ${y} | X: ${x} | LastY: ${lastY} | YDiff: ${lastY ? Math.abs(y - lastY) : 'N/A'} | WillBreak: ${lastY !== null && Math.abs(y - lastY) > 5}`);
        }

        // If this is a new line (Y coordinate changed significantly)
        if (lastY !== null && Math.abs(y - lastY) > 5) {
            if (currentLine.length > 0) {
                const lineText = currentLine.join(' ').trim();
                lines.push({
                    text: lineText,
                    startX: lastLineStartX,
                    y: lastY
                });
                currentLine = [];
            }
            lastLineStartX = x; // Record the X position of the first item on this new line
        }

        if (item.str.trim()) {
            currentLine.push(item.str);
            // If this is the first item on the line, record its X position
            if (currentLine.length === 1) {
                lastLineStartX = x;
            }
        }
        lastY = y;
    }

    // Add the last line
    if (currentLine.length > 0) {
        const lineText = currentLine.join(' ').trim();
        lines.push({
            text: lineText,
            startX: lastLineStartX,
            y: lastY
        });
    }

    // Now intelligently combine lines based on indentation and sentence structure
    const paragraphs = [];
    let currentParagraph = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];
        
        // Add current line to paragraph
        if (currentParagraph.length > 0) {
            currentParagraph += ' ';
        }
        currentParagraph += line.text;
        
        // Decide whether to end the paragraph here
        let shouldEndParagraph = false;
        
        if (!nextLine) {
            // Last line - always end paragraph
            shouldEndParagraph = true;
        } else {
            // Check if next line starts a new paragraph based on:
            // 1. Significant indentation difference (indicating new paragraph)
            // 2. Current line ends with sentence-ending punctuation AND next line starts with capital letter
            
            const indentationDiff = Math.abs(nextLine.startX - line.startX);
            const hasSignificantIndent = indentationDiff > 10; // Adjust threshold as needed
            
            const currentEndsWithPunctuation = /[.!?]$/.test(line.text.trim());
            const nextStartsWithCapital = /^[A-Z]/.test(nextLine.text.trim());
            
            // End paragraph if:
            // - Next line has significant indentation change, OR
            // - Current line ends properly AND next line starts with capital (strong paragraph indicator)
            shouldEndParagraph = hasSignificantIndent || (currentEndsWithPunctuation && nextStartsWithCapital);
        }
        
        if (shouldEndParagraph) {
            paragraphs.push(currentParagraph.trim());
            currentParagraph = '';
        }
    }

    // Write comprehensive debug info
    try {
        // Make sure the debug directory exists
        const debugDir = './debug';
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir);
        }
        
        // Write all text items debug
        if (allItemsDebug.length > 0) {
            fs.writeFileSync('./debug/text-items-debug.txt', allItemsDebug.join('\n'));
        }
        
        // Write paragraph analysis debug
        const paragraphDebug = [];
        paragraphDebug.push('PARAGRAPH ANALYSIS:');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nextLine = lines[i + 1];
            
            if (line.text.includes('inorganic') || line.text.includes('Yet at night') || 
                line.text.includes('structure') || line.text.includes('cell')) {
                
                const indentDiff = nextLine ? Math.abs(nextLine.startX - line.startX) : 0;
                paragraphDebug.push(`Line ${i}: "${line.text}"`);
                paragraphDebug.push(`  StartX: ${line.startX}, Y: ${line.y}`);
                if (nextLine) {
                    paragraphDebug.push(`  NextStartX: ${nextLine.startX}, IndentDiff: ${indentDiff}`);
                    paragraphDebug.push(`  ShouldBreak: ${indentDiff > 10 || (/[.!?]$/.test(line.text.trim()) && /^[A-Z]/.test(nextLine.text.trim()))}`);
                }
                paragraphDebug.push('');
            }
        }
        
        if (paragraphDebug.length > 1) {
            fs.writeFileSync('./debug/paragraph-detection-debug.txt', paragraphDebug.join('\n'));
        }
        
    } catch (error) {
        // Ignore write errors
    }

    // Join paragraphs with line break markers
    return paragraphs.join(' ⟨⟨LINE_BREAK⟩⟩ ').trim();
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
 * Create chunks from text while preserving sentence structure
 * @param {string} text - Text to chunk
 * @param {number} minWords - Minimum words per chunk
 * @param {number} maxWords - Maximum words per chunk  
 * @param {number} startingGlobalIndex - Starting global chunk index
 * @returns {Array} Array of chunk objects
 */
function createChunksFromText(text, minWords, maxWords, startingGlobalIndex) {
    if (!text || text.trim().length === 0) {
        return [];
    }

    // Use existing sentence splitting logic but adapted for paragraph context
    const sentences = [];
    let currentSentence = '';
    const words = text.trim().split(/\s+/);

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        currentSentence += (currentSentence ? ' ' : '') + word;

        // Check if this word ends a sentence
        if (/[.!?]+$/.test(word)) {
            const nextWord = words[i + 1];
            const isAbbreviation = endsWithAbbreviation(currentSentence);
            const nextIsLowercase = nextWord && /^[a-z]/.test(nextWord);
            
            // Check if the next word is a footnote reference
            const nextIsFootnote = nextWord && /^[0-9a-zA-Z\*\†\‡\§\¶]{1,3}$/.test(nextWord);

            if (!isAbbreviation || !nextIsLowercase) {
                if (nextIsFootnote) {
                    // Include the footnote with the current sentence, then split
                    currentSentence += ' ' + nextWord;
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

    // Group sentences into chunks
    const chunks = [];
    let currentChunk = '';
    let currentWords = [];
    let chunkId = 0;

    for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).filter(w => w.length > 0);

        // If adding this sentence would exceed maxWords, finalize current chunk
        if (currentWords.length > 0 && currentWords.length + sentenceWords.length > maxWords) {
            chunks.push({
                id: chunkId++,
                text: currentChunk.trim(),
                globalIndex: startingGlobalIndex + chunks.length,
                wordCount: currentWords.length,
                links: []
            });
            currentChunk = '';
            currentWords = [];
        }

        // Add sentence to current chunk
        if (currentChunk.length > 0) {
            currentChunk += ' ';
        }
        currentChunk += sentence;
        currentWords.push(...sentenceWords);

        // If we have enough words, create a chunk
        if (currentWords.length >= minWords) {
            chunks.push({
                id: chunkId++,
                text: currentChunk.trim(),
                globalIndex: startingGlobalIndex + chunks.length,
                wordCount: currentWords.length,
                links: []
            });
            currentChunk = '';
            currentWords = [];
        }
    }

    // Add any remaining text as final chunk
    if (currentChunk.trim().length > 0) {
        chunks.push({
            id: chunkId++,
            text: currentChunk.trim(),
            globalIndex: startingGlobalIndex + chunks.length,
            wordCount: currentWords.length,
            links: []
        });
    }

    return chunks;
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