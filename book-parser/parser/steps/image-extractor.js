const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { execSync } = require('child_process');

/**
 * Extract embedded images from PDF and save to local folder
 * @param {string} pdfPath - Path to PDF file
 * @param {string} bookTitle - Book title for folder naming
 * @param {string} bookFolderPath - Base folder path for the book
 * @returns {Object} Object containing images array and folder path: { images: Array, imagesFolderPath: string }
 */
async function extractImages(pdfPath, bookTitle, bookFolderPath) {

    // Create images directory in the book folder
    const bookFolderName = bookTitle.replace(/[^a-zA-Z0-9]/g, '-');
    const imagesDir = path.join(bookFolderPath, 'images', bookFolderName);
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
                pageImageMap.push({ pageNumber: pageNum, imageCount });
                totalImagesDetected += imageCount;
            }
        } catch (pageError) {
            // Skip pages with errors
        }
    }

    try {
        // Step 2: Extract actual images using pdfimages
        const tempDir = path.join(__dirname, '../temp/pdfimages-temp');
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

    // Return both images and folder information
    return {
        images,
        imagesFolderPath: `./images/${bookFolderName}`
    };
}

module.exports = {
    extractImages
}; 