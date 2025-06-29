// const fs = require('fs');
// const path = require('path');
// const { MongoClient, ObjectId } = require('mongodb');

// // Import modular components
// const { loadBookConfig, getDefaultConfig } = require('./config-loader');
// const { preprocessPDF } = require('./pdf-preprocessor');
// const { 
//     chunkText, 
//     chunkTextWithPages, 
//     mergeSplitSentences, 
//     cleanPageNumbers, 
//     cleanChapterHeading, 
//     combineTextItemsPreservingStructure,
//     preserveHeadingsInPageText,
//     extractTextContentWithCoordinates
// } = require('./text-processor');
// const { resolveLinksToTargetChunks } = require('./link-resolver');

// // Global debug tracker for headers
// let headerTracker = [];

// function extractBookMetadata(preprocessedData, filename, config) {
//     const info = preprocessedData.info || {};
//     const title = config.metadata?.title || info.Title || filename.replace(/\.pdf$/i, '');
//     const author = config.metadata?.author || info.Author || 'Unknown';
    
//     return {
//         title,
//         author,
//         creationDate: info.CreationDate,
//         modificationDate: info.ModDate,
//         pageCount: preprocessedData.numPages,
//         filename
//     };
// }

// function convertChaptersToDbFormat(chapters) {
//     return chapters.map(chapter => {
//         const chapterData = {
//             number: chapter.number,
//             title: chapter.title,
//             content: chapter.content,
//             startPageNumber: chapter.startPageNumber,
//             endPageNumber: chapter.endPageNumber,
//             chunkCount: chapter.chunks ? chapter.chunks.length : 0,
//             wordCount: chapter.content ? chapter.content.split(/\s+/).length : 0
//         };

//         if (chapter.chunks) {
//             chapterData.chunks = chapter.chunks.map(chunk => ({
//                 id: chunk.id,
//                 text: chunk.text,
//                 pageNumber: chunk.pageNumber,
//                 type: chunk.type || 'text',
//                 coordinates: chunk.coordinates,
//                 images: chunk.images || [],
//                 links: chunk.links || []
//             }));
//         }

//         return chapterData;
//     });
// }

// function extractImagesFromPreprocessedData(preprocessedData, bookTitle, bookFolderPath) {
//     console.log('🖼️ Processing image data from preprocessing...');
    
//     // Create images directory in the book folder
//     const bookFolderName = bookTitle.replace(/[^a-zA-Z0-9]/g, '-');
//     const imagesDir = path.join(bookFolderPath, 'images', bookFolderName);
//     if (!fs.existsSync(imagesDir)) {
//         fs.mkdirSync(imagesDir, { recursive: true });
//         console.log(`📁 Created images directory: ${imagesDir}`);
//     }
    
//     const images = [];
//     let globalImageCounter = 1;
    
//     // Convert preprocessed image data to final format
//     for (const imageInfo of preprocessedData.images) {
//         for (let imageIndex = 0; imageIndex < imageInfo.imageCount; imageIndex++) {
//             images.push({
//                 pageNumber: imageInfo.pageNumber,
//                 imageName: `page-${String(imageInfo.pageNumber).padStart(3, '0')}-image-${imageIndex + 1}.placeholder`,
//                 imageAlt: `Figure ${globalImageCounter} (Page ${imageInfo.pageNumber}) - Detected via preprocessing`,
//                 placeholder: true,
//                 detected: true
//             });
//             globalImageCounter++;
//         }
//     }
    
//     console.log(`✅ Processed ${images.length} images from ${preprocessedData.images.length} pages`);
    
//     return {
//         images,
//         imagesFolderPath: `./images/${bookFolderName}`
//     };
// }

// function detectChaptersFromPreprocessedData(preprocessedData, config) {
//     console.log('📖 Detecting chapters from preprocessed data...');
    
//     // Use TOC data if available
//     if (preprocessedData.toc && preprocessedData.toc.chapters && preprocessedData.toc.chapters.length > 0) {
//         console.log(`✅ Found ${preprocessedData.toc.chapters.length} chapters via ${preprocessedData.toc.source}`);
//         return extractChapterContentFromPreprocessedData(preprocessedData.toc.chapters, preprocessedData, config);
//     }
    
//     // Fallback to text-based detection
//     console.log('⚠️ No TOC found, falling back to text-based chapter detection');
//     return detectChaptersFromText(preprocessedData.basicText, config);
// }

// function extractChapterContentFromPreprocessedData(tocChapters, preprocessedData, config = null) {
//     console.log('📖 Extracting chapter content using preprocessed page data...');
    
//     // Filter out non-content chapters
//     const contentChapters = tocChapters.filter(ch => {
//         if (!ch.startingPage) return false;

//         // Original numeric chapter logic
//         if ((typeof ch.chapterNumber === 'number' && ch.chapterNumber >= 0) ||
//             ch.chapterNumber === 'Epilogue' ||
//             (typeof ch.chapterNumber === 'string' && ch.chapterNumber.toLowerCase().includes('epilogue'))) {
//             return true;
//         }

//         // If config has chapterNames, also include chapters that match those names
//         if (config && config.chapterNames && config.chapterNames.length > 0) {
//             return config.chapterNames.some(configName =>
//                 ch.chapterTitle === configName ||
//                 ch.chapterTitle.includes(configName) ||
//                 configName.includes(ch.chapterTitle)
//             );
//         }

//         return false;
//     });

//     if (contentChapters.length === 0) {
//         console.log('No content chapters found in TOC');
//         return null;
//     }

//     console.log(`Extracting content for ${contentChapters.length} chapters using preprocessed page data`);

//     const chapters = [];

//     for (let i = 0; i < contentChapters.length; i++) {
//         const currentChapter = contentChapters[i];
//         const nextChapter = contentChapters[i + 1];

//         const startPage = currentChapter.startingPage;
//         const endPage = nextChapter ? nextChapter.startingPage - 1 : preprocessedData.numPages;

//         console.log(`Extracting "${currentChapter.chapterTitle}" from pages ${startPage} to ${endPage}`);

//         const chapterPages = [];

//         // Extract text from preprocessed page data
//         for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
//             const pageData = preprocessedData.pages.find(p => p.pageNumber === pageNum);
            
//             if (pageData && pageData.combinedText.length > 50) {
//                 // Apply text cleaning and processing
//                 let pageText = pageData.combinedText;
                
//                 // Get next page text for cross-page header detection
//                 let nextPageText = '';
//                 if (pageNum < endPage) {
//                     const nextPageData = preprocessedData.pages.find(p => p.pageNumber === pageNum + 1);
//                     if (nextPageData) {
//                         // Take first few lines of next page
//                         const nextLines = nextPageData.combinedText.split(' ').slice(0, 50);
//                         nextPageText = nextLines.join(' ');
//                     }
//                 }

//                 // Apply heading detection with cross-page context
//                 pageText = preserveHeadingsInPageText(pageText, nextPageText);

//                 // Clean page number from beginning of page text
//                 pageText = cleanPageNumbers(pageText, pageNum);

//                 chapterPages.push({
//                     pageNumber: pageNum,
//                     text: pageText,
//                     coordinateBounds: pageData.coordinateBounds
//                 });
//             }
//         }

//         if (chapterPages.length > 0) {
//             // Combine all page text for content
//             const combinedContent = chapterPages.map(p => p.text).join(' ')
//                 .replace(/\s+/g, ' ')
//                 .trim();

//             // Split into reasonable chunks for content array
//             const contentLines = combinedContent
//                 .split(/[.!?]+\s+/)
//                 .filter(line => line.trim().length > 20)
//                 .map(line => line.trim() + (line.endsWith('.') ? '' : '.'));

//             // Assign sequential chapter numbers when using config-based extraction
//             const assignedChapterNumber = (config && config.chapterNames && config.chapterNames.length > 0)
//                 ? i + 1  // Sequential numbering for config-based chapters
//                 : currentChapter.chapterNumber; // Preserve original for TOC-only extraction

//             chapters.push({
//                 chapterNumber: assignedChapterNumber,
//                 title: currentChapter.chapterTitle,
//                 content: contentLines,
//                 pages: chapterPages,
//                 startingPage: startPage,
//                 endingPage: endPage
//             });
//         } else {
//             console.log(`⚠️ No content found for "${currentChapter.chapterTitle}"`);
//         }
//     }

//     return chapters.length > 0 ? chapters : null;
// }

// // Fallback text-based chapter detection (simplified version)
// function detectChaptersFromText(text, config) {
//     console.log('📖 Using text-based chapter detection fallback...');
    
//     // Simple pattern-based detection
//     const lines = text.split('\n').filter(line => line.trim().length > 0);
//     const chapters = [];
//     let currentChapter = null;
//     let chapterContent = [];
    
//     for (const line of lines) {
//         const cleanLine = line.trim();
        
//         // Check for chapter patterns
//         const chapterMatch = cleanLine.match(/^chapter\s+(\d+):?\s*(.+)/i) ||
//                             cleanLine.match(/^(\d+)\.\s+(.+)/) ||
//                             cleanLine.match(/^(introduction|conclusion|epilogue|prologue)$/i);
        
//         if (chapterMatch) {
//             // Save previous chapter
//             if (currentChapter) {
//                 currentChapter.content = chapterContent.join(' ').trim();
//                 chapters.push(currentChapter);
//             }
            
//             // Start new chapter
//             currentChapter = {
//                 chapterNumber: isNaN(chapterMatch[1]) ? chapterMatch[1] : parseInt(chapterMatch[1]),
//                 title: chapterMatch[2] || chapterMatch[1],
//                 content: '',
//                 startingPage: 1, // Default
//                 endingPage: 1
//             };
//             chapterContent = [];
//         } else if (currentChapter && cleanLine.length > 20) {
//             chapterContent.push(cleanLine);
//         }
//     }
    
//     // Save last chapter
//     if (currentChapter) {
//         currentChapter.content = chapterContent.join(' ').trim();
//         chapters.push(currentChapter);
//     }
    
//     console.log(`✅ Detected ${chapters.length} chapters using text patterns`);
//     return chapters;
// }

// function createPageAwareChunksWithImages(chapters, images, links = []) {
//     console.log('🔗 Creating page-aware chunks with images and links...');
    
//     const allChunks = [];
//     let chunkId = 1;

//     chapters.forEach(chapter => {
//         const pageNumbers = new Set();
        
//         // Process chapter content into chunks
//         if (chapter.pages && chapter.pages.length > 0) {
//             // Use page-based data
//             chapter.chunks = [];
            
//             chapter.pages.forEach(pageData => {
//                 pageNumbers.add(pageData.pageNumber);
                
//                 // Chunk the page text
//                 const pageChunks = chunkText(pageData.text, 5, 15);
                
//                 pageChunks.forEach(chunk => {
//                     const chunkObj = {
//                         id: chunkId++,
//                         text: chunk.text,
//                         pageNumber: pageData.pageNumber,
//                         type: chunk.type || 'text',
//                         coordinates: pageData.coordinateBounds,
//                         chapterNumber: chapter.chapterNumber,
//                         chapterTitle: chapter.title,
//                         images: [],
//                         links: []
//                     };
                    
//                     // Add images for this page
//                     const pageImages = images.filter(img => img.pageNumber === pageData.pageNumber);
//                     chunkObj.images = pageImages.map(img => ({
//                         imageName: img.imageName,
//                         imageAlt: img.imageAlt,
//                         pageNumber: img.pageNumber
//                     }));
                    
//                     // Add links for this page
//                     const pageLinks = links.filter(link => link.pageNumber === pageData.pageNumber);
//                     chunkObj.links = pageLinks.map(link => ({
//                         text: link.linkText,
//                         targetPage: link.destinationPage,
//                         navigationType: 'internal_link'
//                     }));
                    
//                     chapter.chunks.push(chunkObj);
//                     allChunks.push(chunkObj);
//                 });
//             });
//         } else {
//             // Fallback to content-based chunking
//             const chunks = chunkText(chapter.content || '', 5, 15);
//             chapter.chunks = chunks.map(chunk => ({
//                 id: chunkId++,
//                 text: chunk.text,
//                 pageNumber: chapter.startingPage,
//                 type: chunk.type || 'text',
//                 chapterNumber: chapter.chapterNumber,
//                 chapterTitle: chapter.title,
//                 images: [],
//                 links: []
//             }));
            
//             allChunks.push(...chapter.chunks);
//             pageNumbers.add(chapter.startingPage);
//         }
        
//         chapter.pageNumbers = Array.from(pageNumbers).sort((a, b) => a - b);
//         chapter.startPageNumber = Math.min(...chapter.pageNumbers);
//         chapter.endPageNumber = Math.max(...chapter.pageNumbers);
//     });

//     console.log(`   ✅ Created ${allChunks.length} chunks across ${chapters.length} chapters`);
//     return allChunks;
// }

// function validateLinkDestinations(links, chapters) {
//     console.log('🔍 Validating link destinations...');
    
//     const validLinks = [];
//     const pageToChapterMap = new Map();
    
//     chapters.forEach(chapter => {
//         if (chapter.pageNumbers) {
//             chapter.pageNumbers.forEach(pageNum => {
//                 pageToChapterMap.set(pageNum, chapter);
//             });
//         }
//     });

//     links.forEach(link => {
//         if (link.destinationPage && pageToChapterMap.has(link.destinationPage)) {
//             link.targetChapter = pageToChapterMap.get(link.destinationPage);
//             validLinks.push({
//                 text: link.linkText,
//                 pageNumber: link.pageNumber,
//                 targetPage: link.destinationPage,
//                 coordinates: link.destinationCoordinates,
//                 navigationType: 'internal_link',
//                 hasValidDestination: link.hasValidDestination
//             });
//         }
//     });

//     console.log(`   ✅ Validated ${validLinks.length} out of ${links.length} links`);
//     return validLinks;
// }

// async function parsePdfBookOptimized(pdfPath, configPath, debugMode = false) {
//     console.log(`📚 Starting OPTIMIZED PDF book parsing: ${path.basename(pdfPath)}`);
//     console.log(`📝 Config: ${configPath || 'using defaults'}`);
    
//     const startTime = Date.now();
    
//     // Step 1: Load configuration (fast)
//     console.log('1️⃣ Loading configuration...');
//     const config = loadBookConfig(configPath);
    
//     // Step 2: Single comprehensive PDF preprocessing
//     console.log('2️⃣ Preprocessing PDF (single pass for all data)...');
//     const preprocessedData = await preprocessPDF(pdfPath, debugMode);
    
//     // Early error detection
//     if (preprocessedData.errors.length > 0) {
//         console.log(`⚠️ Preprocessing found ${preprocessedData.errors.length} errors:`);
//         preprocessedData.errors.forEach(error => console.log(`   - ${error}`));
//     }
    
//     // Step 3: Extract metadata
//     const book = {
//         title: config.metadata?.title || preprocessedData.info?.Title || path.basename(pdfPath).replace(/\.pdf$/i, ''),
//         author: config.metadata?.author || preprocessedData.info?.Author || 'Unknown',
//         pageCount: preprocessedData.numPages,
//         filename: path.basename(pdfPath)
//     };
    
//     // Step 4: Create book folder (fast)
//     console.log('4️⃣ Creating book folder...');
//     const bookFolderPath = path.join(path.dirname(pdfPath), book.title);
//     if (!fs.existsSync(bookFolderPath)) {
//         fs.mkdirSync(bookFolderPath, { recursive: true });
//     }
    
//     // Step 5: Process images from preprocessed data (fast)
//     console.log('5️⃣ Processing images from preprocessed data...');
//     const { images, imagesFolderPath } = extractImagesFromPreprocessedData(preprocessedData, book.title, bookFolderPath);
    
//     // Step 6: Process links from preprocessed data (fast)
//     console.log('6️⃣ Processing links from preprocessed data...');
//     const links = preprocessedData.links;
//     console.log(`   ✅ Found ${links.length} internal links`);
    
//     // Step 7: Detect chapters from preprocessed data (fast)
//     console.log('7️⃣ Detecting chapters from preprocessed data...');
//     const chapters = detectChaptersFromPreprocessedData(preprocessedData, config);
    
//     if (!chapters || chapters.length === 0) {
//         throw new Error('No chapters could be detected from the PDF');
//     }
    
//     // Step 8: Create chunks with images and links (fast)
//     console.log('8️⃣ Creating page-aware chunks...');
//     const allChunks = createPageAwareChunksWithImages(chapters, images, links);
    
//     // Step 9: Resolve links to target chunks (fast)
//     console.log('9️⃣ Resolving links to target chunks...');
//     const resolvedLinks = resolveLinksToTargetChunks(links, allChunks);
    
//     // Step 10: Validate links (fast)
//     console.log('🔟 Validating link destinations...');
//     const validLinks = validateLinkDestinations(resolvedLinks, chapters);
    
//     const processingTime = Date.now() - startTime;
//     const preprocessingTime = preprocessedData.processingTime;
//     const postProcessingTime = processingTime - preprocessingTime;
    
//     console.log(`✅ OPTIMIZED parsing completed in ${processingTime}ms`);
//     console.log(`   📊 Breakdown: Preprocessing: ${preprocessingTime}ms, Post-processing: ${postProcessingTime}ms`);
    
//     return {
//         book,
//         chapters: convertChaptersToDbFormat(chapters),
//         images,
//         links: validLinks,
//         processingTime,
//         preprocessingTime,
//         postProcessingTime,
//         imagesFolderPath,
//         preprocessingErrors: preprocessedData.errors
//     };
// }

// function saveToFile(book, chapters, outputPath, imagesFolderPath) {
//     const output = {
//         book,
//         chapters,
//         metadata: {
//             parsingDate: new Date().toISOString(),
//             imagesFolderPath,
//             optimizedParser: true
//         }
//     };
    
//     fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
//     console.log(`💾 Saved to: ${outputPath}`);
// }

// function generateParserSummary(book, chapters, summaryPath) {
//     const totalChunks = chapters.reduce((sum, ch) => sum + (ch.chunks?.length || 0), 0);
//     const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
//     const totalImages = chapters.reduce((sum, ch) => 
//         sum + (ch.chunks?.reduce((chunkSum, chunk) => chunkSum + (chunk.images?.length || 0), 0) || 0), 0);
//     const totalLinks = chapters.reduce((sum, ch) => 
//         sum + (ch.chunks?.reduce((chunkSum, chunk) => chunkSum + (chunk.links?.length || 0), 0) || 0), 0);

//     const summary = {
//         book: {
//             title: book.title,
//             author: book.author,
//             pageCount: book.pageCount,
//             filename: book.filename
//         },
//         processing: {
//             timestamp: new Date().toISOString(),
//             optimizedParser: true,
//             totalChapters: chapters.length,
//             totalChunks,
//             totalWords,
//             totalImages,
//             totalLinks
//         },
//         chapters: chapters.map(ch => ({
//             number: ch.number,
//             title: ch.title,
//             wordCount: ch.wordCount,
//             chunkCount: ch.chunkCount,
//             pageRange: `${ch.startPageNumber}-${ch.endPageNumber}`,
//             imageCount: ch.chunks?.reduce((sum, chunk) => sum + (chunk.images?.length || 0), 0) || 0,
//             linkCount: ch.chunks?.reduce((sum, chunk) => sum + (chunk.links?.length || 0), 0) || 0
//         }))
//     };

//     fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
//     console.log(`📋 Summary saved to: ${summaryPath}`);
// }

// async function main() {
//     if (process.argv.length < 3) {
//         showHelp();
//         process.exit(1);
//     }

//     const pdfPath = process.argv[2];
//     const configPath = process.argv[3];
//     const outputPath = process.argv[4] || pdfPath.replace('.pdf', '-output-optimized.json');
//     const debugMode = process.argv.includes('--debug');

//     try {
//         const result = await parsePdfBookOptimized(pdfPath, configPath, debugMode);
        
//         saveToFile(result.book, result.chapters, outputPath, result.imagesFolderPath);
        
//         const summaryPath = outputPath.replace('.json', '-summary.json');
//         generateParserSummary(result.book, result.chapters, summaryPath);
        
//         console.log('🎉 OPTIMIZED parsing completed successfully!');
//         console.log(`📈 Performance: ${result.processingTime}ms total (${result.preprocessingTime}ms preprocessing)`);
        
//     } catch (error) {
//         console.error('❌ Error parsing PDF:', error);
//         process.exit(1);
//     }
// }

// async function parseBook(pdfPath, configPath, outputPath, debugMode) {
//     try {
//         const result = await parsePdfBookOptimized(pdfPath, configPath, debugMode);
        
//         if (outputPath) {
//             saveToFile(result.book, result.chapters, outputPath, result.imagesFolderPath);
            
//             const summaryPath = outputPath.replace('.json', '-summary.json');
//             generateParserSummary(result.book, result.chapters, summaryPath);
//         }
        
//         return result;
//     } catch (error) {
//         console.error('Error in parseBook:', error);
//         throw error;
//     }
// }

// function showHelp() {
//     console.log(`
// 📚 OPTIMIZED PDF Book Parser

// Usage: node parse-pdf-book-optimized.js <pdf-path> [config-path] [output-path] [--debug]

// Arguments:
//   pdf-path     Path to the PDF file to parse
//   config-path  Path to the JSON configuration file (optional)
//   output-path  Path for the output JSON file (optional, defaults to <pdf-name>-output-optimized.json)
//   --debug      Enable debug mode for verbose output

// Features:
//   ⚡ Single PDF preprocessing pass (eliminates 5 redundant PDF operations)
//   🔍 Early error detection during preprocessing
//   📊 Detailed performance metrics
//   🧹 Sequential processing for easier debugging

// Examples:
//   node parse-pdf-book-optimized.js book.pdf
//   node parse-pdf-book-optimized.js book.pdf config.json
//   node parse-pdf-book-optimized.js book.pdf config.json output.json --debug
// `);
// }

// // Export functions for use in other modules
// module.exports = {
//     parsePdfBookOptimized,
//     parseBook,
//     loadBookConfig,
//     extractBookMetadata,
//     convertChaptersToDbFormat,
//     createPageAwareChunksWithImages,
//     validateLinkDestinations
// };

// // Run main if this file is executed directly
// if (require.main === module) {
//     main();
// } 