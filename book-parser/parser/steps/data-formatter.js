/**
 * Data Formatter Module
 * 
 * Handles formatting of parsed book data for database storage.
 * 
 * @module data-formatter
 */

/**
 * Convert paragraphs to paragraph-based chunks
 * Each paragraph becomes a single chunk with full paragraph text
 * 
 * @param {Array} paragraphs - Array of paragraph objects with chunks
 * @returns {Array} Array of paragraph-based chunks
 */
function convertParagraphsToChunks(paragraphs) {
    return paragraphs.map((paragraph, index) => {
        // Combine all chunk texts into one paragraph text
        const paragraphText = paragraph.chunks
            .map(chunk => chunk.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Calculate total word count
        const totalWordCount = paragraph.chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);

        // Collect all links from chunks and calculate word indices
        const allLinks = [];
        let currentWordIndex = 0;

        for (const chunk of paragraph.chunks) {
            if (chunk.links && chunk.links.length > 0) {
                // Find word index within the paragraph text for each link
                const chunkWords = chunk.text.split(/\s+/).filter(w => w.length > 0);
                
                chunk.links.forEach(link => {
                    // Find the link text within the chunk
                    const linkWords = link.text.split(/\s+/).filter(w => w.length > 0);
                    const linkText = linkWords.join(' ');
                    
                    // Try to find the exact position of the link text within the chunk
                    let wordIndexInChunk = 0;
                    for (let i = 0; i <= chunkWords.length - linkWords.length; i++) {
                        const candidateText = chunkWords.slice(i, i + linkWords.length).join(' ');
                        if (candidateText.toLowerCase().includes(linkText.toLowerCase()) || 
                            linkText.toLowerCase().includes(candidateText.toLowerCase())) {
                            wordIndexInChunk = i;
                            break;
                        }
                    }

                    allLinks.push({
                        text: link.text,
                        targetChunk: link.targetChunk,
                        chapterNumber: link.chapterNumber,
                        wordIndex: currentWordIndex + wordIndexInChunk
                    });
                });
            }
            currentWordIndex += chunk.text.split(/\s+/).filter(w => w.length > 0).length;
        }

        return {
            index: index,
            text: paragraphText,
            wordCount: totalWordCount,
            type: paragraph.type || 'text',
            pageNumber: paragraph.pageNumber,
            links: allLinks
        };
    });
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