const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function checkPages() {
    const pdfPath = './files/How Emotions Are Made/book.pdf';

    try {
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const doc = await pdfjsLib.getDocument(data).promise;

        console.log(`PDF has ${doc.numPages} pages\n`);

        // Check pages around where Chapter 1 should start
        const pagesToCheck = [18, 19, 20, 21, 22, 40, 41, 42, 43, 44, 45];

        for (const pageNum of pagesToCheck) {
            console.log(`--- PDF PAGE ${pageNum} ---`);

            const page = await doc.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Get first few lines of text
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ')
                .trim()
                .substring(0, 200);

            console.log(`Text preview: "${pageText}..."`);

            // Look for chapter indicators
            const fullText = textContent.items.map(item => item.str).join(' ').toLowerCase();
            if (fullText.includes('fingerprint') || fullText.includes('emotion') || fullText.includes('chapter')) {
                console.log(`🔍 Contains chapter-related keywords`);
            }

            console.log('');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkPages(); 