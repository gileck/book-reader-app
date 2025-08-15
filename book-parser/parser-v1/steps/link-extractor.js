const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

/**
 * Extract internal links from PDF and correlate with text positions
 * @param {string} pdfPath - Path to PDF file
 * @returns {Array} Array of internal link objects with coordinates and navigation info
 */
async function extractInternalLinks(pdfPath) {


    try {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

        const allLinks = [];
        let totalLinks = 0;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const annotations = await page.getAnnotations();
                const textContent = await page.getTextContent();



                // Filter for link annotations that are internal to the document
                const linkAnnotations = annotations.filter(annotation => {
                    return annotation.subtype === 'Link' &&
                        annotation.dest && // Has internal destination
                        !annotation.url;   // Not an external URL
                });

                if (linkAnnotations.length === 0) continue;



                for (const annotation of linkAnnotations) {
                    try {
                        // Get destination page
                        const destPageNum = await getPageNumberFromDest(annotation.dest, pdf);

                        // Find the text that corresponds to this link
                        const linkText = findTextForAnnotation(annotation, textContent);

                        // Extract destination coordinates from the dest array
                        const destinationCoordinates = extractDestinationCoordinates(annotation.dest);

                        const linkInfo = {
                            pageNumber: pageNum,
                            linkText: linkText,
                            destinationPage: destPageNum,
                            destinationCoordinates: destinationCoordinates,
                            rect: annotation.rect, // Position on source page
                            annotationId: annotation.id,
                            dest: annotation.dest,
                            hasValidDestination: destPageNum !== null,
                            navigationType: determineNavigationType(linkText, destinationCoordinates)
                        };

                        allLinks.push(linkInfo);
                        totalLinks++;

                    } catch (error) {
                        // Skip invalid links silently
                    }
                }

            } catch (pageError) {
                // Skip pages with errors silently
            }
        }

        return allLinks;

    } catch (error) {
        return [];
    }
}

/**
 * Get page number from PDF destination reference
 * @param {Array} dest - PDF destination array
 * @param {Object} pdf - PDF document object
 * @returns {number|null} Page number (1-based) or null if not found
 */
async function getPageNumberFromDest(dest, pdf) {
    try {
        // dest is usually an array where the first element contains page reference
        if (Array.isArray(dest) && dest.length > 0) {
            const pageRef = dest[0];
            if (pageRef && typeof pageRef === 'object' && pageRef.num !== undefined) {
                // Get page index from reference
                const pageIndex = await pdf.getPageIndex(pageRef);
                return pageIndex + 1; // Convert 0-based to 1-based page number
            }
        }
    } catch (error) {
        throw new Error(`Failed to resolve page reference: ${error.message}`);
    }
    return null;
}

/**
 * Find the text content that corresponds to a link annotation
 * @param {Object} annotation - PDF annotation object
 * @param {Object} textContent - PDF text content object
 * @returns {string} Text content of the link
 */
function findTextForAnnotation(annotation, textContent) {
    const rect = annotation.rect; // [x1, y1, x2, y2]
    const [x1, y1, x2, y2] = rect;

    // Find text items that are primarily within the annotation rectangle
    const overlappingItems = textContent.items.filter(item => {
        const itemX = item.transform[4];
        const itemY = item.transform[5];
        const itemWidth = item.width || 0;
        const itemHeight = item.height || 12; // Approximate height

        // Calculate the center of the text item
        const itemCenterX = itemX + (itemWidth / 2);
        const itemCenterY = itemY + (itemHeight / 2);
        
        // Check if the text item's center is within the annotation bounds
        // This is more precise than checking for any overlap
        const centerInBounds = itemCenterX >= x1 && itemCenterX <= x2 && 
                              itemCenterY >= y1 && itemCenterY <= y2;
        
        // Also check for significant overlap (at least 50% of the text item)
        const overlapX = Math.max(0, Math.min(itemX + itemWidth, x2) - Math.max(itemX, x1));
        const overlapY = Math.max(0, Math.min(itemY + itemHeight, y2) - Math.max(itemY, y1));
        const overlapArea = overlapX * overlapY;
        const itemArea = itemWidth * itemHeight;
        const significantOverlap = itemArea > 0 && (overlapArea / itemArea) >= 0.5;

        return centerInBounds || significantOverlap;
    });

    if (overlappingItems.length === 0) {
        return "Link"; // Fallback for links without readable text
    }

    // Sort by position and combine text items
    const sortedItems = overlappingItems.sort((a, b) => {
        const aY = a.transform[5];
        const bY = b.transform[5];
        const aX = a.transform[4];
        const bX = b.transform[4];
        
        // Sort by Y position first (top to bottom), then X position (left to right)
        if (Math.abs(aY - bY) > 5) { // Different lines
            return bY - aY; // Higher Y values first (PDF coordinates)
        }
        return aX - bX; // Left to right
    });

    // Combine text, but limit to reasonable length for footnotes
    let linkText = sortedItems
        .map(item => item.str)
        .join('')
        .trim();

    // For very small rectangles (likely footnotes), limit to short text
    const rectWidth = x2 - x1;
    const rectHeight = y2 - y1;
    const isSmallRect = rectWidth < 20 && rectHeight < 20;
    
    if (isSmallRect && linkText.length > 10) {
        // For small rectangles, try to extract just the relevant part
        const words = linkText.split(/\s+/);
        if (words.length > 1) {
            // Take the first word if it looks like a footnote number/symbol
            const firstWord = words[0];
            if (/^[0-9a-zA-Z\*\†\‡\§]{1,3}$/.test(firstWord)) {
                linkText = firstWord;
            }
        }
    }

    return linkText || "Link";
}

/**
 * Extract destination coordinates from PDF destination array
 * @param {Array} dest - PDF destination array
 * @returns {Object|null} Coordinates object {x, y, zoom} or null
 */
function extractDestinationCoordinates(dest) {
    if (!Array.isArray(dest) || dest.length < 5) {
        return null;
    }

    // PDF destination format: [pageRef, viewType, x, y, zoom]
    // Example: [{"num":954,"gen":0}, {"name":"XYZ"}, 76.502495, 554.54999, 0]
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
 * Determine the best navigation method based on link characteristics  
 * @param {string} linkText - Text content of the link
 * @param {Object|null} destinationCoordinates - Destination coordinates
 * @returns {string} Navigation type: 'coordinate', 'pattern', or 'text-search'
 */
function determineNavigationType(linkText, destinationCoordinates) {
    // If we have precise coordinates, use them
    if (destinationCoordinates) {
        return 'coordinate';
    }

    // For short numeric/symbolic text (likely footnotes), use pattern matching
    if (linkText && linkText.trim().length <= 3 && /^[0-9a-zA-Z\*\†\‡\§]+$/.test(linkText.trim())) {
        return 'pattern';
    }

    // For longer text, use text search
    return 'text-search';
}

/**
 * Generate navigation data for app usage
 * @param {string} linkText - Text content of the link
 * @param {number} destinationPage - Destination page number
 * @param {Object|null} destinationCoordinates - Destination coordinates
 * @param {string} navigationType - Type of navigation
 * @returns {Object} Navigation data object
 */
function generateNavigationData(linkText, destinationPage, destinationCoordinates, navigationType) {
    const navData = {
        destinationPage,
        navigationType,
        linkText
    };

    switch (navigationType) {
        case 'coordinate':
            navData.coordinates = destinationCoordinates;
            navData.searchPattern = generateSearchPattern(linkText);
            break;

        case 'pattern':
            navData.searchPattern = generateSearchPattern(linkText);
            break;

        case 'text-search':
            navData.searchText = linkText;
            navData.exactMatch = linkText.length < 50; // Shorter text = exact match
            break;
    }

    return navData;
}

/**
 * Generate smart search pattern for footnotes and references
 * @param {string} linkText - Text content of the link
 * @returns {string|null} Search pattern regex or null
 */
function generateSearchPattern(linkText) {
    if (!linkText || linkText.trim().length === 0) {
        return null;
    }

    const cleanText = linkText.trim();

    // For single characters or short sequences (footnotes)
    if (cleanText.length <= 3) {
        // Match at start of line/paragraph: "1 " or "1." or "1)"
        return `^\\s*${escapeRegExp(cleanText)}[\\s\\.\\)\\:]`;
    }

    // For longer text, use exact match
    return escapeRegExp(cleanText);
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate link destinations against parsed chapter content
 * @param {Array} links - Array of link objects
 * @param {Array} chapters - Array of chapter objects with pages data
 * @returns {Array} Array of validated link objects
 */
function validateLinkDestinations(links, chapters) {


    // Create a map of all pages with content in our chapters
    const pagesWithContent = new Map();
    const pageToChapter = new Map();

    chapters.forEach(chapter => {
        if (chapter.pages && chapter.pages.length > 0) {
            chapter.pages.forEach(page => {
                pagesWithContent.set(page.pageNumber, {
                    hasContent: page.text && page.text.trim().length > 0,
                    textLength: page.text ? page.text.length : 0,
                    chapter: chapter
                });
                pageToChapter.set(page.pageNumber, chapter);
            });
        }
    });

    const validatedLinks = [];
    let validCount = 0;
    let invalidCount = 0;
    let outOfRangeCount = 0;
    let emptyPageCount = 0;

    for (const link of links) {
        const validation = {
            ...link,
            isValid: true,
            validationFlags: [],
            destinationChapter: null,
            destinationHasContent: false
        };

        // Check if destination page exists in our parsed content
        if (!pagesWithContent.has(link.destinationPage)) {
            validation.isValid = false;
            validation.validationFlags.push('DESTINATION_PAGE_NOT_FOUND');
            outOfRangeCount++;
        } else {
            const destPageInfo = pagesWithContent.get(link.destinationPage);
            validation.destinationHasContent = destPageInfo.hasContent;
            validation.destinationChapter = destPageInfo.chapter.title;

            // Check if destination page has meaningful content
            if (!destPageInfo.hasContent) {
                validation.validationFlags.push('DESTINATION_PAGE_EMPTY');
                emptyPageCount++;
            }

            // Check if destination page has very little content (might be a page number only)
            if (destPageInfo.textLength < 50) {
                validation.validationFlags.push('DESTINATION_PAGE_MINIMAL_CONTENT');
            }
        }

        // Check if link text is meaningful
        if (!link.linkText || link.linkText.trim().length === 0) {
            validation.validationFlags.push('EMPTY_LINK_TEXT');
        }

        // Check if it's a self-referencing link (same page)
        if (link.pageNumber === link.destinationPage) {
            validation.validationFlags.push('SELF_REFERENCING_LINK');
        }

        // Mark as invalid if there are critical validation issues
        if (validation.validationFlags.includes('DESTINATION_PAGE_NOT_FOUND')) {
            validation.isValid = false;
            invalidCount++;
        } else {
            validCount++;
        }

        validatedLinks.push(validation);
    }



    return validatedLinks;
}

module.exports = {
    extractInternalLinks,
    getPageNumberFromDest,
    findTextForAnnotation,
    extractDestinationCoordinates,
    determineNavigationType,
    generateNavigationData,
    generateSearchPattern,
    escapeRegExp,
    validateLinkDestinations
}; 