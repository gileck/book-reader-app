/**
 * File Utilities Module
 * 
 * Handles file I/O operations for saving parsed book data and generating summaries.
 * 
 * @module file-utils
 */

const fs = require('fs');

/**
 * Save parsed book data to output file
 * 
 * @param {Object} book - Book metadata object
 * @param {Array} chapters - Array of parsed chapters
 * @param {string} outputPath - Path to save the output file
 * @param {string} imagesFolderPath - Path to the images folder
 * @param {Array} links - Array of resolved links with navigation data
 * 
 * @example
 * saveToFile(book, chapters, 'output.json', '/path/to/images', links);
 */
function saveToFile(book, chapters, outputPath, imagesFolderPath, links = []) {
    const output = {
        book,
        chapters,
        links,
        metadata: {
            parsingDate: new Date().toISOString(),
            imagesFolderPath
        }
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`💾 Saved to: ${outputPath}`);
}

/**
 * Generate and save parser summary with processing statistics
 * 
 * @param {Object} book - Book metadata object
 * @param {Array} chapters - Array of parsed chapters
 * @param {string} summaryPath - Path to save the summary file
 * 
 * @example
 * generateParserSummary(book, chapters, 'summary.json');
 */
function generateParserSummary(book, chapters, summaryPath) {
    const totalChunks = chapters.reduce((sum, ch) => sum + (ch.chunks?.length || 0), 0);
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    const totalImages = chapters.reduce((sum, ch) => 
        sum + (ch.chunks?.reduce((chunkSum, chunk) => chunkSum + (chunk.images?.length || 0), 0) || 0), 0);
    const totalLinks = chapters.reduce((sum, ch) =>
        sum + (ch.chunks?.reduce((chunkSum, chunk) => chunkSum + (chunk.links?.length || 0), 0) || 0), 0);

    const summary = {
        book: {
            title: book.title,
            author: book.author,
            pageCount: book.pageCount,
            filename: book.filename
        },
        processing: {
            timestamp: new Date().toISOString(),
            totalChapters: chapters.length,
            totalChunks,
            totalWords,
            totalImages,
            totalLinks
        },
        chapters: chapters.map(ch => ({
            number: ch.number,
            title: ch.title,
            wordCount: ch.wordCount,
            chunkCount: ch.chunkCount,
            pageRange: `${ch.startPageNumber}-${ch.endPageNumber}`,
            imageCount: ch.chunks?.reduce((sum, chunk) => sum + (chunk.images?.length || 0), 0) || 0,
            linkCount: ch.chunks?.reduce((sum, chunk) => sum + (chunk.links?.length || 0), 0) || 0
        }))
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📋 Summary saved to: ${summaryPath}`);
}

module.exports = {
    saveToFile,
    generateParserSummary
}; 