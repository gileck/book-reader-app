/**
 * Step 1: Text Extraction
 * 
 * Extract raw text from PDF while preserving literal \n characters.
 * This is the foundation step that all other steps depend on.
 * 
 * Requirements:
 * - Extract complete text from PDF
 * - Preserve literal \n characters (not convert to actual newlines)
 * - Handle multi-page PDFs correctly
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
 * Execute text extraction step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated state with extracted text
 */
async function execute(pipelineState, config) {
    console.log('📄 Starting text extraction...');
    
    // Check if PDF file exists
    if (!fs.existsSync(config.INPUT_PDF)) {
        throw new Error(`PDF file not found: ${config.INPUT_PDF}`);
    }
    
    try {
        // Read PDF file
        console.log('📖 Reading PDF file...');
        const pdfBuffer = fs.readFileSync(config.INPUT_PDF);
        
        // Import pdf-parse dynamically (in case it's not installed)
        let pdfParse;
        try {
            pdfParse = require('pdf-parse');
        } catch (importError) {
            console.warn('⚠️  pdf-parse not installed, using fallback text extraction');
            return fallbackTextExtraction(config, pipelineState);
        }
        
        // Extract text using pdf-parse with page-by-page extraction
        console.log('🔍 Extracting text from PDF with page markers...');
        const pdfData = await pdfParse(pdfBuffer, {
            pagerender: async (pageData) => {
                // Extract text for each page individually with page markers
                const pageNum = pageData.pageIndex + 1;
                
                if (pageData.getTextContent) {
                    const textContent = await pageData.getTextContent();
                    let pageText = '';
                    let lastY = null;
                    
                    // Preserve line structure by checking Y positions
                    for (const item of textContent.items) {
                        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                            // New line detected based on Y position change
                            pageText += '\n';
                        }
                        pageText += item.str + ' ';
                        lastY = item.transform[5];
                    }
                    
                    return `\n--- PAGE ${pageNum} ---\n${pageText.trim()}\n--- END PAGE ${pageNum} ---\n`;
                } else {
                    return `\n--- PAGE ${pageNum} ---\n\n--- END PAGE ${pageNum} ---\n`;
                }
            }
        });
        
        // If pagerender didn't work, fall back to regular extraction with manual page markers
        let rawText;
        if (pdfData.text && pdfData.text.includes('--- PAGE')) {
            rawText = pdfData.text;
        } else {
            console.log('📄 Using fallback: adding estimated page markers...');
            rawText = addEstimatedPageMarkers(pdfData.text, pdfData.numpages);
        }
        
        // Validate extraction
        if (!rawText || rawText.trim().length === 0) {
            throw new Error('PDF text extraction failed - no text found');
        }
        
        // Calculate statistics
        const characterCount = rawText.length;
        const pageCount = pdfData.numpages;
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
                pdfInfo: {
                    pages: pdfData.numpages,
                    info: pdfData.info || {},
                    metadata: pdfData.metadata || {}
                }
            },
            textValidation: {
                hasContent: rawText.length > 0,
                startsWithText: textSample.length > 0,
                endsWithText: textEnd.length > 0,
                containsLiteralNewlines: literalNewlineCount > 0,
                averageWordsPerPage: Math.round(wordCount / pageCount)
            },
            textSamples: {
                beginning: textSample + (rawText.length > 500 ? '...' : ''),
                ending: (rawText.length > 500 ? '...' : '') + textEnd,
                firstLines: rawText.split('\n').slice(0, 10),
                lastLines: rawText.split('\n').slice(-10)
            }
        };
        
        // Save debug output
        const debugFile = path.join(config.DEBUG_DIR, 'step-01-text-extraction.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
        
        // Save raw text for reference
        const rawTextFile = path.join(config.DEBUG_DIR, 'step-01-raw-text.txt');
        fs.writeFileSync(rawTextFile, rawText, 'utf8');
        
        console.log(`✅ Text extraction completed successfully`);
        console.log(`📊 Statistics:`);
        console.log(`   - Characters: ${characterCount.toLocaleString()}`);
        console.log(`   - Pages: ${pageCount}`);
        console.log(`   - Lines: ${lineCount.toLocaleString()}`);
        console.log(`   - Words: ${wordCount.toLocaleString()}`);
        console.log(`   - Literal \\n: ${literalNewlineCount}`);
        console.log(`   - Avg words/page: ${Math.round(wordCount / pageCount)}`);
        console.log(`📄 Debug output: ${debugFile}`);
        console.log(`📄 Raw text file: ${rawTextFile}`);
        
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
                    extractionTime,
                    averageWordsPerPage: Math.round(wordCount / pageCount)
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Text extraction failed:', error.message);
        
        // Try fallback extraction if pdf-parse fails
        if (error.message.includes('pdf-parse')) {
            console.log('🔄 Attempting fallback text extraction...');
            return fallbackTextExtraction(config, pipelineState);
        }
        
        throw error;
    }
}

/**
 * Fallback text extraction when pdf-parse is not available
 * @param {Object} config - Configuration object
 * @param {Object} pipelineState - Current pipeline state
 * @returns {Object} - Fallback extraction result
 */
function fallbackTextExtraction(config, pipelineState) {
    console.log('📄 Using fallback text extraction...');
    
    // Check if there's already a raw text file we can use
    const possibleTextFiles = [
        path.join(path.dirname(config.INPUT_PDF), 'raw-pdf-text.txt'),
        path.join(path.dirname(config.INPUT_PDF), 'text.txt'),
        path.join(path.dirname(config.INPUT_PDF), 'book.txt')
    ];
    
    for (const textFile of possibleTextFiles) {
        if (fs.existsSync(textFile)) {
            console.log(`📖 Found existing text file: ${textFile}`);
            
            const rawText = fs.readFileSync(textFile, 'utf8');
            
            if (rawText && rawText.trim().length > 0) {
                const characterCount = rawText.length;
                const lineCount = rawText.split('\n').length;
                const wordCount = rawText.split(/\s+/).filter(word => word.length > 0).length;
                const extractionTime = new Date().toISOString();
                
                // Generate basic debug output
                const debugOutput = {
                    extractionMetadata: {
                        characterCount,
                        lineCount,
                        wordCount,
                        extractionTime,
                        source: 'fallback_text_file',
                        sourceFile: textFile
                    },
                    textSamples: {
                        beginning: rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''),
                        ending: (rawText.length > 500 ? '...' : '') + rawText.substring(Math.max(0, rawText.length - 500))
                    }
                };
                
                const debugFile = path.join(config.DEBUG_DIR, 'step-01-text-extraction.json');
                fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
                
                console.log(`✅ Fallback text extraction completed`);
                console.log(`📊 Characters: ${characterCount.toLocaleString()}`);
                console.log(`📊 Lines: ${lineCount.toLocaleString()}`);
                console.log(`📊 Words: ${wordCount.toLocaleString()}`);
                
                return {
                    rawText: rawText,
                    metadata: {
                        ...pipelineState.metadata,
                        textExtraction: {
                            characterCount,
                            lineCount,
                            wordCount,
                            extractionTime,
                            source: 'fallback_text_file',
                            sourceFile: textFile
                        }
                    }
                };
            }
        }
    }
    
    // If no fallback available, throw error
    throw new Error('PDF text extraction failed and no fallback text file found. Please install pdf-parse: npm install pdf-parse');
}

/**
 * Add estimated page markers when pagerender doesn't work
 * @param {string} text - Raw PDF text
 * @param {number} pageCount - Number of pages
 * @returns {string} - Text with estimated page markers
 */
function addEstimatedPageMarkers(text, pageCount) {
    if (!text || pageCount <= 1) {
        return `\n--- PAGE 1 ---\n${text}\n--- END PAGE 1 ---\n`;
    }
    
    // Estimate page breaks by text length
    const textLength = text.length;
    const averagePageLength = Math.floor(textLength / pageCount);
    
    let markedText = '';
    let currentPageStart = 0;
    
    for (let page = 1; page <= pageCount; page++) {
        const pageStart = currentPageStart;
        const pageEnd = page === pageCount ? textLength : currentPageStart + averagePageLength;
        
        // Try to break at a paragraph boundary near the estimated position
        let actualPageEnd = pageEnd;
        if (page < pageCount) {
            // Look for paragraph break within ±10% of estimated position
            const searchRange = Math.floor(averagePageLength * 0.1);
            const searchStart = Math.max(pageEnd - searchRange, pageStart);
            const searchEnd = Math.min(pageEnd + searchRange, textLength);
            
            for (let i = searchStart; i < searchEnd; i++) {
                if (text[i] === '\n' && text[i + 1] === '\n') {
                    actualPageEnd = i;
                    break;
                }
            }
        }
        
        const pageText = text.substring(pageStart, actualPageEnd);
        markedText += `\n--- PAGE ${page} ---\n${pageText}\n--- END PAGE ${page} ---\n`;
        
        currentPageStart = actualPageEnd;
    }
    
    return markedText;
}

module.exports = {
    execute
}; 