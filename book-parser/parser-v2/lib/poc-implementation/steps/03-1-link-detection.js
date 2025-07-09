const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

/**
 * Step 3-1: Link Detection and Resolution
 * 
 * Takes pages from Step 3 and adds link information by:
 * 1. Extracting internal links from the PDF using existing logic
 * 2. Mapping link text to page content 
 * 3. Resolving link destinations to target pages and text
 * 4. Adding a "links" array to each page with all links found on that page
 * 
 * Input: pages[] from Step 3
 * Output: pages[] with links array added to each page
 */

/**
 * Execute link detection step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated pipeline state with links added to pages
 */
async function execute(pipelineState, config) {
    console.log('🔗 Starting link detection and resolution (Step 3-1)...');
    
    const startTime = Date.now();
    
    try {
        // Validate prerequisites
        if (!pipelineState.chapters || pipelineState.chapters.length === 0) {
            throw new Error('Step 3 (page extraction) must be completed first. No chapters found in pipeline state.');
        }
        
        // Check if PDF path is available
        if (!config.PDF_PATH || !fs.existsSync(config.PDF_PATH)) {
            throw new Error('PDF file is required for link extraction. Check PDF_PATH in config.');
        }
        
        console.log(`🔗 Extracting links from PDF: ${config.PDF_PATH}`);
        
        // Load PDF document for link extraction and coordinate-based text extraction
        const pdfBuffer = fs.readFileSync(config.PDF_PATH);
        const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
        
        // Extract all internal links from PDF
        const pdfLinks = await extractInternalLinksFromPDF(config.PDF_PATH, pdf);
        console.log(`📎 Found ${pdfLinks.length} internal links in PDF`);
        
        // Process each chapter
        const processedChapters = [];
        let totalLinksAdded = 0;
        
        for (const chapter of pipelineState.chapters) {
            console.log(`  🔗 Processing links for chapter: ${chapter.title}`);
            
            // Add links to each page in the chapter
            const pagesWithLinks = await addLinksToPages(chapter.pages, pdfLinks, pdf);
            const chapterLinksCount = pagesWithLinks.reduce((sum, page) => sum + (page.links ? page.links.length : 0), 0);
            totalLinksAdded += chapterLinksCount;
            
            const processedChapter = {
                ...chapter,
                pages: pagesWithLinks
            };
            
            processedChapters.push(processedChapter);
            console.log(`    ✅ Added ${chapterLinksCount} links to ${pagesWithLinks.length} pages`);
        }
        
        // Generate debug output
        const debugOutput = {
            linkDetectionMetadata: {
                totalLinks: totalLinksAdded,
                totalPdfLinks: pdfLinks.length,
                processingTime: Date.now() - startTime,
                detectionTime: new Date().toISOString(),
                note: "Link detection and resolution from PDF annotations"
            },
            pdfLinks: pdfLinks,
            chapters: processedChapters
        };
        
        const debugFile = path.join(config.DEBUG_DIR, 'step-03-1-link-detection.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
        
        console.log(`✅ Link detection completed: ${totalLinksAdded} links added to pages`);
        console.log(`📊 Processing took ${Date.now() - startTime}ms`);
        console.log(`📄 Debug output: ${debugFile}`);
        
        return {
            chapters: processedChapters,
            metadata: {
                ...pipelineState.metadata,
                linkDetection: {
                    totalLinks: totalLinksAdded,
                    totalPdfLinks: pdfLinks.length,
                    processingTime: Date.now() - startTime,
                    detectionTime: new Date().toISOString()
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Link detection failed:', error.message);
        throw error;
    }
}

/**
 * Extract internal links from PDF using existing logic
 * @param {string} pdfPath - Path to PDF file
 * @param {Object} pdf - PDF document object (optional, will load from path if not provided)
 * @returns {Array} Array of internal link objects
 */
async function extractInternalLinksFromPDF(pdfPath, pdf = null) {
    try {
        // Load PDF if not provided
        if (!pdf) {
            const pdfBuffer = fs.readFileSync(pdfPath);
            pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
        }

        const allLinks = [];

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
                            pageNumber: pageNum - 1,  // Convert to 0-based page numbering
                            linkText: linkText,
                            destinationPage: destPageNum,
                            destinationCoordinates: destinationCoordinates,
                            rect: annotation.rect, // Position on source page
                            annotationId: annotation.id,
                            dest: annotation.dest,
                            hasValidDestination: destPageNum !== null
                        };

                        allLinks.push(linkInfo);

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
        console.error('Error extracting links from PDF:', error);
        return [];
    }
}

/**
 * Get page number from PDF destination reference
 * @param {Array} dest - PDF destination array
 * @param {Object} pdf - PDF document object
 * @returns {number|null} Page number (0-based book page) or null if not found
 */
async function getPageNumberFromDest(dest, pdf) {
    try {
        if (Array.isArray(dest) && dest.length > 0) {
            const pageRef = dest[0];
            if (pageRef && typeof pageRef === 'object' && pageRef.num !== undefined) {
                const pageIndex = await pdf.getPageIndex(pageRef);
                return pageIndex; // Return 0-based page numbers to align with book pages
            }
        }
    } catch (error) {
        // Return null if can't resolve
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
 * Check if a link text is a valid footnote/reference link
 * @param {string} linkText - The extracted link text
 * @param {string} pageContent - The full page content
 * @returns {boolean} True if it's a valid link
 */
function isValidLinkText(linkText, pageContent) {
    // Skip if it's part of a larger word (like years: 1930s, page numbers, etc.)
    const linkPattern = new RegExp(`\\b${linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const standalonePattern = new RegExp(`(?:^|\\s|\\.|,|;|:)\\s*${linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?=\\s|$|\\n)`, 'g');
    
    // Check if the link text appears as a standalone element (not part of a larger word)
    const standaloneMatches = pageContent.match(standalonePattern);
    const wordMatches = pageContent.match(linkPattern);
    
    // If we have standalone matches, it's likely a valid footnote
    if (standaloneMatches && standaloneMatches.length > 0) {
        return true;
    }
    
    // If it only appears as part of larger words (like "1930s"), it's not a valid footnote
    if (wordMatches && wordMatches.length === 0) {
        return false;
    }
    
    // Additional checks for common false positives
    
    // Skip single digits that are likely part of years, page numbers, etc.
    if (/^\d$/.test(linkText)) {
        // Check if it's part of a year pattern (like 1930s, 1940s, etc.)
        const yearPattern = new RegExp(`\\d{3}${linkText}\\w*`, 'g');
        if (pageContent.match(yearPattern)) {
            return false;
        }
        
        // Check if it's part of a page range (like "pages 286 – 7")
        const pageRangePattern = new RegExp(`\\d+\\s*[–−-]\\s*${linkText}`, 'g');
        if (pageContent.match(pageRangePattern)) {
            return false;
        }
        
        // Check if it's part of other numeric patterns
        const numericPattern = new RegExp(`\\d+[.,]?${linkText}\\d*`, 'g');
        if (pageContent.match(numericPattern)) {
            return false;
        }
    }
    
    return true;
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
 * Add links to pages by mapping PDF links to page content and also detecting text-based footnotes
 * @param {Array} pages - Array of page objects
 * @param {Array} pdfLinks - Array of PDF link objects
 * @param {Object} pdf - PDF document object (optional, for coordinate-based text extraction)
 * @returns {Array} Pages with links added
 */
async function addLinksToPages(pages, pdfLinks, pdf = null) {
    // Safety checks
    if (!pages || !Array.isArray(pages)) {
        console.error('addLinksToPages: pages is not an array:', pages);
        return pages || [];
    }
    if (!pdfLinks || !Array.isArray(pdfLinks)) {
        console.error('addLinksToPages: pdfLinks is not an array:', pdfLinks);
        return pages;
    }
    
    const linkRegistry = new Map(); // Track all links by ID
    const existingConnections = new Set(); // Track existing page connections to avoid reverse links
    let linkIdCounter = 1;

    // Initialize all pages with empty link arrays first
    const pagesWithLinks = pages.map(page => ({
        ...page,
        tempLinkSources: [],
        tempLinkTargets: []
    }));

    // First pass: collect all links and assign IDs
    for (const page of pages) {
        // Safety check for page object
        if (!page || typeof page.pageNumber !== 'number' || typeof page.content !== 'string') {
            console.error('addLinksToPages: Invalid page object:', page);
            continue;
        }
        
        // Find PDF links that originate from this page
        const pageLinks = pdfLinks.filter(link => link && link.pageNumber === page.pageNumber);
        
        // Process each PDF link to find it in the page content and resolve destination
        const pageLinkSources = [];
        
        for (const pdfLink of pageLinks) {
            // Validate that this is actually a valid link (not part of a larger word like "1930s")
            if (!isValidLinkText(pdfLink.linkText, page.content)) {
                continue; // Skip invalid links
            }
            
            // Look for the link text in the page content
            let linkInContent = findLinkInPageContent(page.content, pdfLink.linkText);
            let actualSourcePage = page.pageNumber;
            
            // If not found on the expected page, check nearby pages (±5) for PDF annotation misalignment
            if (!linkInContent) {
                // Check within a wider range (±5 pages) for annotation misalignment
                for (let offset = 1; offset <= 5; offset++) {
                    // Check previous pages
                    const prevPage = pages.find(p => p.pageNumber === page.pageNumber - offset);
                    if (prevPage) {
                        const prevPageLink = findLinkInPageContent(prevPage.content, pdfLink.linkText);
                        if (prevPageLink && isValidLinkText(pdfLink.linkText, prevPage.content)) {
                            linkInContent = prevPageLink;
                            actualSourcePage = prevPage.pageNumber;
                            break;
                        }
                    }
                    
                    // Check next pages
                    if (!linkInContent) {
                        const nextPage = pages.find(p => p.pageNumber === page.pageNumber + offset);
                        if (nextPage) {
                            const nextPageLink = findLinkInPageContent(nextPage.content, pdfLink.linkText);
                            if (nextPageLink && isValidLinkText(pdfLink.linkText, nextPage.content)) {
                                linkInContent = nextPageLink;
                                actualSourcePage = nextPage.pageNumber;
                                break;
                            }
                        }
                    }
                }
            }
        

            
                        if (linkInContent) {
                // Check for reverse link to avoid creating bidirectional connections
                const connectionKey = `${actualSourcePage}-${pdfLink.destinationPage}`;
                const reverseConnectionKey = `${pdfLink.destinationPage}-${actualSourcePage}`;
                
                // Skip this link if the reverse connection already exists
                if (existingConnections.has(reverseConnectionKey)) {
                    console.log(`Skipping reverse link: ${actualSourcePage} -> ${pdfLink.destinationPage} (reverse of existing ${pdfLink.destinationPage} -> ${actualSourcePage})`);
                    continue;
                }
                
                // Also skip if we already have a forward connection to the same destination
                // This handles cases where cross-page merging moved text and we find the link on a different page
                const existingForwardConnection = Array.from(existingConnections).find(conn => {
                    const [source, dest] = conn.split('-').map(Number);
                    return dest === pdfLink.destinationPage && Math.abs(source - actualSourcePage) <= 1;
                });
                
                if (existingForwardConnection && existingForwardConnection !== connectionKey) {
                    console.log(`Skipping duplicate link: ${actualSourcePage} -> ${pdfLink.destinationPage} (already have connection ${existingForwardConnection})`);
                    continue;
                }
                
                // Skip reverse annotation links if we already have a forward link from any source to this footnote page
                // This prevents footnote definitions from creating separate links when the source text moved due to cross-page merging
                const isFootnotePage = (pageNum) => {
                    // Check if this page contains footnote definitions (look for numbered footnotes)
                    const page = pages.find(p => p.pageNumber === pageNum);
                    if (!page) return false;
                    return /\d+\s+[A-Z]/.test(page.content); // Pattern for footnotes like "1 When I talk about..."
                };
                
                // If this is a reverse annotation from a footnote page, skip it if we already have the forward link
                if (isFootnotePage(actualSourcePage)) {
                    const hasForwardLinkToThisFootnotePage = Array.from(existingConnections).some(conn => {
                        const [source, dest] = conn.split('-').map(Number);
                        return dest === actualSourcePage; // Any forward link pointing to this footnote page
                    });
                    
                    if (hasForwardLinkToThisFootnotePage) {
                        console.log(`Skipping reverse annotation link from footnote page: ${actualSourcePage} -> ${pdfLink.destinationPage} (already have forward link to footnote page ${actualSourcePage})`);
                        continue;
                    }
                }
                
                // Generate unique link ID using the actual source page
                const linkId = `link_${actualSourcePage}_${linkIdCounter++}`;
                
                // Find destination text if we have a valid destination page
                let destinationText = null;
                if (pdfLink.hasValidDestination && pdfLink.destinationPage) {
                    destinationText = await findDestinationText(pages, pdfLink.destinationPage, pdfLink.destinationCoordinates, pdfLink.linkText, pdf);
                }

                const linkSource = {
                    linkId: linkId,
                    sourcePageNumber: actualSourcePage,
                    sourceText: pdfLink.linkText,
                    targetPageNumber: pdfLink.destinationPage,
                    targetText: destinationText,
                    type: 'pdf_annotation',
                    role: 'source'
                };
                
                // Add to the correct page's links array in the pagesWithLinks array (not the original pages array)
                const correctPage = pagesWithLinks.find(p => p.pageNumber === actualSourcePage);
                if (correctPage) {
                    if (!correctPage.tempLinkSources) correctPage.tempLinkSources = [];
                    correctPage.tempLinkSources.push(linkSource);
                }
                
                // Register link in global registry
                linkRegistry.set(linkId, {
                    id: linkId,
                    sourcePage: actualSourcePage,
                    sourceText: pdfLink.linkText,
                    targetPage: pdfLink.destinationPage,
                    targetText: destinationText,
                    type: 'pdf_annotation'
                });
                
                // Mark this connection as existing to prevent reverse links
                existingConnections.add(connectionKey);
            }
        }
        
        // Also look for potential footnote patterns in the text that might not be PDF links
        // TODO: Temporarily disabled - only using PDF annotations for now
        // const textBasedFootnotes = detectTextBasedFootnotes(page.content, page.pageNumber, pages, linkIdCounter);
        // 
        // // Update counter and register footnote links
        // for (const footnote of textBasedFootnotes) {
        //     linkRegistry.set(footnote.linkId, {
        //         id: footnote.linkId,
        //         sourcePage: page.pageNumber,
        //         sourceText: footnote.text,
        //         targetPage: footnote.targetPage,
        //         targetText: footnote.targetText,
        //         type: 'text_based_footnote'
        //     });
        //     linkIdCounter++;
        // }
        // 
        // pageLinkSources.push(...textBasedFootnotes);
    }

    // Second pass: mark pages that are link targets
    for (const page of pagesWithLinks) {
        const pageTargets = [];
        
        // Find all links that target this page
        for (const [linkId, linkInfo] of linkRegistry) {
            if (linkInfo.targetPage === page.pageNumber) {
                pageTargets.push({
                    linkId: linkId,
                    sourcePageNumber: linkInfo.sourcePage,
                    sourceText: linkInfo.sourceText,
                    targetPageNumber: page.pageNumber,
                    targetText: linkInfo.targetText,
                    type: linkInfo.type,
                    role: 'target'  // This page is the target (destination) of the link
                });
            }
        }
        
        page.tempLinkTargets = pageTargets;
    }
    
    // Also ensure source links have correct roles
    for (const page of pagesWithLinks) {
        if (page.tempLinkSources) {
            for (const sourceLink of page.tempLinkSources) {
                sourceLink.role = 'source';  // This page is the source (origin) of the link
            }
        }
    }

    // Third pass: combine source and target links into a single links array
    for (const page of pagesWithLinks) {
        const allLinks = [];
        
        // Add source links (links that originate from this page)
        if (page.tempLinkSources && Array.isArray(page.tempLinkSources)) {
            allLinks.push(...page.tempLinkSources);
        }
        
        // Add target links (links that target this page)
        if (page.tempLinkTargets && Array.isArray(page.tempLinkTargets)) {
            allLinks.push(...page.tempLinkTargets);
        }
        
        // Set the final links array and clean up temporary arrays
        page.links = allLinks;
        delete page.tempLinkSources;
        delete page.tempLinkTargets;
    }

    return pagesWithLinks;
}

/**
 * Find link text in page content
 * @param {string} pageContent - The content of the page
 * @param {string} linkText - The text to find
 * @returns {boolean} True if link text is found in content
 */
function findLinkInPageContent(pageContent, linkText) {
    // Simple search for now - look for the exact link text
    // Could be enhanced to handle whitespace variations, formatting, etc.
    return pageContent.includes(linkText);
}

/**
 * Find destination text on the target page using reverse annotation text when available
 * @param {Array} pages - All pages
 * @param {number} destinationPage - Target page number
 * @param {Object} destinationCoordinates - Coordinates on target page (optional)
 * @param {string} sourceText - The source text (footnote number) to find
 * @param {Object} pdf - PDF document object (optional)
 * @returns {Promise<string|null>} Text around the destination or null if not found
 */
async function findDestinationText(pages, destinationPage, destinationCoordinates, sourceText, pdf = null) {
    const targetPage = pages.find(page => page.pageNumber === destinationPage);
    if (!targetPage) {
        return null;
    }
    
    // Try to find reverse annotation at destination coordinates first (most accurate)
    if (pdf && destinationCoordinates && destinationCoordinates.x !== undefined && destinationCoordinates.y !== undefined) {
        try {
            const reverseAnnotationText = await findReverseAnnotationText(pdf, destinationPage, destinationCoordinates);
            if (reverseAnnotationText && reverseAnnotationText.length > 0) {
                return reverseAnnotationText.length > 100 ? reverseAnnotationText.substring(0, 100) + '...' : reverseAnnotationText;
            }
        } catch (error) {
            console.warn(`Failed to find reverse annotation at coordinates for page ${destinationPage}:`, error.message);
        }
    }
    
    // Fallback: Try to extract text using PDF coordinates
    if (pdf && destinationCoordinates && destinationCoordinates.x !== undefined && destinationCoordinates.y !== undefined) {
        try {
            const extractedText = await extractTextAtCoordinates(pdf, destinationPage, destinationCoordinates);
            if (extractedText && extractedText.length > 0) {
                return extractedText.length > 100 ? extractedText.substring(0, 100) + '...' : extractedText;
            }
        } catch (error) {
            // Fall back to pattern matching if coordinate extraction fails
            console.warn(`Failed to extract text at coordinates for page ${destinationPage}:`, error.message);
        }
    }
    
    // Fallback 1: If sourceText is provided, look for the specific footnote number
    if (sourceText) {
        // Create a pattern to look for the specific footnote number that matches sourceText
        const footnotePattern = new RegExp(`(?:^|\\n)\\s*(${sourceText})\\s+([A-Z][^.]*)`);
        const match = targetPage.content.match(footnotePattern);
        
        if (match) {
            // Return the footnote number and the beginning of the text
            const footnoteNumber = match[1];
            const footnoteText = match[2];
            const combinedText = `${footnoteNumber} ${footnoteText}`;
            return combinedText.length > 100 ? combinedText.substring(0, 100) + '...' : combinedText;
        }
    }
    
    // Fallback 2: look for any footnote definition if no specific sourceText match
    const genericFootnotePattern = /(?:^|\n)\s*(\d{1,2})\s+([A-Z][^.]*)/;
    const match = targetPage.content.match(genericFootnotePattern);
    
    if (match) {
        // Return the footnote number and the beginning of the text
        const footnoteNumber = match[1];
        const footnoteText = match[2];
        const combinedText = `${footnoteNumber} ${footnoteText}`;
        return combinedText.length > 100 ? combinedText.substring(0, 100) + '...' : combinedText;
    }
    
    // Final fallback: return the first meaningful line (up to 100 characters)
    const contentLines = targetPage.content.split('\n').filter(line => line.trim().length > 0);
    if (contentLines.length > 0) {
        const firstLine = contentLines[0].trim();
        return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
    }
    
    return null;
}

/**
 * Find reverse annotation text at destination coordinates (blue text that links back)
 * @param {Object} pdf - PDF document object
 * @param {number} pageNumber - Target page number (0-based)
 * @param {Object} coordinates - Coordinates object with x, y properties
 * @returns {Promise<string|null>} Text from reverse annotation or null if not found
 */
async function findReverseAnnotationText(pdf, pageNumber, coordinates) {
    try {
        // Convert 0-based page number to 1-based for PDF.js
        const page = await pdf.getPage(pageNumber + 1);
        const annotations = await page.getAnnotations();
        const textContent = await page.getTextContent();
        
        const { x, y } = coordinates;
        
        // Find link annotations near the destination coordinates
        const nearbyAnnotations = annotations.filter(annotation => {
            if (annotation.subtype !== 'Link' || !annotation.rect) {
                return false;
            }
            
            const [x1, y1, x2, y2] = annotation.rect;
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            
            // Check if annotation is within reasonable distance of destination coordinates
            const distance = Math.sqrt(Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2));
            return distance < 50; // Within 50 units of destination
        });
        
        if (nearbyAnnotations.length === 0) {
            return null;
        }
        
        // Find the annotation that's closest to our destination coordinates
        const closestAnnotation = nearbyAnnotations.reduce((closest, annotation) => {
            const [x1, y1, x2, y2] = annotation.rect;
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            const distance = Math.sqrt(Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2));
            
            if (!closest.distance || distance < closest.distance) {
                return { annotation, distance };
            }
            return closest;
        }, {}).annotation;
        
        if (!closestAnnotation) {
            return null;
        }
        
        // Extract text from this reverse annotation
        const linkText = findTextForAnnotation(closestAnnotation, textContent);
        
        if (linkText && linkText.trim().length > 0) {
            return linkText.trim();
        }
        
        return null;
        
    } catch (error) {
        console.warn(`Error finding reverse annotation text at coordinates (${coordinates.x}, ${coordinates.y}) on page ${pageNumber}:`, error.message);
        return null;
    }
}

/**
 * Extract text at specific coordinates from a PDF page
 * @param {Object} pdf - PDF document object
 * @param {number} pageNumber - Target page number (0-based)
 * @param {Object} coordinates - Coordinates object with x, y properties
 * @returns {Promise<string>} Extracted text at the coordinates
 */
async function extractTextAtCoordinates(pdf, pageNumber, coordinates) {
    try {
        // Convert 0-based page number to 1-based for PDF.js
        const page = await pdf.getPage(pageNumber + 1);
        const textContent = await page.getTextContent();
        
        const { x, y } = coordinates;
        
        // Define a search area around the coordinates (±20 units)
        const searchRadius = 20;
        const searchArea = {
            x1: x - searchRadius,
            y1: y - searchRadius,
            x2: x + searchRadius,
            y2: y + searchRadius
        };
        
        // Find text items near the destination coordinates
        const nearbyItems = textContent.items.filter(item => {
            const itemX = item.transform[4];
            const itemY = item.transform[5];
            const itemWidth = item.width || 0;
            const itemHeight = item.height || 12; // Approximate height
            
            // Check if the text item overlaps with our search area
            const overlapX = Math.max(0, Math.min(itemX + itemWidth, searchArea.x2) - Math.max(itemX, searchArea.x1));
            const overlapY = Math.max(0, Math.min(itemY + itemHeight, searchArea.y2) - Math.max(itemY, searchArea.y1));
            
            return overlapX > 0 && overlapY > 0;
        });
        
        if (nearbyItems.length === 0) {
            return null;
        }
        
        // Sort by distance from target coordinates (closest first)
        const sortedItems = nearbyItems.sort((a, b) => {
            const aX = a.transform[4];
            const aY = a.transform[5];
            const bX = b.transform[4];
            const bY = b.transform[5];
            
            const distanceA = Math.sqrt(Math.pow(aX - x, 2) + Math.pow(aY - y, 2));
            const distanceB = Math.sqrt(Math.pow(bX - x, 2) + Math.pow(bY - y, 2));
            
            return distanceA - distanceB;
        });
        
        // Take the closest text items and try to form a meaningful text snippet
        const maxItems = Math.min(5, sortedItems.length); // Limit to closest 5 items
        const selectedItems = sortedItems.slice(0, maxItems);
        
        // Sort selected items by reading order (top to bottom, left to right)
        const readingOrderItems = selectedItems.sort((a, b) => {
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
        
        // Combine text items into a coherent string
        let extractedText = readingOrderItems
            .map(item => item.str)
            .join('')
            .trim();
        
        // Clean up the extracted text
        extractedText = extractedText.replace(/\s+/g, ' ').trim();
        
        return extractedText || null;
        
    } catch (error) {
        console.warn(`Error extracting text at coordinates (${coordinates.x}, ${coordinates.y}) on page ${pageNumber}:`, error.message);
        return null;
    }
}

/**
 * Check if a footnote number is likely a footnote definition (target) rather than a footnote reference (source)
 * @param {string} context - The context around the footnote number
 * @param {string} footnoteNumber - The footnote number
 * @returns {boolean} True if it looks like a footnote definition
 */
function isFootnoteDefinition(context, footnoteNumber) {
    // Look for patterns that indicate this is a footnote definition:
    // 1. Number at the start of a line followed by explanatory text
    // 2. Number preceded by newline/whitespace and followed by explanatory text
    
    const patterns = [
        // Pattern: "\n1 When I talk about..." (number at start of line)
        new RegExp(`\\n\\s*${footnoteNumber}\\s+[A-Z][a-z]`, 'i'),
        // Pattern: "beginning.\n1 When I talk about..." (number after punctuation and newline)
        new RegExp(`[.!?]\\s*\\n\\s*${footnoteNumber}\\s+[A-Z][a-z]`, 'i'),
        // Pattern: "cryptographers.\n3 Even this can be hard..." (similar pattern)
        new RegExp(`[.!?]\\s*\\n\\s*${footnoteNumber}\\s+[A-Z][a-z]`, 'i')
    ];
    
    // Check if any pattern matches
    for (const pattern of patterns) {
        if (pattern.test(context)) {
            return true;
        }
    }
    
    // Additional check: if the footnote number is followed immediately by explanatory text
    // (like "1 When I talk about" instead of just "1")
    const afterNumberPattern = new RegExp(`${footnoteNumber}\\s+[A-Z][a-z]{3,}`, 'i');
    if (afterNumberPattern.test(context)) {
        return true;
    }
    
    return false;
}

/**
 * Detect potential footnote links in text that aren't PDF annotations
 * @param {string} pageContent - The content of the page
 * @param {number} pageNumber - Current page number
 * @param {Array} allPages - All pages for destination lookup
 * @param {number} startingLinkId - Starting counter for link IDs
 * @returns {Array} Array of detected footnote links
 */
function detectTextBasedFootnotes(pageContent, pageNumber, allPages, startingLinkId) {
    const footnoteLinks = [];
    let linkIdCounter = startingLinkId;
    
    // Look for standalone numbers that could be footnotes
    // Pattern: number surrounded by whitespace or at end of sentence
    const footnotePattern = /(?:^|\s|\.|\,|\;|\:)\s*(\d{1,2})\s*(?=\s|$|\n)/g;
    
    let match;
    while ((match = footnotePattern.exec(pageContent)) !== null) {
        const footnoteNumber = match[1];
        const context = getContextAroundMatch(pageContent, match.index, match[0].length);
        
        // Skip if this is a footnote definition rather than a footnote reference
        if (isFootnoteDefinition(context, footnoteNumber)) {
            continue;
        }
        
        // Skip if this looks like a year, page number, or other non-footnote number
        if (isLikelyFootnote(context, footnoteNumber)) {
            // Try to find where this footnote might link to
            const destinationInfo = findFootnoteDestination(footnoteNumber, allPages, pageNumber);
            
            if (destinationInfo) {
                const linkId = `link_${pageNumber}_${linkIdCounter++}`;
                
                footnoteLinks.push({
                    linkId: linkId,
                    text: footnoteNumber,
                    type: 'text_based_footnote',
                    role: 'source',
                    targetPage: destinationInfo.pageNumber,
                    targetText: destinationInfo.text,
                    hasValidDestination: true,
                    context: context
                });
            }
        }
    }
    
    return footnoteLinks;
}

/**
 * Get context around a footnote match to help determine if it's really a footnote
 * @param {string} content - Page content
 * @param {number} matchIndex - Index where match was found
 * @param {number} matchLength - Length of the match
 * @returns {string} Context around the match
 */
function getContextAroundMatch(content, matchIndex, matchLength) {
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(content.length, matchIndex + matchLength + 50);
    return content.substring(start, end);
}

/**
 * Determine if a number in context is likely a footnote
 * @param {string} context - Text context around the number
 * @param {string} number - The number found
 * @returns {boolean} True if likely a footnote
 */
function isLikelyFootnote(context, number) {
    // Skip if it looks like a year (19xx, 20xx)
    if (number.length === 4 && (number.startsWith('19') || number.startsWith('20'))) {
        return false;
    }
    
    // Skip if it's part of a larger number or fraction
    if (/\d[\d\.,\/]\s*\d/.test(context)) {
        return false;
    }
    
    // Skip if it looks like a page reference
    if (/page\s*\d+|p\.\s*\d+/i.test(context)) {
        return false;
    }
    
    // Skip very large numbers (unlikely to be footnotes)
    if (parseInt(number) > 99) {
        return false;
    }
    
    // Positive indicators for footnotes:
    // - Single or double digit
    // - At end of sentence or after period
    // - Surrounded by whitespace
    const hasFootnoteIndicators = 
        /\.\s*\d+\s*$/.test(context) || // at end after period
        /\.\s*\d+\s+[A-Z]/.test(context) || // period, number, then capital letter
        /blocks\.\s*\d+\s/.test(context); // specific pattern like "building blocks. 1"
    
    return hasFootnoteIndicators;
}

/**
 * Find where a footnote number might link to
 * @param {string} footnoteNumber - The footnote number to find
 * @param {Array} allPages - All pages to search
 * @param {number} sourcePage - Page where footnote was found
 * @returns {Object|null} Destination info or null
 */
function findFootnoteDestination(footnoteNumber, allPages, sourcePage) {
    // Look for footnote definitions on later pages
    // Pattern: "1 When I talk about..." at start of line
    const footnoteDefPattern = new RegExp(`^\\s*${footnoteNumber}\\s+[A-Z]`, 'm');
    
    // Search pages after the source page first
    const pagesToSearch = allPages.filter(page => page.pageNumber > sourcePage)
        .concat(allPages.filter(page => page.pageNumber <= sourcePage));
    
    for (const page of pagesToSearch) {
        const match = page.content.match(footnoteDefPattern);
        if (match) {
            // Found potential footnote definition
            const lines = page.content.split('\n');
            for (const line of lines) {
                if (footnoteDefPattern.test(line)) {
                    return {
                        pageNumber: page.pageNumber,
                        text: line.trim().length > 100 ? line.trim().substring(0, 100) + '...' : line.trim()
                    };
                }
            }
        }
    }
    
    return null;
}

module.exports = { execute }; 