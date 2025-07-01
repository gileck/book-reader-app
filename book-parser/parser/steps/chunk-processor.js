/**
 * Chunk Processor Module
 * 
 * Handles processing of text chunks and associating them with images and links.
 * 
 * @module chunk-processor
 */

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const fs = require('fs');
const path = require('path');
const { chunkTextWithParagraphs } = require('./text-processor');

/**
 * Create page-aware chunks with associated images and links
 * 
 * @param {Array} chapters - Array of chapter objects with chunks
 * @param {Array} images - Array of extracted images with page numbers
 * @param {Array} links - Array of extracted links with page numbers
 * @returns {Array} All chunks with associated images and links
 * 
 * @example
 * const allChunks = createPageAwareChunksWithImages(chapters, images, links);
 * // Returns: Array of chunks with { id, chapterNumber, chapterTitle, images, links, pageNumber }
 */
async function createPageAwareChunksWithImages(chapters, images, links = []) {
    const allChunks = [];
    let chunkId = 1;

    // First pass: create basic chunks
    chapters.forEach(chapter => {
        const pageNumbers = new Set();
        
        // Skip chapters without chunks but ensure they have basic properties
        if (!chapter.chunks || !Array.isArray(chapter.chunks)) {
            chapter.pageNumbers = [];
            chapter.startPageNumber = chapter.startPageNumber || chapter.startingPage || 1;
            chapter.endPageNumber = chapter.endPageNumber || chapter.endingPage || 1;
            return;
        }
        
        // Map startingPage/endingPage to startPageNumber/endPageNumber if needed
        if (!chapter.startPageNumber && chapter.startingPage) {
            chapter.startPageNumber = chapter.startingPage;
        }
        if (!chapter.endPageNumber && chapter.endingPage) {
            chapter.endPageNumber = chapter.endingPage;
        }
        
        // Calculate page numbers for chunks based on their position in the chapter
        const chapterPageRange = chapter.endPageNumber - chapter.startPageNumber + 1;
        const chunksPerPage = Math.ceil(chapter.chunks.length / chapterPageRange);
        
        chapter.chunks.forEach((chunk, index) => {
            chunk.id = chunkId++;
            chunk.index = chunkId - 1; // Add index property for link resolution
            chunk.chapterNumber = chapter.chapterNumber || chapter.number;
            chunk.chapterTitle = chapter.title;
            chunk.links = []; // Initialize empty links array
            
            // Assign page number based on chunk position within chapter
            if (!chunk.pageNumber) {
                const pageIndex = Math.floor(index / chunksPerPage);
                chunk.pageNumber = chapter.startPageNumber + Math.min(pageIndex, chapterPageRange - 1);
            }
            
            if (chunk.pageNumber) {
                pageNumbers.add(chunk.pageNumber);
            }
            
            allChunks.push(chunk);
        });
        
        chapter.pageNumbers = Array.from(pageNumbers).sort((a, b) => a - b);
        
        // Set page numbers with fallbacks for empty pageNumbers
        if (chapter.pageNumbers.length > 0) {
            chapter.startPageNumber = Math.min(...chapter.pageNumbers);
            chapter.endPageNumber = Math.max(...chapter.pageNumbers);
        } else {
            // Fallback to existing values from TOC extraction or defaults
            chapter.startPageNumber = chapter.startPageNumber || chapter.startingPage || 1;
            chapter.endPageNumber = chapter.endPageNumber || chapter.endingPage || chapter.startPageNumber || 1;
        }

        // Add images to chapter based on page range
        chapter.images = [];
        if (chapter.startPageNumber && chapter.endPageNumber) {
            for (let pageNum = chapter.startPageNumber; pageNum <= chapter.endPageNumber; pageNum++) {
                const pageImages = images.filter(img => img.pageNumber === pageNum);
                pageImages.forEach(img => {
                    chapter.images.push({
                        imageName: img.imageName,
                        pageNumber: img.pageNumber
                    });
                });
            }
        }
    });

    return allChunks;
}

/**
 * Add coordinate bounds to chunks based on page layout
 * @param {Array} allChunks - Array of chunks to enhance with coordinates
 * @param {string} pdfPath - Path to the PDF file for coordinate extraction
 * @returns {Array} Chunks with coordinate bounds added
 */
async function addCoordinateBoundsToChunks(allChunks, pdfPath) {
    if (!pdfPath || !fs.existsSync(pdfPath)) {
        console.warn('PDF path not provided or doesn\'t exist, skipping coordinate bounds calculation');
        return allChunks;
    }

    try {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

        // Group chunks by page for efficient processing
        const chunksByPage = new Map();
        allChunks.forEach(chunk => {
            if (!chunksByPage.has(chunk.pageNumber)) {
                chunksByPage.set(chunk.pageNumber, []);
            }
            chunksByPage.get(chunk.pageNumber).push(chunk);
        });

        // Process each page
        for (const [pageNumber, pageChunks] of chunksByPage) {
            try {
                const page = await pdf.getPage(pageNumber);
                const textContent = await page.getTextContent();
                const viewport = page.getViewport({ scale: 1.0 });

                // Calculate page bounds from text content
                const pageBounds = calculatePageBounds(textContent, viewport);
                
                // Assign coordinate bounds to each chunk based on its position on the page
                pageChunks.forEach((chunk, index) => {
                    chunk.coordinateBounds = estimateChunkCoordinates(
                        chunk, 
                        index, 
                        pageChunks.length, 
                        pageBounds
                    );
                });

            } catch (pageError) {
                console.warn(`Could not process page ${pageNumber} for coordinates:`, pageError.message);
                // Add fallback coordinate bounds for chunks on this page
                chunksByPage.get(pageNumber).forEach((chunk, index) => {
                    chunk.coordinateBounds = {
                        minX: 0,
                        maxX: 595, // Standard PDF page width
                        minY: index * 50,
                        maxY: (index + 1) * 50,
                        centerX: 297.5,
                        centerY: index * 50 + 25
                    };
                });
            }
        }

    } catch (error) {
        console.warn('Error adding coordinate bounds to chunks:', error.message);
    }

    return allChunks;
}

/**
 * Calculate page bounds from text content
 * @param {Object} textContent - PDF text content
 * @param {Object} viewport - PDF viewport
 * @returns {Object} Page bounds
 */
function calculatePageBounds(textContent, viewport) {
    if (!textContent.items || textContent.items.length === 0) {
        return {
            minX: 0,
            maxX: viewport.width,
            minY: 0,
            maxY: viewport.height
        };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    textContent.items.forEach(item => {
        const x = item.transform[4];
        const y = item.transform[5];
        const width = item.width || 0;
        const height = item.height || 12;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + width);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + height);
    });

    return { minX, maxX, minY, maxY };
}

/**
 * Estimate coordinate bounds for a text chunk within a page
 * @param {Object} chunk - Text chunk object
 * @param {number} chunkIndex - Index of chunk within page
 * @param {number} totalChunks - Total chunks on page
 * @param {Object} pageCoordinateBounds - Page coordinate bounds
 * @returns {Object|null} Estimated coordinate bounds or null
 */
function estimateChunkCoordinates(chunk, chunkIndex, totalChunks, pageCoordinateBounds) {
    if (!pageCoordinateBounds) return null;

    const { minX, maxX, minY, maxY } = pageCoordinateBounds;

    // Estimate vertical position based on chunk position in page
    const heightPerChunk = (maxY - minY) / totalChunks;
    const estimatedMinY = minY + (chunkIndex * heightPerChunk);
    const estimatedMaxY = estimatedMinY + heightPerChunk;

    return {
        minX,
        maxX,
        minY: estimatedMinY,
        maxY: estimatedMaxY,
        centerX: (minX + maxX) / 2,
        centerY: (estimatedMinY + estimatedMaxY) / 2
    };
}

/**
 * Process a chapter and create chunks with paragraph structure
 * @param {Object} chapter - Chapter object with text content
 * @param {string} debugDir - Directory for debug output
 * @returns {Object} Chapter with paragraph-structured chunks
 */
function processChapter(chapter, debugDir) {

    
    // Create paragraphs with chunks for each page
    let allParagraphs = [];
    let globalChunkIndex = 0;
    
    // Group pages by content and process each page
    for (let pageIndex = 0; pageIndex < chapter.pages.length; pageIndex++) {
        const page = chapter.pages[pageIndex];
        
        if (!page.text || page.text.trim().length === 0) {
            continue;
        }
        
        
        
        // Use new paragraph-aware chunking
        const pageParagraphs = chunkTextWithParagraphs(
            page.text, 
            5,  // minWords
            15, // maxWords  
            page.pageNumber
        );
        
        // Update global chunk indices
        for (const paragraph of pageParagraphs) {
            for (const chunk of paragraph.chunks) {
                chunk.globalIndex = globalChunkIndex++;
                chunk.pageNumber = page.pageNumber; // Ensure chunk has page number
            }
        }
        
        allParagraphs.push(...pageParagraphs);
    }
    
    // Create the updated chapter structure
    const processedChapter = {
        ...chapter,
        content: {
            paragraphs: allParagraphs,
            totalChunks: globalChunkIndex,
            // Maintain backward compatibility by also providing flat chunks
            chunks: flattenParagraphsToChunks(allParagraphs)
        }
    };
    
    // Save debug information
    if (debugDir) {
        const debugFile = path.join(debugDir, 'step6-chapters-with-paragraphs.json');
        const debugData = {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            paragraphCount: allParagraphs.length,
            totalChunks: globalChunkIndex,
            paragraphs: allParagraphs.map(p => ({
                id: p.id,
                type: p.type,
                pageNumber: p.pageNumber,
                chunkCount: p.chunks.length,
                chunks: p.chunks.map(c => ({
                    id: c.id,
                    globalIndex: c.globalIndex,
                    text: c.text.substring(0, 100) + (c.text.length > 100 ? '...' : ''),
                    wordCount: c.wordCount
                }))
            }))
        };
        
        fs.writeFileSync(debugFile, JSON.stringify(debugData, null, 2));
    }
    
    return processedChapter;
}

/**
 * Flatten paragraph structure to chunks for backward compatibility
 * @param {Array} paragraphs - Array of paragraph objects
 * @returns {Array} Flat array of chunks with paragraph info
 */
function flattenParagraphsToChunks(paragraphs) {
    const allChunks = [];
    
    for (const paragraph of paragraphs) {
        for (const chunk of paragraph.chunks) {
            allChunks.push({
                ...chunk,
                paragraphId: paragraph.id,
                paragraphType: paragraph.type,
                type: paragraph.type === 'header' ? 'header' : 'text'
            });
        }
    }
    
    return allChunks;
}

/**
 * Create a global chunk index mapping for link resolution
 * @param {Array} paragraphs - Array of paragraph objects
 * @returns {Map} Map from globalIndex to {paragraphId, chunkId}
 */
function createGlobalChunkMapping(paragraphs) {
    const mapping = new Map();
    
    for (const paragraph of paragraphs) {
        for (const chunk of paragraph.chunks) {
            mapping.set(chunk.globalIndex, {
                paragraphId: paragraph.id,
                chunkId: chunk.id,
                paragraph: paragraph,
                chunk: chunk
            });
        }
    }
    
    return mapping;
}

module.exports = {
    createPageAwareChunksWithImages,
    addCoordinateBoundsToChunks,
    processChapter,
    flattenParagraphsToChunks,
    createGlobalChunkMapping
}; 