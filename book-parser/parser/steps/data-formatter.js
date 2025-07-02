/**
 * Data Formatter Module
 * 
 * Handles formatting of parsed book data for database storage.
 * 
 * @module data-formatter
 */

/**
 * Convert paragraphs to individual chunks (preserving the chunking structure)
 * Each chunk remains separate as intended by the chunking algorithm
 * 
 * @param {Array} paragraphs - Array of paragraph objects with chunks
 * @returns {Array} Array of individual chunks
 */
function convertParagraphsToChunks(paragraphs) {
    const allChunks = [];
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
        for (const chunk of paragraph.chunks) {
            // Preserve each chunk as a separate entity - don't merge them!
            allChunks.push({
                index: chunkIndex++,
                text: chunk.text.replace(/\s+/g, ' ').trim(),
                wordCount: chunk.wordCount,
                type: chunk.type || paragraph.type || 'text',
                pageNumber: paragraph.pageNumber || chunk.pageNumber,
                links: chunk.links || []
            });
        }
    }

    return allChunks;
}

/**
 * Convert chapters to database format with proper structure and metadata
 * 
 * @param {Array} chapters - Array of chapter objects from parsing
 * @returns {Array} Chapters formatted for database storage
 * 
 * @example
 * const dbChapters = convertChaptersToDbFormat(chapters);
 * // Returns array with: { number, title, startPageNumber, endPageNumber, chunkCount, wordCount, content }
 */
function convertChaptersToDbFormat(chapters) {
    return chapters.map(chapter => {
        const chapterData = {
            number: chapter.number,
            title: chapter.title,
            startPageNumber: chapter.startPageNumber,
            endPageNumber: chapter.endPageNumber,
            images: chapter.images || []
        };

        // Use new paragraph structure if available, otherwise fallback to legacy chunks
        if (chapter.content && chapter.content.paragraphs) {
            // Convert paragraphs to paragraph-based chunks
            const paragraphChunks = convertParagraphsToChunks(chapter.content.paragraphs);
            
            chapterData.content = {
                chunks: paragraphChunks
            };
            chapterData.chunkCount = paragraphChunks.length;
            chapterData.wordCount = paragraphChunks.reduce((total, chunk) => total + chunk.wordCount, 0);
        } else if (chapter.chunks) {
            // Legacy fallback - create simple content structure
            chapterData.content = {
                chunks: chapter.chunks.map(chunk => ({
                    id: chunk.id,
                    text: chunk.text,
                    pageNumber: chunk.pageNumber,
                    type: chunk.type || 'text',
                    coordinates: chunk.coordinates,
                    links: chunk.links || []
                }))
            };
            chapterData.chunkCount = chapter.chunks.length;
            chapterData.wordCount = chapter.content && typeof chapter.content === 'string' ? 
                chapter.content.split(/\s+/).length : 0;
        } else {
            // No content
            chapterData.content = { chunks: [] };
            chapterData.chunkCount = 0;
            chapterData.wordCount = 0;
        }

        return chapterData;
    });
}

module.exports = {
    convertChaptersToDbFormat,
    convertParagraphsToChunks
}; 