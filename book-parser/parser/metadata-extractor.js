/**
 * Metadata Extractor Module
 * 
 * Handles extraction of book metadata from parsed PDF data and configuration.
 * 
 * @module metadata-extractor
 */

/**
 * Extract book metadata from PDF data and configuration
 * 
 * @param {Object} pdfData - Parsed PDF data from pdf-parse
 * @param {string} filename - Original PDF filename
 * @param {Object} config - Book configuration object
 * @returns {Object} Book metadata object
 * 
 * @example
 * const metadata = extractBookMetadata(pdfData, 'book.pdf', config);
 * // Returns: { title, author, creationDate, modificationDate, pageCount, filename }
 */
function extractBookMetadata(pdfData, filename, config) {
    const info = pdfData.info || {};
    const title = config.metadata?.title || info.Title || filename.replace(/\.pdf$/i, '');
    const author = config.metadata?.author || info.Author || 'Unknown';

    return {
        title,
        author,
        creationDate: info.CreationDate,
        modificationDate: info.ModDate,
        pageCount: pdfData.numpages,
        filename
    };
}

module.exports = {
    extractBookMetadata
}; 