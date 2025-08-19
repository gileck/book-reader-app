/**
 * Validation functions for Step 2-1: Chapter Detection
 */

/**
 * Validate if a line is a proper chapter start
 * @param {string} line - Line to validate
 * @param {Array} lines - All lines in the document
 * @param {number} lineIndex - Index of the current line
 * @param {number} pageNumber - Page number where the line appears
 * @param {string} chapterTitle - Chapter title extracted from the line
 * @returns {boolean} - True if valid chapter start
 */
function validateChapterStart(line, lines, lineIndex, pageNumber, chapterTitle) {
    // Don't accept matches in very early pages (TOC area)
    if (pageNumber < 7) {
        return false;
    }
    
    // Check if this is explicitly in a Contents/TOC section by looking for TOC patterns
    const surroundingLines = lines.slice(Math.max(0, lineIndex - 3), lineIndex + 3).join(' ').toLowerCase();
    if (surroundingLines.includes('contents') && surroundingLines.match(/\d+\s*$/)) {
        // Line ends with page numbers, likely TOC
        return false;
    }
    
    // Look for chapter content following the title
    const followingLines = lines.slice(lineIndex + 1, lineIndex + 8);
    const followingText = followingLines.filter(l => l.trim().length > 0).join(' ');
    
    // Must have some content following
    if (followingText.length < 50) {
        return false;
    }
    
    // Should not be followed immediately by numbered list (suggests TOC)
    const nextNonEmptyLine = followingLines.find(l => l.trim().length > 0);
    if (nextNonEmptyLine && nextNonEmptyLine.match(/^\d+\.\s+[A-Z]/)) {
        return false;
    }
    
    // Good indicators of a real chapter header:
    
    // All caps formatting suggests a real header
    if (line === line.toUpperCase() && line.length > 5) {
        return true;
    }
    
    // Standalone line (surrounded by empty lines) suggests header
    const prevLine = lineIndex > 0 ? lines[lineIndex - 1].trim() : '';
    const nextLine = lineIndex < lines.length - 1 ? lines[lineIndex + 1].trim() : '';
    if (prevLine === '' && nextLine === '') {
        return true;
    }
    
    return true;
}

/**
 * Validate and filter chapter sequence for reasonable continuity
 * @param {Array} potentialChapters - Array of potential chapter objects
 * @returns {Array} - Validated chapters with reasonable sequence
 */
function validateChapterSequence(potentialChapters) {
    // Sort by chapter number
    const sorted = potentialChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    // Keep chapters with reasonable sequence
    const validated = [];
    let expectedNumber = 1;
    
    for (const chapter of sorted) {
        if (chapter.chapterNumber <= expectedNumber + 2) {
            validated.push(chapter);
            expectedNumber = chapter.chapterNumber + 1;
        }
    }
    
    return validated;
}

/**
 * Validate chapter detection results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    const chapters = output.chapterMetadata;
    
    // 1. chapters array must have more than 1 chapter
    if (!chapters || chapters.length <= 1) {
        console.error(`❌ Chapter validation failed: Chapters array must have more than 1 chapter. Found: ${chapters?.length || 0}`);
        return false;
    }

    // Validate each chapter
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        
        // Check required chapter fields
        if (!chapter.title || chapter.chapterNumber === undefined || chapter.chapterNumber === null) {
            console.error(`❌ Chapter validation failed: Chapter ${i + 1} missing required fields (title: "${chapter.title}", chapterNumber: ${chapter.chapterNumber})`);
            return false;
        }
        
        // Check that startingPage is a valid number
        if (chapter.startingPage === undefined || chapter.startingPage === null || isNaN(chapter.startingPage)) {
            console.error(`❌ Chapter validation failed: Chapter ${i + 1} "${chapter.title}": startingPage must be a valid number (found: ${chapter.startingPage})`);
            return false;
        }
    }
    
    // 2. Check for duplicate chapter numbers
    const chapterNumbers = chapters.map(c => c.chapterNumber);
    const duplicates = chapterNumbers.filter((num, index) => chapterNumbers.indexOf(num) !== index);
    if (duplicates.length > 0) {
        const duplicateNumbers = [...new Set(duplicates)];
        const duplicateChapters = duplicateNumbers.map(num => {
            const chaptersWithNum = chapters.filter(c => c.chapterNumber === num);
            return `Chapter ${num}: ${chaptersWithNum.map(c => `"${c.title}"`).join(', ')}`;
        });
        console.error(`❌ Chapter validation failed: Duplicate chapter numbers found:\n${duplicateChapters.map(msg => `  - ${msg}`).join('\n')}`);
        return false;
    }
    
    // 3. Check for gaps in chapter numbering (should be 0,1,2,3,... with no gaps)
    const sortedNumbers = [...chapterNumbers].sort((a, b) => a - b);
    const expectedSequence = Array.from({length: sortedNumbers.length}, (_, i) => i);
    
    // Check if the sequence matches 0,1,2,3,...
    for (let i = 0; i < expectedSequence.length; i++) {
        if (sortedNumbers[i] !== expectedSequence[i]) {
            const missing = expectedSequence.filter(num => !sortedNumbers.includes(num));
            const unexpected = sortedNumbers.filter(num => !expectedSequence.includes(num));
            
            let errorMsg = `❌ Chapter validation failed: Chapter numbering sequence is incorrect.\n`;
            errorMsg += `  Expected: ${expectedSequence.join(', ')}\n`;
            errorMsg += `  Found: ${sortedNumbers.join(', ')}`;
            
            if (missing.length > 0) {
                errorMsg += `\n  Missing chapter numbers: ${missing.join(', ')}`;
            }
            if (unexpected.length > 0) {
                errorMsg += `\n  Unexpected chapter numbers: ${unexpected.join(', ')}`;
            }
            
            console.error(errorMsg);
            return false;
        }
    }
    
    return true;
}

module.exports = {
    validate,
    validateChapterStart,
    validateChapterSequence
}; 