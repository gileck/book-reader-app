const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

/**
 * Comprehensive PDF preprocessing - extracts ALL data needed by other modules in a single pass
 * @param {string} pdfPath - Path to PDF file
 * @param {boolean} debugMode - Enable debug logging
 * @returns {Object} Complete PDF data object containing all extracted information
 */
async function preprocessPDF(pdfPath, debugMode = false) {
    console.log('🔍 Preprocessing PDF - extracting all data in single pass...');
    
    const startTime = Date.now();
    
    // Validate PDF file exists
    if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
    }
    
    // Read PDF buffer once
    console.log('   📖 Loading PDF file...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Initialize PDF document with PDF.js
    console.log('   🔧 Initializing PDF document...');
    const pdfDoc = await pdfjsLib.getDocument(pdfBuffer).promise;
    
    // Extract basic text content with pdf-parse
    console.log('   📝 Extracting basic text content...');
    const pdfData = await pdfParse(pdfBuffer);
    
    console.log(`   📊 PDF has ${pdfDoc.numPages} pages, ${pdfData.text.length} characters`);
    
    // Initialize data structures
    const preprocessedData = {
        // Basic information
        pdfPath,
        numPages: pdfDoc.numPages,
        basicText: pdfData.text,
        info: pdfData.info,
        
        // Page-by-page data
        pages: [],
        
        // Extracted components
        toc: null,
        images: [],
        links: [],
        
        // Performance metrics
        processingTime: 0,
        errors: []
    };
    
    // Extract TOC/bookmarks first (doesn't require page iteration)
    console.log('   📑 Extracting table of contents...');
    try {
        const outline = await pdfDoc.getOutline();
        if (outline && outline.length > 0) {
            preprocessedData.toc = {
                source: 'pdf_bookmarks',
                chapters: await extractBookmarksFromOutline(outline, pdfDoc)
            };
            console.log(`     ✅ Found ${preprocessedData.toc.chapters.length} chapters from bookmarks`);
        } else {
            // Will search for TOC in text during page processing
            preprocessedData.toc = { source: 'none', chapters: [] };
            console.log('     ⚠️ No PDF bookmarks found');
        }
    } catch (error) {
        preprocessedData.errors.push(`TOC extraction error: ${error.message}`);
        preprocessedData.toc = { source: 'error', chapters: [] };
    }
    
    // Process each page to extract all data
    console.log('   📄 Processing pages (text, images, links, TOC search)...');
    
    let totalImages = 0;
    let totalLinks = 0;
    const tocSearchPages = [];
    
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        try {
            const page = await pdfDoc.getPage(pageNum);
            
            // Extract text content with coordinates
            const textContent = await page.getTextContent();
            const textItems = textContent.items.map(item => ({
                text: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width || 0,
                height: item.height || 0,
                fontName: item.fontName,
                fontSize: item.height || 12
            }));
            
            // Combine text for page
            const combinedText = textItems.map(item => item.text).join('');
            
            // Calculate coordinate bounds
            const coordinateBounds = textItems.length > 0 ? {
                minX: Math.min(...textItems.map(item => item.x)),
                maxX: Math.max(...textItems.map(item => item.x + item.width)),
                minY: Math.min(...textItems.map(item => item.y)),
                maxY: Math.max(...textItems.map(item => item.y))
            } : null;
            
            // Check for images on this page
            const operatorList = await page.getOperatorList();
            let imageCount = 0;
            for (let i = 0; i < operatorList.fnArray.length; i++) {
                if (operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
                    imageCount++;
                }
            }
            
            if (imageCount > 0) {
                preprocessedData.images.push({
                    pageNumber: pageNum,
                    imageCount: imageCount,
                    detected: true
                });
                totalImages += imageCount;
            }
            
            // Extract link annotations
            const annotations = await page.getAnnotations();
            const pageLinks = [];
            
            for (const annotation of annotations) {
                if (annotation.subtype === 'Link' && annotation.dest && !annotation.url) {
                    try {
                        const destPageNum = await getPageNumberFromDest(annotation.dest, pdfDoc);
                        const linkText = findTextForAnnotation(annotation, textContent);
                        const destinationCoordinates = extractDestinationCoordinates(annotation.dest);
                        
                        const linkInfo = {
                            pageNumber: pageNum,
                            linkText: linkText,
                            destinationPage: destPageNum,
                            destinationCoordinates: destinationCoordinates,
                            rect: annotation.rect,
                            annotationId: annotation.id,
                            dest: annotation.dest,
                            hasValidDestination: destPageNum !== null
                        };
                        
                        pageLinks.push(linkInfo);
                        totalLinks++;
                    } catch (error) {
                        if (debugMode) {
                            console.log(`     ⚠️ Error processing link on page ${pageNum}: ${error.message}`);
                        }
                    }
                }
            }
            
            // Check if this page might contain TOC (only if no bookmarks found)
            let isTOCPage = false;
            if (preprocessedData.toc.source === 'none' && pageNum <= 20) {
                const pageTextLower = combinedText.toLowerCase();
                const tocTerms = ['contents', 'table of contents', 'index'];
                isTOCPage = tocTerms.some(term => pageTextLower.includes(term));
                
                if (isTOCPage) {
                    tocSearchPages.push({
                        pageNum: pageNum,
                        textItems: textContent.items
                    });
                }
            }
            
            // Store page data
            preprocessedData.pages.push({
                pageNumber: pageNum,
                textItems: textItems,
                combinedText: combinedText,
                coordinateBounds: coordinateBounds,
                imageCount: imageCount,
                links: pageLinks,
                isTOCPage: isTOCPage
            });
            
            if (debugMode && pageNum % 10 === 0) {
                console.log(`     📄 Processed ${pageNum}/${pdfDoc.numPages} pages`);
            }
            
        } catch (error) {
            preprocessedData.errors.push(`Page ${pageNum} processing error: ${error.message}`);
            if (debugMode) {
                console.log(`     ❌ Error processing page ${pageNum}: ${error.message}`);
            }
        }
    }
    
    // Add links to main links array
    preprocessedData.links = preprocessedData.pages.flatMap(page => page.links);
    
    // If no bookmarks found, try to parse TOC from text
    if (preprocessedData.toc.source === 'none' && tocSearchPages.length > 0) {
        console.log(`   📑 Parsing TOC from ${tocSearchPages.length} potential TOC pages...`);
        try {
            const tocChapters = [];
            for (const tocPage of tocSearchPages) {
                const tocEntries = parseTOCEntries(tocPage.textItems);
                tocChapters.push(...tocEntries);
            }
            
            if (tocChapters.length > 0) {
                preprocessedData.toc = {
                    source: 'text_parsing',
                    chapters: tocChapters
                };
                console.log(`     ✅ Found ${tocChapters.length} chapters from text parsing`);
            }
        } catch (error) {
            preprocessedData.errors.push(`TOC text parsing error: ${error.message}`);
        }
    }
    
    preprocessedData.processingTime = Date.now() - startTime;
    
    console.log(`   ✅ Preprocessing complete: ${preprocessedData.pages.length} pages, ${totalImages} images, ${totalLinks} links`);
    console.log(`   ⏱️  Processing time: ${preprocessedData.processingTime}ms`);
    
    if (preprocessedData.errors.length > 0) {
        console.log(`   ⚠️ ${preprocessedData.errors.length} errors encountered during preprocessing`);
    }
    
    return preprocessedData;
}

/**
 * Extract chapters from PDF bookmarks/outline
 */
async function extractBookmarksFromOutline(outline, doc, level = 0) {
    const chapters = [];

    for (const item of outline) {
        // Skip non-chapter items like "Contents"
        if (item.title.toLowerCase() === 'contents') {
            continue;
        }

        const chapter = parseChapterFromBookmark(item.title);
        if (chapter) {
            // Try to get page number from destination
            if (item.dest) {
                try {
                    const pageNum = await getPageNumberFromDest(item.dest, doc);
                    chapter.startingPage = pageNum;
                } catch (error) {
                    // Skip chapters without valid page numbers
                    continue;
                }
            }
            chapters.push(chapter);
        }

        if (item.items && item.items.length > 0) {
            const subChapters = await extractBookmarksFromOutline(item.items, doc, level + 1);
            chapters.push(...subChapters);
        }
    }

    return chapters;
}

/**
 * Parse chapter information from bookmark titles
 */
function parseChapterFromBookmark(title) {
    const cleanTitle = title.trim();
    
    // Pattern 1: "Chapter 1: Title" or "Chapter One: Title"
    const chapterMatch = cleanTitle.match(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve):?\s*(.+)/i);
    if (chapterMatch) {
        const chapterNumber = isNaN(chapterMatch[1]) ? 
            convertWordToNumber(chapterMatch[1].toLowerCase()) : 
            parseInt(chapterMatch[1]);
        return {
            chapterNumber: chapterNumber,
            chapterTitle: chapterMatch[2].trim()
        };
    }
    
    // Pattern 2: "1. Title" or "1 Title"
    const numberMatch = cleanTitle.match(/^(\d+)\.?\s+(.+)/);
    if (numberMatch) {
        return {
            chapterNumber: parseInt(numberMatch[1]),
            chapterTitle: numberMatch[2].trim()
        };
    }
    
    // Pattern 3: Roman numerals "I. Title", "II. Title", etc.
    const romanMatch = cleanTitle.match(/^([ivxlcdm]+)\.\s+(.+)/i);
    if (romanMatch) {
        return {
            chapterNumber: convertRomanToNumber(romanMatch[1].toLowerCase()),
            chapterTitle: romanMatch[2].trim()
        };
    }
    
    // Pattern 4: Special chapters
    const specialChapters = ['introduction', 'conclusion', 'epilogue', 'prologue', 'preface', 'foreword', 'afterword'];
    if (specialChapters.includes(cleanTitle.toLowerCase())) {
        return {
            chapterNumber: cleanTitle.toLowerCase(),
            chapterTitle: cleanTitle
        };
    }
    
    return null;
}

/**
 * Get page number from PDF destination reference
 */
async function getPageNumberFromDest(dest, doc) {
    try {
        if (Array.isArray(dest) && dest.length > 0) {
            const pageRef = dest[0];
            if (pageRef && typeof pageRef === 'object' && pageRef.num !== undefined) {
                const pageIndex = await doc.getPageIndex(pageRef);
                return pageIndex + 1; // Convert 0-based to 1-based page number
            }
        }
    } catch (error) {
        throw new Error(`Failed to resolve page reference: ${error.message}`);
    }
    return null;
}

/**
 * Find text content that corresponds to a link annotation
 */
function findTextForAnnotation(annotation, textContent) {
    const rect = annotation.rect; // [x1, y1, x2, y2]
    const [x1, y1, x2, y2] = rect;

    // Find text items that overlap with the annotation rectangle
    const overlappingItems = textContent.items.filter(item => {
        const itemX = item.transform[4];
        const itemY = item.transform[5];
        const itemWidth = item.width || 0;
        const itemHeight = item.height || 12;

        const overlapsX = itemX < x2 && (itemX + itemWidth) > x1;
        const overlapsY = itemY < y2 && (itemY + itemHeight) > y1;

        return overlapsX && overlapsY;
    });

    if (overlappingItems.length === 0) {
        return "Link"; // Fallback
    }

    return overlappingItems.map(item => item.str).join('').trim() || "Link";
}

/**
 * Extract destination coordinates from PDF destination array
 */
function extractDestinationCoordinates(dest) {
    if (!Array.isArray(dest) || dest.length < 5) {
        return null;
    }

    const viewType = dest[1];
    if (viewType && viewType.name === 'XYZ' && typeof dest[2] === 'number' && typeof dest[3] === 'number') {
        return {
            x: dest[2],
            y: dest[3],
            zoom: dest[4] || 0
        };
    }

    return null;
}

/**
 * Parse TOC entries from text items
 */
function parseTOCEntries(textItems) {
    const chapters = [];
    const combinedText = textItems.map(item => item.str).join(' ');
    const lines = combinedText.split(/\n|\r\n|\r/).filter(line => line.trim().length > 0);
    
    for (const line of lines) {
        const chapter = parseTOCLine(line.trim());
        if (chapter) {
            chapters.push(chapter);
        }
    }
    
    return chapters;
}

/**
 * Parse a single TOC line for chapter information
 */
function parseTOCLine(line) {
    // Match patterns like "Chapter 1: Title ... 15" or "1. Title ... 15"
    const patterns = [
        /^chapter\s+(\d+):?\s*(.+?)\s*\.+\s*(\d+)$/i,
        /^(\d+)\.\s*(.+?)\s*\.+\s*(\d+)$/,
        /^([ivx]+)\.\s*(.+?)\s*\.+\s*(\d+)$/i
    ];
    
    for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
            return {
                chapterNumber: isNaN(match[1]) ? match[1] : parseInt(match[1]),
                chapterTitle: match[2].trim(),
                startingPage: parseInt(match[3])
            };
        }
    }
    
    return null;
}

/**
 * Helper functions for number conversion
 */
function convertWordToNumber(word) {
    const wordNumbers = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12
    };
    return wordNumbers[word] || word;
}

function convertRomanToNumber(roman) {
    const romanNumbers = {
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
        'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
    };
    return romanNumbers[roman] || roman;
}

module.exports = {
    preprocessPDF,
    extractBookmarksFromOutline,
    parseChapterFromBookmark,
    getPageNumberFromDest,
    findTextForAnnotation,
    extractDestinationCoordinates,
    parseTOCEntries,
    parseTOCLine
}; 