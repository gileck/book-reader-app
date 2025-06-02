const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
const Canvas = require('canvas');
const { loadBookConfig, detectChapters } = require('./parse-pdf-book-generic');

// Disable worker for Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc = false;

/**
 * Extract embedded images with accurate detection and canvas rendering
 */
async function extractEmbeddedImages(pdfPath, bookTitle) {
    console.log('🖼️  Extracting embedded images with Enhanced PDF.js...');

    const bookSlug = bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const imagesDir = path.join(__dirname, '../public/images', bookSlug);

    // Ensure images directory exists
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

    const images = [];
    let totalImagesFound = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (pageNum % 10 === 0) {
            console.log(`   📄 Processing page ${pageNum}/${pdf.numPages}...`);
        }

        try {
            const page = await pdf.getPage(pageNum);
            const operatorList = await page.getOperatorList();

            // Count images on this page
            let pageImageCount = 0;
            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const fn = operatorList.fnArray[i];
                if (fn === pdfjsLib.OPS.paintImageXObject) {
                    pageImageCount++;
                }
            }

            // If page has images, extract them using canvas rendering
            if (pageImageCount > 0) {
                console.log(`     🖼️  Found ${pageImageCount} image(s) on page ${pageNum}`);

                // Get page dimensions
                const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

                // Create canvas
                const canvas = Canvas.createCanvas(viewport.width, viewport.height);
                const canvasContext = canvas.getContext('2d');

                // Render page to canvas
                const renderContext = {
                    canvasContext: canvasContext,
                    viewport: viewport
                };

                await page.render(renderContext).promise;

                // Extract each image on the page
                for (let imgIndex = 0; imgIndex < pageImageCount; imgIndex++) {
                    totalImagesFound++;

                    const fileName = `page-${pageNum.toString().padStart(3, '0')}-image-${imgIndex + 1}.png`;
                    const filePath = path.join(imagesDir, fileName);

                    // For now, save the entire page since we detected images on it
                    // This gives us the full context where images appear
                    const buffer = canvas.toBuffer('image/png');
                    fs.writeFileSync(filePath, buffer);

                    const imageUrl = `/images/${bookSlug}/${fileName}`;

                    images.push({
                        pageNumber: pageNum,
                        imageUrl: imageUrl,
                        imageAlt: `Figure ${totalImagesFound} from page ${pageNum}`,
                        fileName: fileName,
                        filePath: filePath
                    });

                    console.log(`       💾 Saved: ${fileName}`);
                }
            }

        } catch (pageError) {
            console.warn(`     ⚠️ Error processing page ${pageNum}: ${pageError.message}`);
        }
    }

    console.log(`   ✅ Total images extracted: ${totalImagesFound}`);
    console.log(`   📁 Images saved to: ${imagesDir}`);

    return images;
}

/**
 * Extract text content page by page with PDF.js
 */
async function extractPageAwareText(pdfPath) {
    console.log('📄 Extracting text with page awareness...');

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

    const pageData = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (pageNum % 25 === 0) {
            console.log(`   Processing page ${pageNum}/${pdf.numPages}...`);
        }

        try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Combine text items
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .replace(/\\s+/g, ' ')
                .trim();

            if (pageText.length > 0) {
                pageData.push({
                    pageNumber: pageNum,
                    text: pageText
                });
            }

        } catch (pageError) {
            console.warn(`   ⚠️ Error processing page ${pageNum}: ${pageError.message}`);
        }
    }

    console.log(`   ✅ Extracted text from ${pageData.length} pages`);
    return pageData;
}

/**
 * Create text chunks with page correlation and image integration
 */
function createPageAwareChunks(pageData, images, wordsPerChunk = 12) {
    console.log('🔗 Creating page-aware chunks with image integration...');

    const chunks = [];
    let chunkIndex = 0;

    // Group images by page for easy lookup
    const imagesByPage = {};
    images.forEach(img => {
        if (!imagesByPage[img.pageNumber]) {
            imagesByPage[img.pageNumber] = [];
        }
        imagesByPage[img.pageNumber].push(img);
    });

    pageData.forEach(page => {
        const words = page.text.split(/\\s+/).filter(word => word.length > 0);

        // Add images at the beginning of the page if any exist
        if (imagesByPage[page.pageNumber]) {
            imagesByPage[page.pageNumber].forEach(img => {
                chunks.push({
                    index: chunkIndex++,
                    text: `[Image: ${img.imageAlt}]`,
                    wordCount: 0,
                    type: 'image',
                    pageNumber: page.pageNumber,
                    imageUrl: img.imageUrl,
                    imageAlt: img.imageAlt
                });
            });
        }

        // Create text chunks from the page
        for (let i = 0; i < words.length; i += wordsPerChunk) {
            const chunkWords = words.slice(i, i + wordsPerChunk);
            const chunkText = chunkWords.join(' ');

            chunks.push({
                index: chunkIndex++,
                text: chunkText,
                wordCount: chunkWords.length,
                type: 'text',
                pageNumber: page.pageNumber
            });
        }
    });

    console.log(`   ✅ Created ${chunks.length} chunks (${chunks.filter(c => c.type === 'image').length} images, ${chunks.filter(c => c.type === 'text').length} text)`);
    return chunks;
}

/**
 * Main parsing function
 */
async function parseBookWithImages(pdfPath, configPath, outputPath) {
    try {
        console.log('🚀 Starting Enhanced PDF Parsing with Image Support');
        console.log('================================================');
        console.log(`📄 PDF: ${pdfPath}`);
        console.log(`⚙️ Config: ${configPath}`);
        console.log(`💾 Output: ${outputPath}`);
        console.log('');

        // Load configuration
        const config = loadBookConfig(configPath);

        // Extract basic PDF info for metadata
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdfjsLib.getDocument(pdfBuffer).promise;

        // Extract images first
        const bookTitle = config.title || config.metadata?.title || 'unknown-book';
        const images = await extractEmbeddedImages(pdfPath, bookTitle);

        // Extract page-aware text
        const pageData = await extractPageAwareText(pdfPath);

        // Create unified chunks with page correlation
        const chunks = createPageAwareChunks(pageData, images, config.wordsPerChunk || 12);

        // Convert chunks back to text for chapter detection
        const textForChapterDetection = chunks
            .filter(chunk => chunk.type === 'text')
            .map(chunk => chunk.text)
            .join('\n');

        // Detect chapters (preserve existing logic)
        const chapters = detectChapters(textForChapterDetection, config);

        // Build final book data structure
        const bookData = {
            title: bookTitle,
            author: config.author || config.metadata?.author,
            description: config.description,
            totalPages: pdfData.numPages,
            totalChunks: chunks.length,
            totalImages: images.length,
            chapters: chapters,
            chunks: chunks,
            metadata: {
                pdfFormatVersion: pdfData._pdfInfo?.PDFFormatVersion || 'unknown',
                pageCount: pdfData.numPages,
                imageCount: images.length,
                textChunks: chunks.filter(c => c.type === 'text').length,
                imageChunks: chunks.filter(c => c.type === 'image').length,
                wordsPerChunk: config.wordsPerChunk || 12,
                parsedAt: new Date().toISOString()
            }
        };

        // Save to file
        fs.writeFileSync(outputPath, JSON.stringify(bookData, null, 2));

        console.log('');
        console.log('🎉 PARSING COMPLETE!');
        console.log('====================');
        console.log(`📚 Book: ${bookTitle}`);
        console.log(`📄 Pages: ${pdfData.numPages}`);
        console.log(`🔤 Text chunks: ${chunks.filter(c => c.type === 'text').length}`);
        console.log(`🖼️  Image chunks: ${chunks.filter(c => c.type === 'image').length}`);
        console.log(`📖 Chapters: ${chapters.length}`);
        console.log(`💾 Saved to: ${outputPath}`);
        console.log(`📁 Images in: public/images/${bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`);

        return bookData;

    } catch (error) {
        console.error('❌ Parsing failed:', error);
        throw error;
    }
}

// Command line execution
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node parse-pdf-book-optimized.js <pdf-path> <config-path> [output-path]');
        process.exit(1);
    }

    const [pdfPath, configPath, outputPath = 'parsed-book-optimized.json'] = args;
    parseBookWithImages(pdfPath, configPath, outputPath);
}

module.exports = {
    parseBookWithImages,
    extractEmbeddedImages,
    extractPageAwareText,
    createPageAwareChunks
}; 