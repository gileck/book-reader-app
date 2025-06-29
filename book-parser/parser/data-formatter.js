/**
 * Data Formatter Module
 * 
 * Handles formatting of parsed book data for database storage.
 * 
 * @module data-formatter
 */

/**
 * Convert chapters to database format with proper structure and metadata
 * 
 * @param {Array} chapters - Array of chapter objects from parsing
 * @returns {Array} Chapters formatted for database storage
 * 
 * @example
 * const dbChapters = convertChaptersToDbFormat(chapters);
 * // Returns array with: { number, title, startPageNumber, endPageNumber, chunkCount, wordCount, chunks }
 */
function convertChaptersToDbFormat(chapters) {
    return chapters.map(chapter => {
        const chapterData = {
            number: chapter.number,
            title: chapter.title,
            startPageNumber: chapter.startPageNumber,
            endPageNumber: chapter.endPageNumber,
            chunkCount: chapter.chunks ? chapter.chunks.length : 0,
            wordCount: chapter.content && typeof chapter.content === 'string' ? chapter.content.split(/\s+/).length : 0,
            images: chapter.images || []
        };

        if (chapter.chunks) {
            chapterData.chunks = chapter.chunks.map(chunk => ({
                id: chunk.id,
                text: chunk.text,
                pageNumber: chunk.pageNumber,
                type: chunk.type || 'text',
                coordinates: chunk.coordinates,
                links: chunk.links || []
            }));
        }

        return chapterData;
    });
}

module.exports = {
    convertChaptersToDbFormat
}; 