#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// POC-2: Chapter Detection
// Goal: Identify chapter boundaries and structure before paragraph detection

const PDF_PATH = path.join(__dirname, '../../book.pdf');
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('=== POC-2: Chapter Detection ===');
console.log(`Testing PDF: ${PDF_PATH}`);
console.log(`Output directory: ${OUTPUT_DIR}`);

// Test results container
const results = {
    pdfPath: PDF_PATH,
    algorithms: [],
    testDate: new Date().toISOString(),
    conclusions: []
};

// Extract PDF text (reusing POC-1 approach)
async function loadReconstructedText() {
    console.log('\n--- Loading reconstructed text from POC-4 ---');

    try {
        const textPath = path.join(__dirname, '../poc-4-cross-page-reconstruction/output/reconstructed-text.txt');
        if (!fs.existsSync(textPath)) {
            throw new Error(`Reconstructed text file not found: ${textPath}. Run POC-4 first.`);
        }

        const text = fs.readFileSync(textPath, 'utf8');

        console.log(`✓ Text loaded: ${text.length} characters`);
        console.log(`✓ Using cross-page reconstructed sentences`);

        // Extract page count from [PAGE n] markers
        const pageMarkers = text.match(/\[PAGE \d+\]/g) || [];
        const pageCount = pageMarkers.length;

        return {
            text: text,
            pageCount: pageCount,
            metadata: { source: 'POC-4 reconstructed text' }
        };
    } catch (error) {
        console.error('✗ Reconstructed text loading failed:', error.message);
        process.exit(1);
    }
}

// Algorithm 1: Pattern-Based Chapter Detection (Enhanced with v1 insights)
function detectChaptersPattern(text) {
    console.log('\n--- Algorithm 1: Pattern-Based Detection (Enhanced) ---');

    const lines = text.split('\n');
    const chapters = [];
    const patterns = [
        // v1-inspired patterns (more precise)
        /^Chapter\s+(\d+)(?:\s*[:\-\s]\s*(.*))?$/i,
        /^Chapter\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty)[:]\s*(.+)$/i,

        // Numbered patterns with context validation
        /^(\d+)\.?\s+(.+)$/,  // "1. Introduction" or "1 Introduction" - needs validation

        // Special sections
        /^(Introduction|Conclusion|Epilogue|Index|Bibliography|References)(?:\s*[:\-\s]\s*(.*))?$/i,
        /^(Appendix\s+[A-Z0-9]+)(?:\s*[:\-\s]\s*(.*))?$/i,

        // Structural headers (ALL CAPS, but with length limits)
        /^[A-Z\s]{10,50}$/
    ];

    let potentialChapters = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                potentialChapters.push({
                    lineNumber: i + 1,
                    text: line,
                    pattern: pattern.toString(),
                    match: match,
                    chapterNumber: extractChapterNumber(match),
                    title: extractChapterTitle(match, line),
                    confidence: calculatePatternConfidence(line, pattern, lines, i)
                });
                break;
            }
        }
    }

    // Filter and validate chapters
    const validatedChapters = validateChapterSequence(potentialChapters);

    console.log(`✓ Found ${potentialChapters.length} potential chapters`);
    console.log(`✓ Validated ${validatedChapters.length} chapters`);

    return {
        name: 'Pattern-Based',
        potentialChapters,
        validatedChapters,
        chapterCount: validatedChapters.length
    };
}

// Algorithm 2: Table of Contents Analysis (Based on v1 implementation)
function analyzeTableOfContents(text) {
    console.log('\n--- Algorithm 2: Table of Contents Analysis (v1-based) ---');

    const lines = text.split('\n');
    let tocStart = -1;
    let tocEnd = -1;

    // Find table of contents (more flexible search)
    const tocSearchTerms = ['contents', 'table of contents'];
    for (let i = 0; i < Math.min(150, lines.length); i++) {
        const line = lines[i].trim().toLowerCase();
        if (tocSearchTerms.some(term => line.includes(term)) && line.length < 30) {
            tocStart = i;
            break;
        }
    }

    if (tocStart !== -1) {
        // Find end of TOC by looking for content start or page limit
        for (let i = tocStart + 1; i < Math.min(tocStart + 100, lines.length); i++) {
            const line = lines[i].trim().toLowerCase();
            // Look for content starting after TOC
            if ((line.includes('introduction') || line.includes('chapter') || line.includes('preface')) &&
                line.length > 30) { // Actual content, not TOC entry
                tocEnd = i;
                break;
            }
        }

        // If no clear end found, limit to reasonable TOC size
        if (tocEnd === -1) {
            tocEnd = Math.min(tocStart + 50, lines.length);
        }
    }

    let tocEntries = [];

    if (tocStart !== -1 && tocEnd !== -1) {
        console.log(`✓ Found TOC from line ${tocStart + 1} to ${tocEnd + 1}`);

        for (let i = tocStart + 1; i < tocEnd; i++) {
            const line = lines[i].trim();
            const tocEntry = parseTOCLine(line);
            if (tocEntry) {
                tocEntry.lineNumber = i + 1;
                tocEntries.push(tocEntry);
            }
        }
    }

    console.log(`✓ Found ${tocEntries.length} TOC entries`);

    return {
        name: 'Table of Contents (v1-based)',
        tocStart,
        tocEnd,
        tocEntries,
        chapterCount: tocEntries.length
    };
}

// Parse a single TOC line (based on v1 implementation)
function parseTOCLine(text) {
    // Skip common non-TOC text
    const skipPatterns = [
        /^contents?$/i,
        /^table of contents$/i,
        /^page$/i,
        /^chapter$/i
    ];

    if (skipPatterns.some(pattern => pattern.test(text.trim()))) {
        return null;
    }

    // Enhanced TOC patterns (v1 + simple formats)
    const patterns = [
        // v1 patterns with page numbers
        /^(\d+)\.?\s+(.+?)\s+(\d+)$/,
        /^(Introduction[:\s]*.*?)\s+([ivx]+|\d+)$/i,
        /^(Appendix\s+[A-Z][:\s]*.*?)\s+(\d+)$/i,
        /^([A-Za-z\s]+)\s+(\d+)$/,

        // Simple patterns without page numbers (this book's format)
        /^(\d+)\.\s+(.+)$/, // "1. Title"
        /^(Introduction[:\s]*.*)$/i, // "Introduction: Title"
        /^(Epilogue[:\s]*.*)$/i, // "Epilogue: Title"
        /^(Appendix\s+\d+[:\s]*.*)$/i, // "Appendix 1: Title"
        /^(The\s+.+)$/ // "The forward Krebs cycle"
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const titlePart = match[1].trim();
            const pagePart = match[2]; // May be undefined for simple patterns

            // Parse chapter number and title
            let chapterNumber = null;
            let chapterTitle = titlePart;

            // Handle different pattern types
            if (pattern.toString().includes('^(\\d+)\\.\\s+(.+)$')) {
                // Simple numbered pattern: "1. Title" - use second capture group
                chapterNumber = parseInt(titlePart);
                chapterTitle = pagePart || titlePart; // pagePart is actually title in this pattern
            } else {
                // Extract chapter number if it's a numbered chapter
                const numberedMatch = titlePart.match(/^(\d+)\.?\s*(.*)$/);
                if (numberedMatch) {
                    chapterNumber = parseInt(numberedMatch[1]);
                    chapterTitle = numberedMatch[2].trim() || titlePart;
                }
            }

            if (titlePart.toLowerCase().includes('introduction')) {
                chapterNumber = 0;
                chapterTitle = titlePart;
            } else if (titlePart.toLowerCase().includes('epilogue')) {
                chapterNumber = 'Epilogue';
                chapterTitle = titlePart;
            } else if (titlePart.toLowerCase().includes('appendix')) {
                const appendixMatch = titlePart.match(/appendix\s+([A-Z0-9]+)/i);
                if (appendixMatch) {
                    chapterNumber = `Appendix ${appendixMatch[1]}`;
                }
                chapterTitle = titlePart;
            }

            return {
                chapterNumber: chapterNumber,
                chapterTitle: chapterTitle || titlePart,
                startingPage: pagePart ? (isNaN(parseInt(pagePart)) ? pagePart : parseInt(pagePart)) : null,
                originalText: text,
                pattern: pattern.toString()
            };
        }
    }

    return null;
}

// Algorithm 3: Content Structure Analysis
function analyzeContentStructure(text) {
    console.log('\n--- Algorithm 3: Content Structure Analysis ---');

    const lines = text.split('\n');
    const pageBreaks = [];
    const majorSections = [];

    // Find page indicators and structural breaks
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for page numbers or page breaks
        if (/^\d+$/.test(line) && line.length <= 3) {
            pageBreaks.push({
                lineNumber: i + 1,
                pageNumber: parseInt(line),
                context: getContextLines(lines, i, 3)
            });
        }

        // Look for major structural elements
        if (line.length > 0 && line.length < 50) {
            const confidence = calculateStructuralConfidence(line, lines, i);
            if (confidence > 0.6) {
                majorSections.push({
                    lineNumber: i + 1,
                    text: line,
                    confidence,
                    context: getContextLines(lines, i, 2)
                });
            }
        }
    }

    console.log(`✓ Found ${pageBreaks.length} potential page breaks`);
    console.log(`✓ Found ${majorSections.length} major sections`);

    return {
        name: 'Content Structure',
        pageBreaks,
        majorSections,
        chapterCount: majorSections.filter(s => s.confidence > 0.8).length
    };
}

// Helper functions

function extractChapterNumber(match) {
    if (!match) return null;

    const numberWords = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12
    };

    // Check for numeric
    for (let i = 1; i < match.length; i++) {
        if (match[i] && /^\d+$/.test(match[i])) {
            return parseInt(match[i]);
        }
    }

    // Check for word numbers
    for (let i = 1; i < match.length; i++) {
        if (match[i] && numberWords[match[i].toLowerCase()]) {
            return numberWords[match[i].toLowerCase()];
        }
    }

    return null;
}

function extractChapterTitle(match, line) {
    if (!match) return line;

    // Try to find title in match groups
    for (let i = 2; i < match.length; i++) {
        if (match[i] && match[i].trim().length > 0) {
            return match[i].trim();
        }
    }

    return line;
}

function extractTocChapterNumber(match) {
    if (!match) return null;

    // Look for number in first group
    if (match[1] && /^\d+$/.test(match[1])) {
        return parseInt(match[1]);
    }

    return null;
}

function extractTocTitle(match, line) {
    if (!match) return line;

    // Look for title (usually second group after number)
    if (match[2] && match[2].trim().length > 0) {
        return match[2].trim();
    }

    if (match[1] && !/^\d+$/.test(match[1])) {
        return match[1].trim();
    }

    return line;
}

function extractTocPageNumber(match) {
    if (!match) return null;

    // Look for page number (usually last group)
    for (let i = match.length - 1; i >= 0; i--) {
        if (match[i] && /^\d+$/.test(match[i])) {
            return parseInt(match[i]);
        }
    }

    return null;
}

function calculatePatternConfidence(line, pattern, lines, index) {
    let confidence = 0.3; // Lower base confidence

    // High confidence for explicit chapter patterns
    if (line.toLowerCase().includes('chapter') && /chapter\s+\d+/i.test(line)) {
        confidence = 0.9;
    } else if (line.toLowerCase().includes('chapter')) {
        confidence += 0.4;
    }

    // Medium confidence for numbered patterns with validation
    if (/^\d+\.?\s+/.test(line)) {
        // Check if it's likely a real chapter vs index/reference
        if (line.length < 80 && line.length > 10) confidence += 0.3;
        if (!/^\d+\s*$/.test(line)) confidence += 0.2; // Not just a number

        // Reduce confidence if it looks like an index or formula
        if (/\d+\s+[A-Z]{2,4}$/.test(line)) confidence -= 0.4; // e.g., "11 NADP"
        if (/^\d+\s+\d/.test(line)) confidence -= 0.5; // e.g., "1 3 5 7 9"
    }

    // Boost for structural patterns
    if (/^(Introduction|Conclusion|Epilogue|Appendix|Index)$/i.test(line)) {
        confidence += 0.4;
    }

    // ALL CAPS validation
    if (line === line.toUpperCase() && line.length > 5) {
        if (line.length < 50 && /^[A-Z\s]+$/.test(line)) {
            confidence += 0.3;
        }
    }

    // Context analysis (v1-inspired)
    const prevLine = index > 0 ? lines[index - 1].trim() : '';
    const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : '';
    const nextLine2 = index < lines.length - 2 ? lines[index + 2].trim() : '';

    if (prevLine.length === 0) confidence += 0.1; // Empty line before
    if (nextLine.length === 0) confidence += 0.1; // Empty line after
    if (nextLine2.length > 50) confidence += 0.1; // Followed by substantial content

    // Penalize if surrounded by similar patterns (likely index)
    if (prevLine && /^\d+/.test(prevLine) && /^\d+/.test(line)) confidence -= 0.3;
    if (nextLine && /^\d+/.test(nextLine) && /^\d+/.test(line)) confidence -= 0.3;

    return Math.min(Math.max(confidence, 0), 1.0);
}

function calculateStructuralConfidence(line, lines, index) {
    let confidence = 0;

    // Length-based scoring
    if (line.length >= 5 && line.length <= 30) confidence += 0.3;

    // Format-based scoring
    if (line === line.toUpperCase()) confidence += 0.2;
    if (/^[A-Z]/.test(line)) confidence += 0.1;
    if (!/[.!?]$/.test(line)) confidence += 0.1;

    // Context-based scoring
    const prevLine = index > 0 ? lines[index - 1].trim() : '';
    const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : '';

    if (prevLine.length === 0) confidence += 0.1;
    if (nextLine.length === 0) confidence += 0.1;
    if (nextLine.length > 50) confidence += 0.1; // Followed by content

    return confidence;
}

function validateChapterSequence(potentialChapters) {
    const validated = [];
    const numbersSeen = new Set();

    // Sort by confidence and line number
    potentialChapters.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.lineNumber - b.lineNumber;
    });

    for (const chapter of potentialChapters) {
        if (chapter.confidence > 0.6) {
            if (chapter.chapterNumber) {
                if (!numbersSeen.has(chapter.chapterNumber)) {
                    numbersSeen.add(chapter.chapterNumber);
                    validated.push(chapter);
                }
            } else {
                validated.push(chapter);
            }
        }
    }

    // Sort validated by chapter number or line number
    validated.sort((a, b) => {
        if (a.chapterNumber && b.chapterNumber) {
            return a.chapterNumber - b.chapterNumber;
        }
        return a.lineNumber - b.lineNumber;
    });

    return validated;
}

function getContextLines(lines, index, count) {
    const start = Math.max(0, index - count);
    const end = Math.min(lines.length, index + count + 1);
    return lines.slice(start, end).map((line, i) => ({
        lineNumber: start + i + 1,
        text: line.trim(),
        isCurrent: start + i === index
    }));
}

// Compare and analyze algorithms
function compareAlgorithms(algorithms) {
    console.log('\n=== Algorithm Comparison ===');

    algorithms.forEach(alg => {
        console.log(`\n--- ${alg.name} ---`);
        console.log(`Chapters detected: ${alg.chapterCount}`);

        if (alg.validatedChapters) {
            console.log(`High confidence chapters: ${alg.validatedChapters.length}`);
            alg.validatedChapters.slice(0, 5).forEach(ch => {
                console.log(`  - Ch ${ch.chapterNumber || '?'}: "${ch.title}" (conf: ${ch.confidence?.toFixed(2)})`);
            });
        }

        if (alg.tocEntries) {
            console.log(`TOC entries: ${alg.tocEntries.length}`);
            alg.tocEntries.slice(0, 5).forEach(entry => {
                console.log(`  - Ch ${entry.chapterNumber || '?'}: "${entry.title}"`);
            });
        }

        if (alg.majorSections) {
            const highConf = alg.majorSections.filter(s => s.confidence > 0.8);
            console.log(`High confidence sections: ${highConf.length}`);
            highConf.slice(0, 5).forEach(section => {
                console.log(`  - "${section.text}" (conf: ${section.confidence.toFixed(2)})`);
            });
        }
    });
}

// Main execution
async function runPOC() {
    console.log('Starting POC-2: Chapter Detection tests...\n');

    // Check if PDF exists
    if (!fs.existsSync(PDF_PATH)) {
        console.error(`Error: PDF file not found at ${PDF_PATH}`);
        process.exit(1);
    }

    // Load reconstructed text
    const extractedData = await loadReconstructedText();
    const text = extractedData.text;

    // Test different algorithms
    const patternAlgorithm = detectChaptersPattern(text);
    const tocAlgorithm = analyzeTableOfContents(text);
    const structureAlgorithm = analyzeContentStructure(text);

    const algorithms = [patternAlgorithm, tocAlgorithm, structureAlgorithm];

    // Compare algorithms
    compareAlgorithms(algorithms);

    // Save results
    results.algorithms = algorithms;
    results.extractedData = {
        textLength: text.length,
        pageCount: extractedData.pageCount,
        metadata: extractedData.metadata
    };

    // Save detailed results
    algorithms.forEach(alg => {
        fs.writeFileSync(
            path.join(OUTPUT_DIR, `${alg.name.toLowerCase().replace(/\s+/g, '-')}-results.json`),
            JSON.stringify(alg, null, 2)
        );
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, 'poc-results.json'), JSON.stringify(results, null, 2));

    // Save sample text sections for manual inspection
    const sampleLines = text.split('\n').slice(0, 200);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'sample-text.txt'), sampleLines.join('\n'));

    console.log(`\n=== Results saved to ${OUTPUT_DIR} ===`);
    console.log('Files created:');
    console.log('- poc-results.json (complete test results)');
    console.log('- *-results.json (individual algorithm results)');
    console.log('- sample-text.txt (text sample for inspection)');

    return results;
}

// Run the POC
if (require.main === module) {
    runPOC().catch(console.error);
}

module.exports = { runPOC, detectChaptersPattern, analyzeTableOfContents, analyzeContentStructure };
