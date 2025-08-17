const parser = require('../../book-parser/parser/parser.js');
const path = require('path');

async function main() {
    const pdfPath = path.join(__dirname, 'book.pdf');
    const outputPath = path.join(__dirname, 'output');
    await parser.parseBook(pdfPath, outputPath, {
        debug: true,
        validate: true
    });
}

main();