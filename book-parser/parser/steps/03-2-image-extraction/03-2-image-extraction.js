const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { execSync } = require('child_process');

/**
 * Step 3-2: Image Extraction
 * 
 * Takes chapters from Step 3-1 and extracts images from PDF, inserting inline image markers
 * (e.g., [[IMG id=<string> index=<int> alt="<string>"]]) into chapter content to preserve
 * original placement without relying on page numbers.
 * 
 * Process:
 * 1. Extract embedded images from PDF using pdfimages command
 * 2. Detect which pages have images using PDF.js
 * 3. Map extracted images to their corresponding pages
 * 4. Add images array to each page with image names and alt text
 * 
 * Input: chapters[] from Step 3-1
 * Output: chapters[] with chapter-level content containing [[IMG ...]] markers
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
            // Build chapter concatenated content (with single newlines between pages)
            const pieces = [];
            const pageOffsets = new Map();
            let offset = 0;
            for (const p of chapter.pages) {
                pageOffsets.set(p.pageNumber, offset);
                const t = typeof p.content === 'string' ? p.content : '';
                pieces.push(t);
                offset += t.length + 1; // add 1 for inserted newline
            }
            let chapterContent = pieces.join('\n');

            // Insert markers using enhanced spatial positioning
            // Filter and assign index first
            const chapterImages = images.filter(i => !i.placeholder && pageOffsets.has(i.pageNumber));
            chapterImages.forEach((info, idx) => {
                info.chapterIndex = idx;
            });

            // Process images in REVERSE order (last page first) to avoid offset corruption
            // When inserting text at position N, all positions > N shift, but positions < N remain valid
            for (let i = chapterImages.length - 1; i >= 0; i--) {
                const info = chapterImages[i];
                const pageStart = pageOffsets.get(info.pageNumber);

                const id = info.imageName.replace(/\.[^.]+$/, '');
                const alt = info.imageAlt || id;
                const marker = `[[IMG id=${id} index=${info.chapterIndex} alt="${alt}"]]`;

                // Simple positioning: always at BOTTOM of page
                const pageEnd = pageOffsets.get(info.pageNumber + 1) || chapterContent.length;
                const insertAt = pageEnd; // Always insert at the end of the page content

                // Insert marker with proper line separation
                const needsNewlineBefore = insertAt > 0 && chapterContent.charAt(insertAt - 1) !== '\n';
                const needsNewlineAfter = insertAt < chapterContent.length && chapterContent.charAt(insertAt) !== '\n';

                const prefix = needsNewlineBefore ? '\n' : '';
                const suffix = needsNewlineAfter ? '\n' : '';

                chapterContent = chapterContent.slice(0, insertAt) + prefix + marker + suffix + chapterContent.slice(insertAt);

                // Also insert into the individual page content for downstream processing
                const targetPage = chapter.pages.find(p => p.pageNumber === info.pageNumber);
                if (targetPage && typeof targetPage.content === 'string') {
                    const pageContent = targetPage.content;
                    const pageInsertAt = pageContent.length; // Always at the end
                    const prefix = '\n'; // Always add newline before
                    targetPage.content = pageContent + prefix + marker;
                }
                if (targetPage && typeof targetPage.rawContent === 'string') {
                    const rawContent = targetPage.rawContent;
                    const rawInsertAt = rawContent.length; // Always at the end
                    const prefix = '\n'; // Always add newline before
                    targetPage.rawContent = rawContent + prefix + marker;
                }
                totalImagesAdded += 1;
            }

            const processedChapter = {
                ...chapter,
                content: chapterContent
            };

            processedChapters.push(processedChapter);
        }

        // Recompute marker total from chapter content to ensure consistency
        const markerRegex = /\[\[IMG\s+id=([^\s\]]+)\s+index=(\d+)\s+alt=\"([^\"]*)\"\]\]/g;
        let markerTotal = 0;
        for (const ch of processedChapters) {
            if (typeof ch.content === 'string') {
                const matches = ch.content.match(markerRegex);
                if (matches) markerTotal += matches.length;
            }
        }

        // Generate debug output
        const debugOutput = {
            imageExtractionMetadata: {
                totalImages: markerTotal,
                totalExtractedImages: images.filter(i => i.extracted).length,
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
                    totalImages: markerTotal,
                    totalExtractedImages: images.filter(i => i.extracted).length,
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

    // Step 1: Use PDF.js to detect images with spatial information and surrounding text
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

    const pageImageMap = []; // Array of { pageNumber, imageCount, images: [...] }
    let totalImagesDetected = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
            const page = await pdf.getPage(pageNum);
            const operatorList = await page.getOperatorList();
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1.0 });

            // Extract images with spatial information
            const pageImages = await extractImageSpatialInfo(operatorList, textContent, viewport, pageNum - 1);

            if (pageImages.length > 0) {
                pageImageMap.push({
                    pageNumber: pageNum - 1, // Convert to 0-based
                    imageCount: pageImages.length,
                    images: pageImages
                });
                totalImagesDetected += pageImages.length;
            }
        } catch (pageError) {
            // Skip pages with errors
            console.warn(`Warning: Could not process page ${pageNum} for image detection:`, pageError.message);
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

        // Step 3: Correlate extracted images with page locations and spatial data
        if (extractedFiles.length === totalImagesDetected) {
            let imageFileIndex = 0;
            let globalImageCounter = 1;

            // Go through pages in order and assign extracted images with spatial data
            for (const pageInfo of pageImageMap) {
                for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                    if (imageFileIndex < extractedFiles.length) {
                        const file = extractedFiles[imageFileIndex];
                        const tempFilePath = path.join(tempDir, file);
                        const finalFileName = `image-${String(pageInfo.pageNumber + 1).padStart(3, '0')}-${pageImageIndex + 1}.jpg`;
                        const finalFilePath = path.join(imagesDir, finalFileName);

                        // Copy file to final location
                        fs.copyFileSync(tempFilePath, finalFilePath);

                        // Get spatial data for this image
                        const spatialData = pageInfo.images && pageInfo.images[pageImageIndex] || {};

                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: finalFileName,
                            imageAlt: `Figure ${globalImageCounter}`,
                            originalName: file,
                            extracted: true,
                            // Enhanced spatial information
                            position: spatialData.position || 'MID',
                            relativeY: Math.min(1.0, spatialData.relativeY || 0.5), // Clamp to valid range
                            normalizedY: spatialData.normalizedY || (spatialData.pageHeight || 842) * 0.5,
                            pageHeight: spatialData.pageHeight || 842,
                            textBefore: spatialData.textBefore || '',
                            textAfter: spatialData.textAfter || '',
                            nearestText: spatialData.nearestText || '',
                            spatialData: spatialData
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
                        const finalFileName = `image-${String(pageInfo.pageNumber + 1).padStart(3, '0')}-${pageImageIndex + 1}.jpg`;
                        const finalFilePath = path.join(imagesDir, finalFileName);

                        // Copy file to final location
                        fs.copyFileSync(tempFilePath, finalFilePath);

                        // Get spatial data for this image (fallback)
                        const spatialData = pageInfo.images && pageInfo.images[pageImageIndex] || {};

                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: finalFileName,
                            imageAlt: `Figure ${globalImageCounter}`,
                            originalName: file,
                            extracted: true,
                            // Enhanced spatial information (fallback)
                            position: spatialData.position || 'MID',
                            relativeY: Math.min(1.0, spatialData.relativeY || 0.5), // Clamp to valid range
                            normalizedY: spatialData.normalizedY || (spatialData.pageHeight || 842) * 0.5,
                            pageHeight: spatialData.pageHeight || 842,
                            textBefore: spatialData.textBefore || '',
                            textAfter: spatialData.textAfter || '',
                            nearestText: spatialData.nearestText || '',
                            spatialData: spatialData
                        });

                        imageFileIndex++;
                        globalImageCounter++;
                    } else {
                        // Create placeholder for remaining detected images
                        const spatialData = pageInfo.images && pageInfo.images[pageImageIndex] || {};
                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: `image-${pageInfo.pageNumber + 1}-${pageImageIndex + 1}.placeholder`,
                            imageAlt: `Figure ${globalImageCounter} - Not extracted`,
                            placeholder: true,
                            position: spatialData.position || 'MID',
                            relativeY: Math.min(1.0, spatialData.relativeY || 0.5), // Clamp to valid range
                            normalizedY: spatialData.normalizedY || (spatialData.pageHeight || 842) * 0.5,
                            pageHeight: spatialData.pageHeight || 842,
                            textBefore: spatialData.textBefore || '',
                            textAfter: spatialData.textAfter || '',
                            nearestText: spatialData.nearestText || ''
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
                    imageName: `image-${pageInfo.pageNumber + 1}-${pageImageIndex + 1}.placeholder`,
                    imageAlt: `Figure ${globalImageCounter} - Detection only`,
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



/**
 * Extract spatial information for images on a page
 * @param {Object} operatorList - PDF.js operator list
 * @param {Object} textContent - PDF.js text content
 * @param {Object} viewport - PDF.js viewport
 * @param {number} pageNumber - Page number (0-based)
 * @returns {Array} Array of image spatial info objects
 */
async function extractImageSpatialInfo(operatorList, textContent, viewport, pageNumber) {
    const images = [];
    const pageHeight = viewport.height;

    // Extract text items with positions, normalized to screen coordinates
    const textItems = textContent.items.map(item => {
        const textTransform = item.transform;

        // Get text position and flip Y coordinate (PDF Y=0 is bottom, we want Y=0 at top)
        const x = textTransform[4];
        const y = pageHeight - textTransform[5]; // Flip Y coordinate

        return {
            text: item.str,
            x: x,
            y: y,
            width: item.width,
            height: item.height,
            originalY: textTransform[5] // Store original for debugging
        };
    });

    // Find image operations and their transforms
    let imageIndex = 0;
    for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i];
        if (fn === pdfjsLib.OPS.paintImageXObject) {
            const args = operatorList.argsArray[i];

            // Look for transform information in nearby operations
            let transform = [1, 0, 0, 1, 0, 0]; // default identity transform

            // Search backwards for transform operations
            for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
                const prevFn = operatorList.fnArray[j];
                if (prevFn === pdfjsLib.OPS.transform || prevFn === pdfjsLib.OPS.setTransform) {
                    transform = operatorList.argsArray[j];
                    break;
                }
            }

            // Calculate image position
            const rawImageX = transform[4];
            const rawImageY = transform[5];
            const rawImageWidth = Math.abs(transform[0]);
            const rawImageHeight = Math.abs(transform[3]);

            // Always position images at BOTTOM - no need for coordinate calculations
            images.push({
                index: imageIndex,
                position: 'BOTTOM'
            });

            imageIndex++;
        }
    }

    return images;
}













module.exports = { execute, validate }; 