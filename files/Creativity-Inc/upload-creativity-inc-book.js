#!/usr/bin/env node
const path = require('path');

const { uploadParsedBookV2 } = require('../../book-parser/parser/upload-book.js');

async function upload() {
    const bookFolderPath = __dirname;
    const outputPath = path.join(bookFolderPath, 'output');

    await uploadParsedBookV2(outputPath, {
        uploadImages: true
    });
}

upload();