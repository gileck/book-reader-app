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

// Import shared text processing utilities
const { validateWordLengths } = require('../../utils/text-processing-utils');

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

    // Determine .txt file path (same directory and name as PDF, but with .txt extension)
    const pdfDir = path.dirname(config.INPUT_PDF);
    const pdfBaseName = path.basename(config.INPUT_PDF, path.extname(config.INPUT_PDF));
    const txtFilePath = path.join(pdfDir, `${pdfBaseName}.txt`);

    // Check if we should force re-parsing from PDF
    const forceReparse = config.FORCE_REPARSE || false;

    // If forceReparse is true, delete existing .txt file
    if (forceReparse && fs.existsSync(txtFilePath)) {
        console.log(`🔄 Force reparse enabled: deleting existing ${path.basename(txtFilePath)}`);
        fs.unlinkSync(txtFilePath);
    }

    // Check if .txt file exists and use it instead of parsing PDF
    if (fs.existsSync(txtFilePath) && !forceReparse) {
        console.log(`📄 Found existing text file: ${path.basename(txtFilePath)}`);
        console.log(`   Using cached text extraction (skip PDF parsing)`);

        const rawText = fs.readFileSync(txtFilePath, 'utf-8');

        // Calculate basic statistics for metadata
        const characterCount = rawText.length;
        const lineCount = rawText.split('\n').length;
        const wordCount = rawText.split(/\s+/).filter(word => word.length > 0).length;
        const literalNewlineCount = (rawText.match(/\\n/g) || []).length;

        // Count pages from page markers
        const pageMarkers = rawText.match(/--- PAGE \d+ ---/g) || [];
        const pageCount = pageMarkers.length;

        // Return the same structure as PDF extraction would
        return {
            rawText: rawText,
            metadata: {
                ...pipelineState.metadata,
                textExtraction: {
                    characterCount,
                    pageCount,
                    lineCount,
                    wordCount,
                    literalNewlineCount,
                    extractionTime: new Date().toISOString(),
                    source: 'cached-txt-file',
                    txtFilePath: txtFilePath,
                    extractionMethod: 'text-file-load'
                }
            }
        };
    }

    // No .txt file exists or force reparse - extract from PDF
    console.log(`📖 Extracting text from PDF: ${path.basename(config.INPUT_PDF)}`);
    if (!fs.existsSync(txtFilePath)) {
        console.log(`   (Will save to ${path.basename(txtFilePath)} for future runs)`);
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

        // Calculate pages with actual content (excluding page markers)
        const pagesWithContent = pageInfo.filter(page => page.characterCount > 50).length;
        const emptyPagePercentage = ((totalPages - pagesWithContent) / totalPages * 100).toFixed(1);
        
        // Early warning for corrupted PDFs - check if most pages are empty
        if (pagesWithContent < totalPages * 0.1) { // Less than 10% of pages have content
            const warningMsg = `
⚠️  WARNING: PDF appears to be corrupted or unreadable!

   Extraction Results:
   - Total pages: ${totalPages}
   - Pages with content: ${pagesWithContent} (${(pagesWithContent / totalPages * 100).toFixed(1)}%)
   - Empty pages: ${totalPages - pagesWithContent} (${emptyPagePercentage}%)
   - Average words per page: ${Math.round(wordCount / pageCount)}
   
   This PDF has ${emptyPagePercentage}% empty pages, which strongly suggests:
   
   1. 🔴 PDF is corrupted (compression stream errors)
   2. 🔴 PDF contains only scanned images (requires OCR)
   3. 🔴 PDF uses non-standard encoding that cannot be extracted
   
   Recommended Actions:
   - Try opening the PDF in a viewer and check if you can select/copy text
   - If text is selectable, the PDF may be corrupted - try re-downloading or repairing it
   - If text is NOT selectable, the PDF contains only images and requires OCR processing
   - Try converting the PDF using Adobe Acrobat or another tool and re-saving it
`;
            console.error(warningMsg);
            throw new Error(`PDF extraction failed: ${emptyPagePercentage}% of pages are empty. The PDF appears to be corrupted or contains only images. Please check the PDF file and try again with a valid, text-based PDF.`);
        }
        
        // Warning for PDFs with significant empty pages
        if (pagesWithContent < totalPages * 0.5) { // Less than 50% of pages have content
            console.warn(`⚠️  Warning: ${emptyPagePercentage}% of pages appear to be empty. This may indicate PDF quality issues.`);
        }

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
                totalTextContentItems: rawTextContentItems.reduce((sum, page) => sum + page.totalItems, 0),
                pagesWithContent,
                emptyPages: totalPages - pagesWithContent,
                emptyPagePercentage: parseFloat(emptyPagePercentage),
                extractionQuality: pagesWithContent > totalPages * 0.9 ? 'excellent' : 
                                   pagesWithContent > totalPages * 0.7 ? 'good' : 
                                   pagesWithContent > totalPages * 0.5 ? 'fair' : 
                                   pagesWithContent > totalPages * 0.1 ? 'poor' : 'failed'
            },
            textValidation: {
                hasContent: rawText.length > 0,
                startsWithText: textSample.length > 0,
                endsWithText: textEnd.length > 0,
                containsLiteralNewlines: literalNewlineCount > 0,
                averageWordsPerPage: Math.round(wordCount / pageCount),
                hasPageMarkers: rawText.includes('--- PAGE'),
                qualityCheck: {
                    pagesWithContent,
                    emptyPages: totalPages - pagesWithContent,
                    contentPercentage: (pagesWithContent / totalPages * 100).toFixed(1),
                    isHealthy: pagesWithContent > totalPages * 0.5
                }
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

        // Save extracted text to .txt file for future use and manual editing
        console.log(`💾 Saving extracted text to: ${path.basename(txtFilePath)}`);
        fs.writeFileSync(txtFilePath, rawText, 'utf-8');
        console.log(`   ✓ Text file saved (${characterCount} characters)`);

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
 * 
 * CRITICAL FEATURES:
 * 1. Position-Based Sorting: Sorts text items by visual position (Y-coordinate desc, then X-coordinate asc)
 *    to ensure correct reading order, preventing issues where bullets appear out of order.
 * 2. Bullet Merging: Automatically merges standalone bullets/numbered markers with their list items
 *    after extraction to fix PDF structure issues.
 * 3. Page Number Removal: Removes standalone page numbers from the beginning of page content.
 * 
 * @param {Object} textContent - Text content from pdfjs-dist with items array
 * @param {number} pageNum - Page number (0-based)
 * @returns {string} - Clean page text with bullets properly merged and page numbers removed
 */
function extractCleanPageText(textContent, pageNum) {
    if (!textContent || !textContent.items || textContent.items.length === 0) {
        return '';
    }

    // CRITICAL FIX: Sort items by their visual position (Y-coordinate, then X-coordinate)
    // This ensures bullets and text appear in reading order, not PDF file structure order
    const items = textContent.items.slice(); // Clone to avoid modifying original
    items.sort((a, b) => {
        // Get Y-coordinate from transform array [scaleX, skewY, skewX, scaleY, translateX, translateY]
        // Higher Y values = lower on page, so we reverse the sort
        const aY = a.transform ? a.transform[5] : 0;
        const bY = b.transform ? b.transform[5] : 0;
        const aX = a.transform ? a.transform[4] : 0;
        const bX = b.transform ? b.transform[4] : 0;
        
        // Sort by Y (vertical position) first - with tolerance for same line
        const yTolerance = 2; // Allow 2 units of vertical variance for same line
        if (Math.abs(aY - bY) > yTolerance) {
            return bY - aY; // Reverse sort: higher Y = lower on page = later in text
        }
        
        // If on same line (within tolerance), sort by X (horizontal position)
        return aX - bX;
    });

    let pageText = '';

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        const itemText = item.str;
        // Preserve explicit empty-line markers from PDF.js: empty string with hasEOL=true
        if (itemText === undefined || itemText === null) {
            if (item.hasEOL) {
                pageText += '\n';
            }
            continue;
        }
        const itemTrimmed = typeof itemText === 'string' ? itemText.trim() : '';
        if (itemTrimmed.length === 0) {
            // CRITICAL: Don't skip space items that are word separators!
            // PDF.js often includes standalone space items " " between words
            // These are NOT empty lines, they're meaningful spacing
            // Only skip truly empty items (empty string "")
            if (itemText === ' ' || itemText === '  ') {
                // This is a space item - add it as-is (important for word separation!)
                pageText += itemText;
                continue;
            }
            
            // Treat an empty item that signals end-of-line as a blank line (paragraph break)
            if (item.hasEOL) {
                pageText += '\n';
            }
            continue;
        }

        // Add the text
        pageText += itemText;

        // Use PDF.js hasEOL property to determine line breaks - much more reliable!
        if (item.hasEOL) {
            pageText += '\n';
        } else {
            // CRITICAL: Smart spacing detection using PDF positioning data
            // 
            // PDF.js gives us the physical position and width of each text item.
            // We can calculate if items are touching (ligatures) or separated (normal words).
            //
            // Why this matters:
            // - Professional PDFs use font ligatures (fi, fl, ff, ffi, ffl) for better typography
            // - PDF.js extracts ligatures as SEPARATE items but they're positioned with NO gap
            // - Example: "find" → ["fi", "nd"] with 0 gap between them
            // - We should NOT add space between items that are physically touching!
            //
            // Algorithm:
            // 1. Calculate where current item ends: position + width
            // 2. Get where next item starts: next position
            // 3. Calculate gap = nextStart - currentEnd
            // 4. If gap is tiny (< 1 unit), items are touching → NO space
            // 5. If gap is larger, items are separated → ADD space
            
            if (i < items.length - 1 && !itemText.endsWith(' ')) {
                const nextItem = items[i + 1];
                
                // Extract position data from transform matrix [scaleX, skewY, skewX, scaleY, translateX, translateY]
                // Index 4 = translateX (horizontal position)
                const currentX = item.transform[4];           // Where current item starts
                const currentWidth = item.width;              // Width of current item
                const currentEndX = currentX + currentWidth;  // Where current item ends
                
                const nextX = nextItem.transform[4];          // Where next item starts
                
                // Calculate the physical gap between items
                const gap = nextX - currentEndX;
                
                // Threshold: If gap is > 1.0 units, items are separated and need a space
                // If gap is ≤ 1.0 units, items are touching (ligature) and should join directly
                // 
                // Examples from real PDFs:
                // - "fi" + "nd" (ligature): gap = 0.00 → NO space → "find" ✅
                // - "hello" + "world": gap = 4.50 → ADD space → "hello world" ✅
                const SPACE_THRESHOLD = 1.0;
                
                if (gap > SPACE_THRESHOLD) {
                    pageText += ' ';
                }
                // If gap ≤ threshold, don't add space (items are touching/ligature)
            }
        }
    }

    // Clean the page text by removing standalone page numbers at the beginning
    let cleanedText = removeStandalonePageNumber(pageText.trim(), pageNum);
    
    // CRITICAL FIX: Merge standalone bullets with their text on the next line
    // Pattern: A line with only a bullet (•, -, *, etc.) followed by text on next line
    cleanedText = mergeBulletsWithText(cleanedText);
    
    return cleanedText;
}

/**
 * Merge standalone bullet points with their text on the next line
 * 
 * Fixes common PDF extraction issue where bullets appear on separate lines from their text:
 * - Input:  "•\nYoga mat\n•\nBench"
 * - Output: "• Yoga mat\n• Bench"
 * 
 * Handles both bullet markers (•, ●, ■, -, *, +) and numbered list markers (1., 2.), etc.)
 * 
 * This is critical for proper list parsing in downstream steps, preventing validation errors
 * and ensuring list items are correctly identified and formatted.
 * 
 * @param {string} text - Page text with potential standalone bullets
 * @returns {string} - Text with bullets merged to their list items
 */
function mergeBulletsWithText(text) {
    if (!text) return text;
    
    const lines = text.split('\n');
    const result = [];
    let i = 0;
    
    while (i < lines.length) {
        const currentLine = lines[i].trim();
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        
        // Check if current line is ONLY a bullet/list marker
        const isBulletOnly = /^[•●■▪▫◦⦿⦾\-\*\+]\s*$/.test(currentLine);
        
        // Check if current line is a numbered list marker (e.g., "1.", "2)", etc.)
        const isNumberedMarkerOnly = /^\d+[\.\)]\s*$/.test(currentLine);
        
        if ((isBulletOnly || isNumberedMarkerOnly) && nextLine && nextLine.length > 0) {
            // Merge bullet with next line's text
            result.push(currentLine + ' ' + nextLine);
            i += 2; // Skip both current and next line
        } else {
            result.push(lines[i]);
            i++;
        }
    }
    
    return result.join('\n');
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

// Note: validateWordLengths function now imported from shared utilities

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