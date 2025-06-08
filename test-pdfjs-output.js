const fs = require('fs');
const pdfjsLib = require('pdfjs-dist /legacy/build/pdf.js');

async function extractPdfText() {
    const pdfPath = './files/How Emotions Are Made/book.pdf';
    const outputPath = './pdfjs-output.txt';

    try {
        // Load the PDF
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const doc = await pdfjsLib.getDocument(data).promise;

        console.log(`PDF has ${doc.numPages} pages`);

        let fullText = '';

        // Extract text from first 5 pages to see the format
        const pagesToExtract = Math.max(5, doc.numPages);

        for (let i = 1; i <= pagesToExtract; i++) {
            console.log(`Processing page ${i}...`);

            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();

            fullText += `\n--- PAGE ${i} ---\n`;

            // Get raw text items
            textContent.items.forEach((item, index) => {
                fullText += `[Item ${index}] Text: "${item.str}" | Transform: [${item.transform.join(', ')}] | Font: ${item.fontName} | Dir: ${item.dir}\n`;
            });

            // Also get simple text
            const simpleText = textContent.items.map(item => item.str).join(' ');
            fullText += `\nSimple text: ${simpleText}\n`;
            fullText += '\n' + '='.repeat(50) + '\n';
        }

        // Save to file
        fs.writeFileSync(outputPath, fullText);
        console.log(`Output saved to ${outputPath}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

extractPdfText(); 