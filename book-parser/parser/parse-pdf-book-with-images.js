const fs = require('fs');
const path = require('path');
const { fromPath } = require('pdf2pic');
const sharp = require('sharp');
const pdfParse = require('pdf-parse');
// Note: S3 upload removed - using local file storage instead
const { loadBookConfig, detectChapters } = require('./parse-pdf-book-generic');

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');

// Disable worker for Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc = false;

/**
 * Auto-detect content start page by finding "Contents" or "Table of Contents"
 */
async function detectContentStartPage(pdfPath) {
    console.log('🔍 Auto-detecting content start page...');

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 20); pageNum++) { // Check first 20 pages
        try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ').toLowerCase();

            // Look for table of contents indicators
            if (pageText.includes('contents') || pageText.includes('table of contents')) {
                console.log(`   📖 Found "Contents" on page ${pageNum}`);

                // Skip much further to get past the entire table of contents
                // Look for the first substantial content after TOC
                let contentStartPage = pageNum + 8; // Start looking from +8 pages after Contents

                // Find first page that looks like actual chapter content (not TOC entry)
                for (let testPageNum = contentStartPage; testPageNum <= Math.min(pdf.numPages, pageNum + 30); testPageNum++) {
                    try {
                        const testPage = await pdf.getPage(testPageNum);
                        const testTextContent = await testPage.getTextContent();
                        const testPageText = testTextContent.items.map(item => item.str).join(' ');

                        // Look for pages that have substantial content (not just TOC entries)
                        // TOC entries are usually short and have page numbers nearby
                        // Real content starts with substantial paragraphs
                        const hasSubstantialContent = testPageText.length > 500; // Substantial text
                        const hasLongSentences = testPageText.includes('.') && testPageText.split('.').some(sentence => sentence.length > 100);
                        const notJustPageNumbers = !/^\s*\d+\s*$/.test(testPageText.trim());

                        if (hasSubstantialContent && hasLongSentences && notJustPageNumbers) {
                            contentStartPage = testPageNum;
                            console.log(`   📖 Found substantial content starting at page ${contentStartPage}`);
                            break;
                        }
                    } catch (testError) {
                        console.log(`   ⚠️ Error testing page ${testPageNum}: ${testError.message}`);
                    }
                }

                console.log(`   📖 Starting content parsing from page ${contentStartPage}`);
                return contentStartPage;
            }
        } catch (error) {
            console.log(`   ⚠️ Error scanning page ${pageNum}: ${error.message}`);
        }
    }

    console.log('   ⚠️ No "Contents" page found, using default start from page 1');
    return 1; // Fallback to page 1
}

/**
 * Extract text content page by page with PDF.js, filtered by chapters
 */
async function extractPageAwareText(pdfPath, chapters) {
    console.log('📄 Extracting text with page awareness...');

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

    // Auto-detect content start page
    const contentStartPage = await detectContentStartPage(pdfPath);

    if (chapters.length === 0) {
        console.log('   ⚠️ No chapters provided, extracting all text');
        // Fallback: extract all pages if no chapters provided, starting from content start
        const pageData = [];
        for (let pageNum = contentStartPage; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .trim();

            if (pageText) {
                // Clean up page text by removing page numbers from the beginning
                let cleanedText = pageText;

                // Extract the page number that appears in the text (if any)
                const pageNumberMatch = pageText.match(/^\d+\s+/);
                const textPageNumber = pageNumberMatch ? parseInt(pageNumberMatch[0]) : null;

                // Remove page number from the beginning of the text
                cleanedText = cleanedText.replace(/^\d+\s+/, '');

                // Also remove common page artifacts
                cleanedText = cleanedText.replace(/^page\s+\d+\s*/i, '');

                // Use the actual page number from text if available, otherwise use PDF page number
                const correctedPageNumber = textPageNumber || pageNum;

                pageData.push({
                    pageNumber: correctedPageNumber,
                    text: cleanedText.trim(),
                    wordCount: cleanedText.trim().split(/\s+/).filter(w => w.length > 0).length
                });
            }
        }
        console.log(`✅ Extracted text from ${pageData.length} pages`);
        return pageData;
    }

    // Start extraction from the detected content start page
    console.log(`   📍 Starting extraction from detected content start page: ${contentStartPage}`);

    const pageData = [];
    let pageOffset = contentStartPage - 1; // Adjust page numbering based on content start

    for (let pageNum = contentStartPage; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .trim();

        if (pageText) {
            // Clean up page text by removing page numbers from the beginning
            let cleanedText = pageText;

            // Extract the page number that appears in the text (if any)
            const pageNumberMatch = pageText.match(/^\d+\s+/);
            const textPageNumber = pageNumberMatch ? parseInt(pageNumberMatch[0]) : null;

            // Remove page number from the beginning of the text
            cleanedText = cleanedText.replace(/^\d+\s+/, '');

            // Also remove common page artifacts
            cleanedText = cleanedText.replace(/^page\s+\d+\s*/i, '');

            // Use the corrected page number (subtract offset if text has page numbers)
            const correctedPageNumber = textPageNumber || (pageNum - pageOffset);

            pageData.push({
                pageNumber: correctedPageNumber,
                text: cleanedText.trim(),
                wordCount: cleanedText.trim().split(/\s+/).filter(w => w.length > 0).length
            });

            if (pageNum % 50 === 0) {
                console.log(`   Processing chapter text from PDF page ${pageNum} (book page ${correctedPageNumber})/${pdf.numPages}`);
            }
        }
    }

    console.log(`✅ Extracted chapter text from ${pageData.length} pages (starting from content page ${contentStartPage})`);
    return pageData;
}

/**
 * Extract embedded images from PDF and save to local folder
 */
async function extractImages(pdfPath, bookTitle, bookFolderPath) {
    console.log('🖼️  Extracting embedded images from PDF...');

    const { execSync } = require('child_process');

    // Create images directory in the book folder
    const bookFolderName = bookTitle.replace(/[^a-zA-Z0-9]/g, '-');
    const imagesDir = path.join(bookFolderPath, 'images', bookFolderName);
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log(`📁 Created images directory: ${imagesDir}`);
    }

    const images = [];

    // Step 1: Use PDF.js to detect which pages have images and how many
    console.log('   🔍 Scanning pages for image locations...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

    const pageImageMap = []; // Array of { pageNumber, imageCount }
    let totalImagesDetected = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
            const page = await pdf.getPage(pageNum);
            const operatorList = await page.getOperatorList();

            let imageCount = 0;
            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const fn = operatorList.fnArray[i];
                if (fn === pdfjsLib.OPS.paintImageXObject) {
                    imageCount++;
                }
            }

            if (imageCount > 0) {
                pageImageMap.push({ pageNumber: pageNum, imageCount });
                totalImagesDetected += imageCount;
                console.log(`     📄 Page ${pageNum}: ${imageCount} image(s)`);
            }
        } catch (pageError) {
            console.log(`     ⚠️ Error scanning page ${pageNum}: ${pageError.message}`);
        }
    }

    console.log(`   📊 Detected ${totalImagesDetected} images across ${pageImageMap.length} pages`);

    try {
        // Step 2: Extract actual images using pdfimages
        const tempDir = path.join(__dirname, '../temp/pdfimages-temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        console.log('   🔧 Extracting embedded images using pdfimages...');
        const tempPrefix = path.join(tempDir, 'image');
        execSync(`pdfimages -all "${pdfPath}" "${tempPrefix}"`, { stdio: 'inherit' });

        // Get list of extracted files
        const extractedFiles = fs.readdirSync(tempDir).filter(file =>
            file.startsWith('image') && /\.(jpg|jpeg|png|ppm|pbm)$/i.test(file)
        );

        console.log(`   📊 Extracted ${extractedFiles.length} image files`);

        // Step 3: Correlate extracted images with page locations
        if (extractedFiles.length === totalImagesDetected) {
            console.log('   ✅ Perfect match: extracted files = detected images');

            let imageFileIndex = 0;
            let globalImageCounter = 1;

            // Go through pages in order and assign extracted images
            for (const pageInfo of pageImageMap) {
                for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                    if (imageFileIndex < extractedFiles.length) {
                        const file = extractedFiles[imageFileIndex];
                        const tempFilePath = path.join(tempDir, file);
                        const finalFileName = `page-${String(pageInfo.pageNumber).padStart(3, '0')}-image-${pageImageIndex + 1}.jpg`;
                        const finalFilePath = path.join(imagesDir, finalFileName);

                        // Copy file to final location
                        fs.copyFileSync(tempFilePath, finalFilePath);

                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: finalFileName,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber})`,
                            originalName: file,
                            extracted: true
                        });

                        console.log(`     ✅ Page ${pageInfo.pageNumber}: ${finalFileName}`);
                        imageFileIndex++;
                        globalImageCounter++;
                    }
                }
            }
        } else {
            console.log(`   ⚠️ Mismatch: extracted ${extractedFiles.length} files but detected ${totalImagesDetected} images`);
            console.log('   🔄 Using fallback approach...');

            // Fallback: distribute extracted images across detected pages proportionally
            let imageFileIndex = 0;
            let globalImageCounter = 1;

            for (const pageInfo of pageImageMap) {
                for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                    if (imageFileIndex < extractedFiles.length) {
                        const file = extractedFiles[imageFileIndex];
                        const tempFilePath = path.join(tempDir, file);
                        const finalFileName = `page-${String(pageInfo.pageNumber).padStart(3, '0')}-image-${pageImageIndex + 1}.jpg`;
                        const finalFilePath = path.join(imagesDir, finalFileName);

                        // Copy file to final location
                        fs.copyFileSync(tempFilePath, finalFilePath);

                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: finalFileName,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber})`,
                            originalName: file,
                            extracted: true
                        });

                        console.log(`     ✅ Page ${pageInfo.pageNumber}: ${finalFileName}`);
                        imageFileIndex++;
                        globalImageCounter++;
                    } else {
                        // Create placeholder for remaining detected images
                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: `page-${pageInfo.pageNumber}-image-${pageImageIndex + 1}.placeholder`,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber}) - Not extracted`,
                            placeholder: true
                        });
                        globalImageCounter++;
                    }
                }
            }
        }

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true });

    } catch (error) {
        console.log(`     ❌ Error extracting images: ${error.message}`);
        console.log('   🔄 Using PDF.js detection only...');

        // Fallback to PDF.js detection with placeholders
        let globalImageCounter = 1;
        for (const pageInfo of pageImageMap) {
            for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                images.push({
                    pageNumber: pageInfo.pageNumber,
                    imageName: `page-${pageInfo.pageNumber}-image-${pageImageIndex + 1}.placeholder`,
                    imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber}) - Detection only`,
                    placeholder: true
                });
                globalImageCounter++;
            }
        }
    }

    console.log(`✅ Processed ${images.length} images with correct page numbers`);

    // Return both images and folder information
    return {
        images,
        imagesFolderPath: `./images/${bookFolderName}`
    };
}

/**
 * Text chunking function (reused from existing parser)
 */
function chunkText(text, minWords = 5, maxWords = 15) {
    const sentencePattern = /([.!?]+)/;
    const parts = text.split(sentencePattern);
    const sentences = [];

    for (let i = 0; i < parts.length; i += 2) {
        const sentence = parts[i]?.trim();
        const punctuation = parts[i + 1] || '';
        if (sentence) {
            sentences.push(sentence + punctuation);
        }
    }

    const chunks = [];
    let currentChunk = '';
    let currentWords = [];
    let wordIndex = 0;

    for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).filter(w => w.length > 0);

        if (currentWords.length > 0 && currentWords.length + sentenceWords.length > maxWords) {
            chunks.push({
                text: currentChunk.trim(),
                words: [...currentWords],
                startIndex: wordIndex - currentWords.length,
                endIndex: wordIndex - 1
            });
            currentChunk = '';
            currentWords = [];
        }

        if (currentChunk.length > 0) {
            currentChunk += ' ';
        }
        currentChunk += sentence.trim();
        currentWords.push(...sentenceWords);
        wordIndex += sentenceWords.length;

        if (currentWords.length >= minWords) {
            chunks.push({
                text: currentChunk.trim(),
                words: [...currentWords],
                startIndex: wordIndex - currentWords.length,
                endIndex: wordIndex - 1
            });
            currentChunk = '';
            currentWords = [];
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push({
            text: currentChunk.trim(),
            words: [...currentWords],
            startIndex: wordIndex - currentWords.length,
            endIndex: wordIndex - 1
        });
    }

    return chunks;
}

/**
 * Create unified chunks with text and images, maintaining page correlation
 */
function createPageAwareChunks(pageData, images, chapters) {
    console.log('🔗 Creating page-aware chunks with images...');

    const allChunks = [];
    let chunkIndex = 0;

    // Create a map of images by page for quick lookup
    const imagesByPage = {};
    images.forEach(image => {
        if (!imagesByPage[image.pageNumber]) {
            imagesByPage[image.pageNumber] = [];
        }
        imagesByPage[image.pageNumber].push(image);
    });

    // Create a set of chapter titles for quick lookup
    const chapterTitles = new Set(chapters.map(ch => ch.title));

    // Process each page
    pageData.forEach(page => {
        // Create text chunks for this page
        const pageTextChunks = chunkText(page.text).map(chunk => {
            // Clean up chunk text by removing standalone page numbers
            let cleanedChunkText = chunk.text;

            // Remove standalone page numbers that might appear in the middle of text
            cleanedChunkText = cleanedChunkText.replace(/\s+\d+\s+/g, ' ');

            // Remove page numbers at the start of sentences
            cleanedChunkText = cleanedChunkText.replace(/^\d+\s+/, '');
            cleanedChunkText = cleanedChunkText.replace(/\.\s*\d+\s+/g, '. ');

            // Clean up extra spaces
            cleanedChunkText = cleanedChunkText.replace(/\s+/g, ' ').trim();

            // Check if this chunk contains a chapter title
            let chunkType = 'text';
            let finalText = cleanedChunkText;

            // Look for chapter titles in the text
            for (const title of chapterTitles) {
                if (cleanedChunkText.includes(title)) {
                    // Check if the chunk is mostly just the chapter title
                    const titleWords = title.split(/\s+/).length;
                    const chunkWords = cleanedChunkText.split(/\s+/).length;

                    // If the chunk is short and contains the title, make it a header
                    if (chunkWords <= titleWords + 3) {
                        chunkType = 'header';
                        finalText = title; // Use just the clean chapter title
                        console.log(`   📋 Found header: "${title}" on page ${page.pageNumber}`);
                        break;
                    } else {
                        // Remove the chapter title from the text chunk
                        finalText = cleanedChunkText.replace(title, '').replace(/\s+/g, ' ').trim();

                        // Create a separate header chunk first
                        allChunks.push({
                            index: chunkIndex++,
                            text: title,
                            wordCount: title.split(/\s+/).filter(w => w.length > 0).length,
                            type: 'header',
                            pageNumber: page.pageNumber
                        });
                        console.log(`   📋 Extracted header: "${title}" on page ${page.pageNumber}`);
                        break;
                    }
                }
            }

            // Only return the chunk if it has content after title removal
            if (finalText && finalText.length > 0) {
                return {
                    index: chunkIndex++,
                    text: finalText,
                    wordCount: finalText.split(/\s+/).filter(w => w.length > 0).length,
                    type: chunkType,
                    pageNumber: page.pageNumber
                };
            }
            return null;
        }).filter(chunk => chunk !== null);

        allChunks.push(...pageTextChunks);

        // Add any images for this page after the text
        const pageImages = imagesByPage[page.pageNumber] || [];
        pageImages.forEach(image => {
            allChunks.push({
                index: chunkIndex++,
                text: "",
                wordCount: 0,
                type: 'image',
                pageNumber: page.pageNumber,
                imageName: image.imageName,
                imageAlt: image.imageAlt
            });
        });
    });

    const textCount = allChunks.filter(c => c.type === 'text').length;
    const imageCount = allChunks.filter(c => c.type === 'image').length;
    const headerCount = allChunks.filter(c => c.type === 'header').length;

    console.log(`✅ Created ${allChunks.length} total chunks (${textCount} text, ${imageCount} image, ${headerCount} header)`);
    return allChunks;
}

/**
 * Map chunks to chapters based on actual chapter titles in content
 */
function mapChunksToChapters(allChunks, chapters) {
    console.log('📚 Mapping chunks to chapters based on content...');

    // Find where each chapter actually starts in the chunks
    const chapterStartIndices = [];
    const foundHeaders = [];

    // First pass: find EARLIEST occurrence of each chapter header (ignore bibliography)
    for (let i = 0; i < chapters.length; i++) {
        const chapterTitle = chapters[i].title;
        let startIndex = -1;
        let earliestChunkIndex = -1;

        // Look for ALL occurrences and pick the earliest one (likely actual content, not references)
        for (let j = 0; j < allChunks.length; j++) {
            const chunk = allChunks[j];
            if ((chunk.type === 'header' && chunk.text === chapterTitle) ||
                (chunk.type === 'text' && chunk.text.includes(chapterTitle))) {

                if (earliestChunkIndex === -1) {
                    // First occurrence - likely the actual chapter start
                    earliestChunkIndex = j;
                    startIndex = j;
                    console.log(`   📖 Found "${chapterTitle}" at chunk ${j} (page ${chunk.pageNumber}) as ${chunk.type}`);
                } else {
                    // Later occurrence - likely bibliography reference, ignore but log
                    console.log(`   📚 Ignoring later occurrence of "${chapterTitle}" at chunk ${j} (page ${chunk.pageNumber}) - likely reference`);
                }
            }
        }

        if (startIndex !== -1) {
            foundHeaders.push({ chapterIndex: i, chunkIndex: startIndex, title: chapterTitle });
        }

        chapterStartIndices.push(startIndex);
    }

    // Second pass: sort found headers by chunk position and fix missing chapters
    if (foundHeaders.length > 0) {
        // Sort headers by their chunk position (not config order)
        foundHeaders.sort((a, b) => a.chunkIndex - b.chunkIndex);

        const firstFoundChunkIndex = foundHeaders[0].chunkIndex;
        const firstFoundChapterIndex = foundHeaders[0].chapterIndex;

        console.log(`   📋 First header found: "${foundHeaders[0].title}" at chunk ${firstFoundChunkIndex}`);

        // Find chapters that appear before the first found header in config order
        // Also include chapters found in bibliography (late occurrences) as missing
        const missingChaptersBeforeFirst = [];
        for (let i = 0; i < firstFoundChapterIndex; i++) {
            if (chapterStartIndices[i] === -1 || chapterStartIndices[i] > firstFoundChunkIndex) {
                // Chapter either not found OR found after first real header (likely bibliography)
                missingChaptersBeforeFirst.push(i);
                if (chapterStartIndices[i] > firstFoundChunkIndex) {
                    console.log(`   🔧 Treating "${chapters[i].title}" as missing (found in bibliography at chunk ${chapterStartIndices[i]})`);
                }
            }
        }

        if (missingChaptersBeforeFirst.length > 0 && firstFoundChunkIndex > 0) {
            // Distribute content before first found header among missing chapters
            const chunksPerMissingChapter = Math.floor(firstFoundChunkIndex / missingChaptersBeforeFirst.length);

            missingChaptersBeforeFirst.forEach((chapterIndex, position) => {
                const startChunk = position * chunksPerMissingChapter;
                chapterStartIndices[chapterIndex] = startChunk;
                console.log(`   🔧 Fixed missing chapter "${chapters[chapterIndex].title}" at chunk ${startChunk}`);
            });
        }
    }

    // Handle remaining missing chapters
    for (let i = 0; i < chapters.length; i++) {
        if (chapterStartIndices[i] === -1) {
            if (i === 0) {
                chapterStartIndices[i] = 0;
                console.log(`   📖 First chapter "${chapters[i].title}" starts at beginning`);
            } else {
                const averageChapterLength = Math.floor(allChunks.length / chapters.length);
                chapterStartIndices[i] = i * averageChapterLength;
                console.log(`   ⚠️ Could not find "${chapters[i].title}", estimating at chunk ${chapterStartIndices[i]}`);
            }
        }
    }

    // Create chapter mappings based on actual start positions
    const enhancedChapters = chapters.map((chapter, index) => {
        const startIndex = chapterStartIndices[index];
        const endIndex = index < chapters.length - 1 ?
            chapterStartIndices[index + 1] :
            allChunks.length;

        const chapterChunks = allChunks.slice(startIndex, endIndex).map((chunk, localIndex) => ({
            ...chunk,
            index: localIndex  // Re-index within chapter
        }));

        const wordCount = chapterChunks
            .filter(chunk => chunk.type === 'text')
            .reduce((sum, chunk) => sum + chunk.wordCount, 0);

        console.log(`   📚 Chapter ${index + 1}: "${chapter.title}" - ${chapterChunks.length} chunks, ${wordCount} words`);

        return {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            content: {
                chunks: chapterChunks
            },
            wordCount: wordCount
        };
    });

    console.log('✅ Successfully mapped chunks to chapters based on content');
    return enhancedChapters;
}

/**
 * Extract book metadata from PDF
 */
function extractBookMetadata(pdfData, filename, config) {
    const info = pdfData.info || {};

    let title = config.metadata.title || info.Title ||
        filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

    if (!config.metadata.title) {
        title = title.split('__').map(part =>
            part.split(/[-_]/).map(word =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
        ).join(': ');
    }

    const author = config.metadata.author || info.Author || info.Creator || 'Unknown Author';

    return {
        title,
        author,
        description: `Book parsed from PDF with images: ${filename}`,
        language: 'en-US',
        isPublic: true
    };
}

/**
 * Find the first PDF file in a directory
 */
function findPdfFile(bookFolderPath) {
    const files = fs.readdirSync(bookFolderPath);
    const pdfFile = files.find(file => file.toLowerCase().endsWith('.pdf'));

    if (!pdfFile) {
        throw new Error(`No PDF file found in folder: ${bookFolderPath}`);
    }

    return path.join(bookFolderPath, pdfFile);
}

/**
 * Find config.json file in a directory
 */
function findConfigFile(bookFolderPath) {
    const configPath = path.join(bookFolderPath, 'config.json');

    if (!fs.existsSync(configPath)) {
        throw new Error(`No config.json file found in folder: ${bookFolderPath}`);
    }

    return configPath;
}

/**
 * Main parsing function with image support
 */
async function parsePdfWithImages(bookFolderPath) {
    console.log(`🚀 Starting PDF parsing with image support...`);
    console.log(`📁 Book folder: ${bookFolderPath}`);

    // Find PDF and config files
    const pdfPath = findPdfFile(bookFolderPath);
    const configPath = findConfigFile(bookFolderPath);

    console.log(`📄 Found PDF: ${path.basename(pdfPath)}`);
    console.log(`⚙️ Found config: ${path.basename(configPath)}`);

    const config = loadBookConfig(configPath);

    // Extract basic PDF info for metadata
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfjsLib.getDocument(pdfBuffer).promise;

    console.log(`📊 PDF Info: ${pdfData.numPages} pages`);

    // Extract metadata
    const filename = path.basename(pdfPath);
    const bookMetadata = extractBookMetadata({ info: pdfData._pdfInfo }, filename, config);

    // Step 1: Detect chapters from full text first
    const parseBuffer = fs.readFileSync(pdfPath);
    const parseData = await pdfParse(parseBuffer);
    const chapters = detectChapters(parseData.text, config);
    console.log(`📖 Detected ${chapters.length} chapters from full text`);

    // Step 2: Extract text with page awareness (filtered by chapters)
    const pageData = await extractPageAwareText(pdfPath, chapters);

    // Step 3: Extract images (from entire book)
    const { images, imagesFolderPath } = await extractImages(pdfPath, bookMetadata.title, bookFolderPath);

    // Step 4: Create page-aware chunks
    const allChunks = createPageAwareChunks(pageData, images, chapters);

    // Step 5: Map chunks to chapters
    const enhancedChapters = mapChunksToChapters(allChunks, chapters);

    // Calculate totals
    const totalWords = enhancedChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    const totalChapters = enhancedChapters.length;

    // Use first image as cover image
    const coverImage = images.length > 0 ? images[0].imageName : null;

    const book = {
        ...bookMetadata,
        totalChapters,
        totalWords,
        coverImage,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    return { book, chapters: enhancedChapters, imagesFolderPath };
}

/**
 * Save to file
 */
function saveToFile(book, chapters, outputPath, imagesFolderPath) {
    const output = {
        book,
        chapters,
        metadata: {
            parsedAt: new Date().toISOString(),
            totalChapters: chapters.length,
            totalWords: book.totalWords,
            avgWordsPerChapter: Math.round(book.totalWords / chapters.length),
            hasImages: chapters.some(ch => ch.content.chunks.some(chunk => chunk.type === 'image')),
            totalImages: chapters.reduce((sum, ch) =>
                sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0),
            imagesFolderPath: imagesFolderPath || null
        }
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`📄 Output saved to: ${outputPath}`);
}

/**
 * Main execution
 */
async function main() {
    try {
        const args = process.argv.slice(2);
        const bookFolderPath = args[0];

        if (!bookFolderPath) {
            console.error('❌ Book folder path is required');
            showHelp();
            process.exit(1);
        }

        if (!fs.existsSync(bookFolderPath)) {
            console.error(`❌ Book folder not found: ${bookFolderPath}`);
            process.exit(1);
        }

        if (!fs.statSync(bookFolderPath).isDirectory()) {
            console.error(`❌ Path is not a directory: ${bookFolderPath}`);
            process.exit(1);
        }

        console.log('🚀 Starting PDF book parsing with images...');

        const { book, chapters, imagesFolderPath } = await parsePdfWithImages(bookFolderPath);

        const outputPath = path.join(bookFolderPath, 'output.json');
        saveToFile(book, chapters, outputPath, imagesFolderPath);

        const totalImages = chapters.reduce((sum, ch) =>
            sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);

        console.log('✅ Book parsed and saved successfully!');
        console.log(`📖 Title: "${book.title}"`);
        console.log(`👤 Author: ${book.author}`);
        console.log(`📚 Chapters: ${chapters.length}`);
        console.log(`📝 Total words: ${book.totalWords.toLocaleString()}`);
        console.log(`🖼️ Total images: ${totalImages}`);
        console.log(`📄 Output file: ${outputPath}`);

    } catch (error) {
        console.error('❌ Error parsing PDF:', error);
        process.exit(1);
    }
}

/**
 * CLI usage help
 */
function showHelp() {
    console.log(`
Usage: node parse-pdf-book-with-images.js BOOK_FOLDER_PATH

Arguments:
  BOOK_FOLDER_PATH    Path to the book folder containing:
                      - A PDF file (the first .pdf file found)
                      - config.json (book configuration file)

Output:
  Creates output.json in the same folder
  Creates images/ subfolder with extracted images

Examples:
  node parse-pdf-book-with-images.js ./books/my-book/
  node parse-pdf-book-with-images.js /path/to/book-folder/

Book folder structure:
  my-book/
  ├── book.pdf          # Any PDF file
  ├── config.json       # Book configuration
  ├── output.json       # Generated output (after parsing)
  └── images/           # Generated images folder (after parsing)
      └── Book-Title/
          ├── page-001-image-1.jpg
          └── ...

This enhanced parser extracts both text and images with page correlation.
`);
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { parsePdfWithImages, extractPageAwareText, extractImages, detectContentStartPage }; 