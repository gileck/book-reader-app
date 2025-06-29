/**
 * Chunk Processor Module
 * 
 * Handles processing of text chunks and associating them with images and links.
 * 
 * @module chunk-processor
 */

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
function createPageAwareChunksWithImages(chapters, images, links = []) {
    const allChunks = [];
    let chunkId = 1;

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
            chunk.links = [];
            
            // Assign page number based on chunk position within chapter
            if (!chunk.pageNumber) {
                const pageIndex = Math.floor(index / chunksPerPage);
                chunk.pageNumber = chapter.startPageNumber + Math.min(pageIndex, chapterPageRange - 1);
            }
            
            if (chunk.pageNumber) {
                pageNumbers.add(chunk.pageNumber);

                // Add links for this page
                const pageLinks = links.filter(link => link.pageNumber === chunk.pageNumber);
                chunk.links = pageLinks.map(link => ({
                    text: link.text,
                    targetPage: link.targetPage,
                    navigationType: link.navigationType,
                    searchPattern: link.searchPattern
                }));
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

module.exports = {
    createPageAwareChunksWithImages
}; 