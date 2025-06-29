const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Import modular components
const { loadBookConfig } = require('./config-loader');
const { extractBookMetadata } = require('./metadata-extractor');
const { convertChaptersToDbFormat } = require('./data-formatter');
const { createPageAwareChunksWithImages } = require('./chunk-processor');
const { extractImages } = require('./image-extractor');
const { detectChapters } = require('./chapter-detector');
const { extractInternalLinks } = require('./link-extractor');
const { resolveLinksToTargetChunks, validateLinkDestinations } = require('./link-resolver');
const { saveToFile, generateParserSummary } = require('./file-utils');
const { chunkText } = require('./text-processor');

// Global debug tracker for headers
let headerTracker = [];

async function parsePdfBook(pdfPath, configPath, debugMode = false) {
    const startTime = Date.now();
    const config = loadBookConfig(configPath);

    // Create debug folder in the same directory as the PDF
    const pdfDirectory = path.dirname(pdfPath);
    const debugFolderPath = path.join(pdfDirectory, 'debug');
    if (!fs.existsSync(debugFolderPath)) {
        fs.mkdirSync(debugFolderPath, { recursive: true });
    }

    // Step 1: Parse PDF
    console.log('✅ Step 1: Parsing PDF content...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);
    
    // Save step 1 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step1-pdf-data.json'),
        JSON.stringify({
            text: pdfData.text.substring(0, 10000) + '...', // First 10k chars to avoid huge files
            textLength: pdfData.text.length,
            info: pdfData.info,
            metadata: pdfData.metadata,
            version: pdfData.version
        }, null, 2)
    );

    // Step 2: Extract metadata
    console.log('✅ Step 2: Extracting book metadata...');
    const book = extractBookMetadata(pdfData, path.basename(pdfPath), config);
    
    // Save step 2 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step2-book-metadata.json'),
        JSON.stringify(book, null, 2)
    );

    // Create book folder for images
    const bookFolderPath = path.join(pdfDirectory, book.title);
    if (!fs.existsSync(bookFolderPath)) {
        fs.mkdirSync(bookFolderPath, { recursive: true });
    }
    
    // Step 3: Extract images
    console.log('✅ Step 3: Extracting images...');
    const { images, imagesFolderPath } = await extractImages(pdfPath, book.title, bookFolderPath);
    
    // Save step 3 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step3-extracted-images.json'),
        JSON.stringify(images, null, 2)
    );

    // Step 4: Extract links
    console.log('✅ Step 4: Extracting internal links...');
    const links = await extractInternalLinks(pdfPath);
    
    // Save step 4 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step4-extracted-links.json'),
        JSON.stringify(links, null, 2)
    );

    // Step 5: Detect chapters
    console.log('✅ Step 5: Detecting chapters...');
    const chapters = await detectChapters(pdfData.text, config, pdfPath);
    
    // Save step 5 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step5-detected-chapters.json'),
        JSON.stringify(chapters.map(ch => ({
            number: ch.number,
            title: ch.title,
            contentLength: ch.content ? (Array.isArray(ch.content) ? ch.content.length : ch.content.length) : 0,
            contentPreview: ch.content ? 
                (Array.isArray(ch.content) ? 
                    ch.content.slice(0, 3).join(' ').substring(0, 500) + '...' : 
                    ch.content.substring(0, 500) + '...') : '',
            contentType: ch.content ? (Array.isArray(ch.content) ? 'array' : 'string') : 'none',
            startPageNumber: ch.startPageNumber,
            endPageNumber: ch.endPageNumber,
            pagesCount: ch.pages ? ch.pages.length : 0
        })), null, 2)
    );
    
    // Step 6: Process chapters into chunks
    console.log('✅ Step 6: Processing chapters into chunks...');
    chapters.forEach(chapter => {
        if (Array.isArray(chapter.content)) {
            // Convert content array to string
            const contentText = chapter.content.join(' ');
            // Process text into chunks
            chapter.chunks = chunkText(contentText, 5, 15);
            // Keep original content for reference but convert to string
            chapter.content = contentText;
        } else if (typeof chapter.content === 'string') {
            // Content is already a string, just process it
            chapter.chunks = chunkText(chapter.content, 5, 15);
        } else {
            // No content or invalid content
            chapter.chunks = [];
            chapter.content = '';
        }
    });
    
    // Save step 6 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step6-chapters-with-chunks.json'),
        JSON.stringify(chapters.map(ch => ({
            number: ch.number,
            title: ch.title,
            chunksCount: ch.chunks ? ch.chunks.length : 0,
            imagesCount: ch.images ? ch.images.length : 0,
            images: ch.images ? ch.images.map(img => ({
                imageName: img.imageName,
                pageNumber: img.pageNumber
            })) : [],
            chunks: ch.chunks ? ch.chunks.map(chunk => ({
                text: chunk.text ? chunk.text.substring(0, 200) + '...' : '',
                wordCount: chunk.wordCount,
                pageNumber: chunk.pageNumber
            })) : []
        })), null, 2)
    );
    
    // Step 7: Create page-aware chunks
    console.log('✅ Step 7: Creating page-aware chunks...');
    const allChunks = createPageAwareChunksWithImages(chapters, images, links);
    
    // Save step 7 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step7-page-aware-chunks.json'),
        JSON.stringify(allChunks.map(chunk => ({
            id: chunk.id,
            index: chunk.index,
            chapterNumber: chunk.chapterNumber,
            chapterTitle: chunk.chapterTitle,
            text: chunk.text ? chunk.text.substring(0, 200) + '...' : '',
            wordCount: chunk.wordCount,
            pageNumber: chunk.pageNumber,
            linksCount: chunk.links ? chunk.links.length : 0,
            targetLink: chunk.targetLink || false
        })), null, 2)
    );

    // Step 8: Resolve links
    console.log('✅ Step 8: Resolving links to target chunks...');
    const resolvedLinks = resolveLinksToTargetChunks(links, allChunks);
    
    // Save step 8 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step8-resolved-links.json'),
        JSON.stringify(resolvedLinks.map(link => ({
            text: link.text,
            targetChunk: link.targetChunk,
            chapterNumber: link.chapterNumber
        })), null, 2)
    );
    
    // Step 9: Validate links
    console.log('✅ Step 9: Validating link destinations...');
    const validLinks = validateLinkDestinations(resolvedLinks, chapters);
    
    // Save step 9 debug output
    fs.writeFileSync(
        path.join(debugFolderPath, 'step9-validated-links.json'),
        JSON.stringify(validLinks.map(link => ({
            text: link.text,
            targetChunk: link.targetChunk,
            chapterNumber: link.chapterNumber
        })), null, 2)
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Parsing completed in ${processingTime}ms`);

        return {
        book,
        chapters: convertChaptersToDbFormat(chapters),
        images,
        links: validLinks,
        processingTime,
        imagesFolderPath
    };
}



async function main() {
    if (process.argv.length < 3) {
        showHelp();
        process.exit(1);
    }

    const pdfPath = process.argv[2];
    const configPath = process.argv[3];
    const outputPath = process.argv[4] || path.join(path.dirname(pdfPath), 'output.json');
    const debugMode = process.argv.includes('--debug');

    try {
        const result = await parsePdfBook(pdfPath, configPath, debugMode);
        
        saveToFile(result.book, result.chapters, outputPath, result.imagesFolderPath, result.links);
        
        const summaryPath = path.join(path.dirname(outputPath), 'summary.json');
        generateParserSummary(result.book, result.chapters, summaryPath);
        
        console.log('🎉 Parsing completed successfully!');
        
    } catch (error) {
        console.error('❌ Error parsing PDF:', error);
        process.exit(1);
    }
}

async function parseBook(pdfPath, configPath, outputPath, debugMode) {
    try {
        const result = await parsePdfBook(pdfPath, configPath, debugMode);
        
        if (outputPath) {
            saveToFile(result.book, result.chapters, outputPath, result.imagesFolderPath, result.links);

            const summaryPath = path.join(path.dirname(outputPath), 'summary.json');
            generateParserSummary(result.book, result.chapters, summaryPath);
        }
        
        return result;
    } catch (error) {
        console.error('Error in parseBook:', error);
        throw error;
    }
}

function showHelp() {
    console.log(`
📚 PDF Book Parser

Usage: node parse-pdf-book-generic.js <pdf-path> [config-path] [output-path] [--debug]

Arguments:
  pdf-path     Path to the PDF file to parse
  config-path  Path to the JSON configuration file (optional)
  output-path  Path for the output JSON file (optional, defaults to <pdf-name>-output.json)
  --debug      Enable debug mode for verbose output

Examples:
  node parse-pdf-book-generic.js book.pdf
  node parse-pdf-book-generic.js book.pdf config.json
  node parse-pdf-book-generic.js book.pdf config.json output.json --debug
`);
}

// Export functions for use in other modules
module.exports = {
    parsePdfBook,
    parseBook
};

// Run main if this file is executed directly
if (require.main === module) {
    main();
}