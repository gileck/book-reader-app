const fs = require('fs');
const path = require('path');

/**
 * SIMPLE APPROACH: Just use raw PDF text with preserved newlines
 * No Y-coordinate complexity needed
 */

/**
 * Simple text extraction that preserves newlines from PDF
 */
async function extractSimpleTextByPages(pdfPath) {
    console.log('📖 Simple text extraction...');

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const doc = await pdfjsLib.getDocument(pdfBuffer).promise;

    const pagePromises = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        pagePromises.push(
            doc.getPage(pageNum).then(async (page) => {
                const textContent = await page.getTextContent();

                // SIMPLE: Just join text items with spaces - let PDF.js handle newlines
                const pageText = textContent.items.map(item => item.str).join(' ');

                return {
                    pageNumber: pageNum,
                    text: pageText,
                    charCount: pageText.length
                };
            })
        );
    }

    const pageResults = await Promise.all(pagePromises);
    pageResults.sort((a, b) => a.pageNumber - b.pageNumber);

    return {
        pages: pageResults,
        totalPages: pageResults.length,
        totalChars: pageResults.reduce((sum, p) => sum + p.charCount, 0)
    };
}

/**
 * Test Introduction chapter with simple approach
 */
async function testSimpleApproach() {
    try {
        // Find the PDF file
        const possiblePaths = [
            '../../../files/How Emotions Are Made/output.json',
            '../../../../files/How Emotions Are Made/output.json',
            '../../../../../files/How Emotions Are Made/output.json'
        ];

        let pdfPath = null;
        for (const testPath of possiblePaths) {
            const fullPath = path.resolve(__dirname, testPath);
            if (fs.existsSync(fullPath)) {
                pdfPath = fullPath;
                break;
            }
        }

        if (!pdfPath) {
            console.log('❌ PDF file not found. Let me check available files...');

            // Check what files exist
            const currentDir = process.cwd();
            console.log(`Current directory: ${currentDir}`);

            // Look for any JSON files
            const findFiles = (dir, depth = 0) => {
                if (depth > 3) return [];
                try {
                    const items = fs.readdirSync(dir);
                    let files = [];
                    items.forEach(item => {
                        const fullPath = path.join(dir, item);
                        const stat = fs.statSync(fullPath);
                        if (stat.isFile() && item.endsWith('.json')) {
                            files.push(fullPath);
                        } else if (stat.isDirectory() && depth < 3) {
                            files = files.concat(findFiles(fullPath, depth + 1));
                        }
                    });
                    return files;
                } catch (e) {
                    return [];
                }
            };

            const jsonFiles = findFiles(path.resolve(__dirname, '../../..'));
            console.log('Available JSON files:');
            jsonFiles.slice(0, 10).forEach(f => console.log(`  ${f}`));

            return;
        }

        console.log(`📖 Using PDF: ${pdfPath}`);

        // Extract pages 9-27 (Introduction chapter)
        const pageData = await extractSimpleTextByPages(pdfPath);
        const introPages = pageData.pages.filter(page =>
            page.pageNumber >= 9 && page.pageNumber <= 27
        );

        // Join pages with newlines to preserve structure  
        const introText = introPages.map(page => page.text).join('\n');

        // Show first 1000 characters to see the structure
        console.log('\n📝 SIMPLE INTRODUCTION TEXT (first 1000 chars):');
        console.log('=====================================');
        console.log(introText.substring(0, 1000));
        console.log('=====================================');

        // Check if the problematic sentences are properly separated
        if (introText.includes('scratches seem lighter')) {
            console.log('\n🔍 Found "scratches seem lighter" sentence');
            const scratchIndex = introText.indexOf('scratches seem lighter');
            const context = introText.substring(scratchIndex - 100, scratchIndex + 200);
            console.log('Context around the sentence:');
            console.log(context);
        }

        // Save the simple text for comparison
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(outputDir, 'simple-approach-intro.txt'),
            `SIMPLE APPROACH - INTRODUCTION CHAPTER\n\n${introText}`
        );

        console.log('\n✅ Simple approach test completed!');
        console.log('📄 Output saved to: output/simple-approach-intro.txt');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the test
testSimpleApproach(); 