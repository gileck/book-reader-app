/**
 * Step 1: Text Extraction (Fixed Page-by-Page Approach)
 * 
 * Extract raw text from PDF using proper page-by-page extraction with improved text joining.
 * This approach uses pdfjs-dist for accurate page boundaries but fixes spacing issues.
 * 
 * Requirements:
 * - Extract complete text from PDF without spacing issues
 * - Preserve literal \n characters (not convert to actual newlines)
 * - Handle multi-page PDFs correctly with accurate page boundaries
 * - Provide character count and basic metadata
 * - Generate debug output for validation
 * 
 * Expected Input:
 * - pipelineState: { rawText: null, ... }
 * - config: { INPUT_PDF: path, OUTPUT_DIR: path, ... }
 * 
 * Expected Output:
 * - { rawText: "extracted text...", metadata: { ... } }
 */

const fs = require('fs');
const path = require('path');

/**
 * Execute text extraction step using proper page-by-page extraction
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated state with extracted text
 */
async function execute(pipelineState, config) {
    // Check if PDF file exists
    if (!fs.existsSync(config.INPUT_PDF)) {
        throw new Error(`PDF file not found: ${config.INPUT_PDF}`);
    }

    try {
        // Read PDF file
        const pdfBuffer = fs.readFileSync(config.INPUT_PDF);

        // Import required libraries
        let pdfjsLib;
        try {
            pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
        } catch (importError) {
            console.warn('⚠️  Required PDF libraries not installed, using fallback text extraction');
            return fallbackTextExtraction(config, pipelineState);
        }

        // Load PDF document
        const pdfDoc = await pdfjsLib.getDocument(pdfBuffer).promise;
        const totalPages = pdfDoc.numPages;

        // Process each page individually
        let rawText = '';
        const pageInfo = [];
        const rawTextContentItems = []; // Store raw PDF.js textContent.items for debugging

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Store raw textContent.items for this page (before any processing)
            rawTextContentItems.push({
                pageNumber: pageNum - 1,
                totalItems: textContent.items ? textContent.items.length : 0,
                items: textContent.items || []
            });

            // Extract text with improved spacing logic
            const pageText = extractCleanPageText(textContent, pageNum - 1);

            // Add page markers
            const pageStartPos = rawText.length;
            rawText += `\n--- PAGE ${pageNum - 1} ---\n`;
            rawText += pageText;
            rawText += `\n--- END PAGE ${pageNum - 1} ---\n`;

            // Store page info
            pageInfo.push({
                pageNumber: pageNum - 1,
                startPosition: pageStartPos,
                endPosition: rawText.length,
                characterCount: pageText.length,
                wordCount: pageText.split(/\s+/).filter(w => w.length > 0).length,
                text: pageText
            });

            if (pageNum % 50 === 0) {
                // Processing progress
            }
        }

        // Validate final result
        if (!rawText || rawText.trim().length === 0) {
            throw new Error('Text extraction failed - no final text found');
        }

        // Calculate statistics
        const characterCount = rawText.length;
        const pageCount = totalPages;
        const extractionTime = new Date().toISOString();

        // Calculate additional metrics
        const lineCount = rawText.split('\n').length;
        const wordCount = rawText.split(/\s+/).filter(word => word.length > 0).length;
        const literalNewlineCount = (rawText.match(/\\n/g) || []).length;

        // Generate text samples for validation
        const textSample = rawText.substring(0, 500);
        const textEnd = rawText.substring(Math.max(0, rawText.length - 500));

        // Generate debug output
        const debugOutput = {
            extractionMetadata: {
                characterCount,
                pageCount,
                lineCount,
                wordCount,
                literalNewlineCount,
                extractionTime,
                extractionMethod: 'page_by_page_fixed',
                totalTextContentItems: rawTextContentItems.reduce((sum, page) => sum + page.totalItems, 0)
            },
            textValidation: {
                hasContent: rawText.length > 0,
                startsWithText: textSample.length > 0,
                endsWithText: textEnd.length > 0,
                containsLiteralNewlines: literalNewlineCount > 0,
                averageWordsPerPage: Math.round(wordCount / pageCount),
                hasPageMarkers: rawText.includes('--- PAGE')
            },
            textSamples: {
                beginning: textSample + (rawText.length > 500 ? '...' : ''),
                ending: (rawText.length > 500 ? '...' : '') + textEnd,
                firstLines: rawText.split('\n').slice(0, 10),
                lastLines: rawText.split('\n').slice(-10)
            },
            pageInfo: pageInfo.map(page => ({
                pageNumber: page.pageNumber,
                startPosition: page.startPosition,
                endPosition: page.endPosition,
                characterCount: page.characterCount,
                wordCount: page.wordCount
            })),
            rawTextContentSummary: {
                totalPages: rawTextContentItems.length,
                totalItems: rawTextContentItems.reduce((sum, page) => sum + page.totalItems, 0),
                averageItemsPerPage: Math.round(rawTextContentItems.reduce((sum, page) => sum + page.totalItems, 0) / rawTextContentItems.length),
                pagesWithItems: rawTextContentItems.filter(page => page.totalItems > 0).length,
                pagesWithoutItems: rawTextContentItems.filter(page => page.totalItems === 0).length,
                saveLocation: 'step-01-raw-textcontent-items.json'
            }
        };

        // Save debug output
        const debugFile = path.join(config.DEBUG_DIR, 'step-01-text-extraction.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));

        // Save raw text for reference
        const rawTextFile = path.join(config.DEBUG_DIR, 'step-01-raw-text.txt');
        fs.writeFileSync(rawTextFile, rawText, 'utf8');

        // Save raw textContent.items (untouched PDF.js output) for debugging
        const rawTextContentFile = path.join(config.DEBUG_DIR, 'step-01-raw-textcontent-items.json');
        fs.writeFileSync(rawTextContentFile, JSON.stringify(rawTextContentItems, null, 2));

        // Validate text quality - check for overly long words
        const wordValidation = validateWordLengths(rawText);

        return {
            rawText: rawText,
            rawTextContentItems: rawTextContentItems, // Include raw PDF.js textContent.items for debugging
            metadata: {
                ...pipelineState.metadata,
                textExtraction: {
                    characterCount,
                    pageCount,
                    lineCount,
                    wordCount,
                    literalNewlineCount,
                    extractionTime,
                    averageWordsPerPage: Math.round(wordCount / pageCount),
                    extractionMethod: 'page_by_page_fixed',
                    totalTextContentItems: rawTextContentItems.reduce((sum, page) => sum + page.totalItems, 0)
                }
            }
        };

    } catch (error) {
        console.error('❌ Text extraction failed:', error.message);
        throw error;
    }
}

/**
 * Extract clean text from a page with improved spacing logic
 * @param {Object} textContent - Text content from pdfjs-dist
 * @param {number} pageNum - Page number (0-based)
 * @returns {string} - Clean page text
 */
function extractCleanPageText(textContent, pageNum) {
    if (!textContent || !textContent.items || textContent.items.length === 0) {
        return '';
    }

    const items = textContent.items;
    let pageText = '';

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        const itemText = item.str;
        if (!itemText || itemText.trim().length === 0) {
            continue;
        }

        // Add the text
        pageText += itemText;

        // Use PDF.js hasEOL property to determine line breaks - much more reliable!
        if (item.hasEOL) {
            pageText += '\n';
        } else {
            // Add space after each text item unless it's the last item or already ends with space
            if (i < items.length - 1 && !itemText.endsWith(' ')) {
                pageText += ' ';
            }
        }
    }

    // Clean the page text by removing standalone page numbers at the beginning
    return removeStandalonePageNumber(pageText.trim(), pageNum);
}

/**
 * Fallback text extraction when pdf-parse is not available
 * @param {Object} config - Configuration object
 * @param {Object} pipelineState - Current pipeline state
 * @returns {Object} - Fallback extraction result
 */
function fallbackTextExtraction(config, pipelineState) {
    // Check if there's already a raw text file we can use
    const rawTextFile = path.join(config.DEBUG_DIR, 'step-01-raw-text.txt');
    if (fs.existsSync(rawTextFile)) {
        const rawText = fs.readFileSync(rawTextFile, 'utf8');

        return {
            rawText: rawText,
            metadata: {
                ...pipelineState.metadata,
                textExtraction: {
                    characterCount: rawText.length,
                    pageCount: 'unknown',
                    lineCount: rawText.split('\n').length,
                    wordCount: rawText.split(/\s+/).filter(word => word.length > 0).length,
                    literalNewlineCount: (rawText.match(/\\n/g) || []).length,
                    extractionTime: new Date().toISOString(),
                    fallbackUsed: true
                }
            }
        };
    }

    throw new Error('No fallback text extraction available and pdfjs-dist failed');
}

/**
 * Remove standalone page numbers from the beginning of page text
 * @param {string} pageText - Text content of a page
 * @param {number} pageNum - Page number
 * @returns {string} - Cleaned page text
 */
function removeStandalonePageNumber(pageText, pageNum) {
    // Remove standalone page number at the beginning of the page
    const lines = pageText.split('\n');
    if (lines.length > 0) {
        const firstLine = lines[0].trim();

        // Check if first line is just the page number
        if (firstLine === pageNum.toString() || firstLine === (pageNum + 1).toString()) {
            return lines.slice(1).join('\n');
        }
    }

    return pageText;
}

/**
 * Validate word lengths to detect concatenated words
 * @param {string} text - Text to validate
 * @returns {Object} - Validation results
 */
function validateWordLengths(text) {
    // Extract words (alphanumeric sequences)
    const words = text.match(/[a-zA-Z0-9]+/g) || [];

    // Categorize words by length
    const longWords = words.filter(word => word.length > 20);
    const veryLongWords = words.filter(word => word.length > 30);
    const suspiciousWords = words.filter(word => word.length > 50);

    // Find longest word
    const longestWord = words.reduce((longest, current) =>
        current.length > longest.length ? current : longest, ''
    );

    // Sort suspicious words by length (descending)
    suspiciousWords.sort((a, b) => b.length - a.length);

    return {
        totalWords: words.length,
        longWords: longWords,
        veryLongWords: veryLongWords,
        suspiciousWords: suspiciousWords,
        longestWord: longestWord,
        averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length
    };
}

/**
 * Validate text extraction results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    // Check if rawText exists and is not empty
    if (!output.rawText || typeof output.rawText !== 'string') {
        console.error('❌ Validation failed: rawText is missing or not a string');
        return false;
    }

    // Check minimum length (should have substantial content)
    if (output.rawText.length < 1000) {
        console.error(`❌ Validation failed: rawText too short (${output.rawText.length} characters, expected at least 1000)`);
        return false;
    }

    // Check that metadata exists
    if (!output.metadata || !output.metadata.textExtraction || !output.metadata.textExtraction.characterCount) {
        console.error('❌ Validation failed: metadata missing or incomplete');
        return false;
    }

    // Check character count consistency
    if (output.metadata.textExtraction.characterCount !== output.rawText.length) {
        console.error(`❌ Validation failed: character count mismatch (metadata: ${output.metadata.textExtraction.characterCount}, actual: ${output.rawText.length})`);
        return false;
    }

    return true;
}

module.exports = {
    execute,
    validate
}; 