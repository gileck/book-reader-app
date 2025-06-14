const folder_path = '/Users/gil/Projects/book-reader-app/files';
const fs = require('fs');
const path = require('path');


if (!fs.existsSync(path.resolve(folder_path))) {
    console.error('❌ Folder path does not exist', folder_path);
    process.exit(1);
}

const { parseBook } = require('../parser/parse-pdf-book-generic');

function run() {
    const folders = fs.readdirSync(folder_path);
    for (const folder of folders) {
        const book_path = path.join(folder_path, folder, 'book.pdf');
        console.log(book_path);
        parseBook(book_path, null, path.join(folder_path, folder, 'output.json'), true);
    }
}

run();