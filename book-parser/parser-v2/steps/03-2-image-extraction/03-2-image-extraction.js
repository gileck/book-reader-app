const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { execSync } = require('child_process');

/**
 * Step 3-2: Image Extraction
 * 
 * Takes pages from Step 3-1 and extracts images from PDF, adding an images array to each page
 * containing the images found on that specific page.
 * 
 * Process:
 * 1. Extract embedded images from PDF using pdfimages command
 * 2. Detect which pages have images using PDF.js
 * 3. Map extracted images to their corresponding pages
 * 4. Add images array to each page with image names and alt text
 * 
 * Input: chapters[] with pages[] from Step 3-1
 * Output: chapters[] with pages[] containing images[] array
 */

/**
 * Execute image extraction step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated pipeline state with images added to pages
 */
async function execute(pipelineState, config) {
    const startTime = Date.now();

    try {
        // Validate prerequisites
        if (!pipelineState.chapters || pipelineState.chapters.length === 0) {
            throw new Error('Step 3-1 (link detection) must be completed first. No chapters found in pipeline state.');
        }

        // Check if PDF path is available
        if (!config.PDF_PATH || !fs.existsSync(config.PDF_PATH)) {
            throw new Error('PDF file is required for image extraction. Check PDF_PATH in config.');
        }

        // Extract images from PDF
        const { images, imagesFolderPath } = await extractImages(config.PDF_PATH, config);

        // Process each chapter
        const processedChapters = [];
        let totalImagesAdded = 0;

        for (const chapter of pipelineState.chapters) {
            // Add images to each page in the chapter
            const pagesWithImages = addImagesToPages(chapter.pages, images);
            const chapterImagesCount = pagesWithImages.reduce((sum, page) => sum + (page.images ? page.images.length : 0), 0);
            totalImagesAdded += chapterImagesCount;

            const processedChapter = {
                ...chapter,
                pages: pagesWithImages
            };

            processedChapters.push(processedChapter);
        }

        // Generate debug output
        const debugOutput = {
            imageExtractionMetadata: {
                totalImages: totalImagesAdded,
                totalExtractedImages: images.length,
                imagesFolderPath: imagesFolderPath,
                processingTime: Date.now() - startTime,
                extractionTime: new Date().toISOString(),
                note: "Image extraction and mapping to pages"
            },
            extractedImages: images,
            chapters: processedChapters
        };

        const debugFile = path.join(config.DEBUG_DIR, 'step-03-2-image-extraction.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));

        return {
            chapters: processedChapters,
            metadata: {
                ...pipelineState.metadata,
                imageExtraction: {
                    totalImages: totalImagesAdded,
                    totalExtractedImages: images.length,
                    imagesFolderPath: imagesFolderPath,
                    processingTime: Date.now() - startTime,
                    extractionTime: new Date().toISOString()
                }
            }
        };

    } catch (error) {
        console.error('❌ Image extraction failed:', error.message);
        throw error;
    }
}

/**
 * Extract embedded images from PDF and save to local folder
 * @param {string} pdfPath - Path to PDF file
 * @param {Object} config - Configuration object
 * @returns {Object} Object containing images array and folder path: { images: Array, imagesFolderPath: string }
 */
async function extractImages(pdfPath, config) {
    // Create images directory in the output folder
    const imagesDir = path.join(config.OUTPUT_DIR, 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const images = [];

    // Step 1: Use PDF.js to detect which pages have images and how many
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
                pageImageMap.push({ pageNumber: pageNum - 1, imageCount }); // Convert to 0-based
                totalImagesDetected += imageCount;
            }
        } catch (pageError) {
            // Skip pages with errors
        }
    }

    try {
        // Step 2: Extract actual images using pdfimages
        const tempDir = path.join(__dirname, '../../temp/pdfimages-temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempPrefix = path.join(tempDir, 'image');
        execSync(`pdfimages -all "${pdfPath}" "${tempPrefix}"`, { stdio: 'inherit' });

        // Get list of extracted files
        const extractedFiles = fs.readdirSync(tempDir).filter(file =>
            file.startsWith('image') && /\.(jpg|jpeg|png|ppm|pbm)$/i.test(file)
        );

        // Step 3: Correlate extracted images with page locations
        if (extractedFiles.length === totalImagesDetected) {
            let imageFileIndex = 0;
            let globalImageCounter = 1;

            // Go through pages in order and assign extracted images
            for (const pageInfo of pageImageMap) {
                for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                    if (imageFileIndex < extractedFiles.length) {
                        const file = extractedFiles[imageFileIndex];
                        const tempFilePath = path.join(tempDir, file);
                        const finalFileName = `page-${String(pageInfo.pageNumber + 1).padStart(3, '0')}-image-${pageImageIndex + 1}.jpg`;
                        const finalFilePath = path.join(imagesDir, finalFileName);

                        // Copy file to final location
                        fs.copyFileSync(tempFilePath, finalFilePath);

                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: finalFileName,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber + 1})`,
                            originalName: file,
                            extracted: true
                        });

                        imageFileIndex++;
                        globalImageCounter++;
                    }
                }
            }
        } else {
            // Fallback: distribute extracted images across detected pages proportionally
            let imageFileIndex = 0;
            let globalImageCounter = 1;

            for (const pageInfo of pageImageMap) {
                for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                    if (imageFileIndex < extractedFiles.length) {
                        const file = extractedFiles[imageFileIndex];
                        const tempFilePath = path.join(tempDir, file);
                        const finalFileName = `page-${String(pageInfo.pageNumber + 1).padStart(3, '0')}-image-${pageImageIndex + 1}.jpg`;
                        const finalFilePath = path.join(imagesDir, finalFileName);

                        // Copy file to final location
                        fs.copyFileSync(tempFilePath, finalFilePath);

                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: finalFileName,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber + 1})`,
                            originalName: file,
                            extracted: true
                        });

                        imageFileIndex++;
                        globalImageCounter++;
                    } else {
                        // Create placeholder for remaining detected images
                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: `page-${pageInfo.pageNumber + 1}-image-${pageImageIndex + 1}.placeholder`,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber + 1}) - Not extracted`,
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
        // Fallback to PDF.js detection with placeholders
        let globalImageCounter = 1;
        for (const pageInfo of pageImageMap) {
            for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                images.push({
                    pageNumber: pageInfo.pageNumber,
                    imageName: `page-${pageInfo.pageNumber + 1}-image-${pageImageIndex + 1}.placeholder`,
                    imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber + 1}) - Detection only`,
                    placeholder: true
                });
                globalImageCounter++;
            }
        }
    }

    // Return both images and folder information
    return {
        images,
        imagesFolderPath: imagesDir
    };
}

/**
 * Add images to pages by mapping extracted images to their corresponding pages
 * @param {Array} pages - Array of page objects
 * @param {Array} extractedImages - Array of extracted image objects
 * @returns {Array} Pages with images added
 */
function addImagesToPages(pages, extractedImages) {
    // Safety checks
    if (!pages || !Array.isArray(pages)) {
        console.error('addImagesToPages: pages is not an array:', pages);
        return pages || [];
    }
    if (!extractedImages || !Array.isArray(extractedImages)) {
        console.error('addImagesToPages: extractedImages is not an array:', extractedImages);
        return pages;
    }

    // Initialize all pages with empty image arrays
    const pagesWithImages = pages.map(page => ({
        ...page,
        images: []
    }));

    // Map images to their corresponding pages
    for (const page of pagesWithImages) {
        // Safety check for page object
        if (!page || typeof page.pageNumber !== 'number') {
            console.error('addImagesToPages: Invalid page object:', page);
            continue;
        }

        // Find images that belong to this page
        const pageImages = extractedImages.filter(image =>
            image && image.pageNumber === page.pageNumber
        );

        // Add images to the page
        page.images = pageImages.map(image => ({
            imageName: image.imageName,
            imageAlt: image.imageAlt,
            extracted: image.extracted || false,
            placeholder: image.placeholder || false,
            originalName: image.originalName
        }));
    }

    return pagesWithImages;
}

const { validate } = require('./03-2-image-extraction-validation');

module.exports = { execute, validate }; 