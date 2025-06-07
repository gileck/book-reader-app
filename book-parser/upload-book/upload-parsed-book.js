const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

/**
 * Find output.json file in a book folder
 */
function findOutputFile(bookFolderPath) {
    const outputPath = path.join(bookFolderPath, 'output.json');

    if (!fs.existsSync(outputPath)) {
        throw new Error(`No output.json file found in folder: ${bookFolderPath}`);
    }

    return outputPath;
}

/**
 * Find images folder in a book folder
 */
function findImagesFolder(bookFolderPath) {
    const imagesPath = path.join(bookFolderPath, 'images');

    if (!fs.existsSync(imagesPath)) {
        console.log(`⚠️  No images folder found in: ${bookFolderPath}`);
        return null;
    }

    if (!fs.statSync(imagesPath).isDirectory()) {
        console.log(`⚠️  'images' exists but is not a directory in: ${bookFolderPath}`);
        return null;
    }

    return imagesPath;
}

/**
 * Upload parsed book data to MongoDB database
 * @param {string} bookFolderPath - Path to the book folder containing output.json and images
 * @param {boolean} force - Force upload even if book exists
 */
async function uploadParsedBook(bookFolderPath, force = false) {
    const uri = 'mongodb+srv://gileck:jfxccnxeruiowqrioqsdjkla@cluster0.frtddwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
    const dbName = 'book_reader_db'

    // Validate input folder
    if (!fs.existsSync(bookFolderPath)) {
        console.error(`❌ Book folder not found: ${bookFolderPath}`);
        process.exit(1);
    }

    if (!fs.statSync(bookFolderPath).isDirectory()) {
        console.error(`❌ Path is not a directory: ${bookFolderPath}`);
        process.exit(1);
    }

    // Find required files
    let jsonPath, imagesPath;
    try {
        jsonPath = findOutputFile(bookFolderPath);
        console.log(`📄 Found output file: ${path.basename(jsonPath)}`);

        imagesPath = findImagesFolder(bookFolderPath);
        if (imagesPath) {
            const imageFiles = fs.readdirSync(imagesPath, { recursive: true }).filter(file =>
                /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
            );
            console.log(`🖼️  Found images folder with ${imageFiles.length} image files`);
        }
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
    }

    // Load and validate JSON data
    let bookData;
    try {
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        bookData = JSON.parse(jsonContent);
    } catch (error) {
        console.error('❌ Error reading or parsing JSON file:', error.message);
        process.exit(1);
    }

    // Validate JSON structure
    if (!bookData.book || !bookData.chapters || !Array.isArray(bookData.chapters)) {
        console.error('❌ Invalid JSON structure. Expected { book: {...}, chapters: [...] }');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();

        const db = client.db(dbName);
        const booksCollection = db.collection('books');
        const chaptersCollection = db.collection('chapters');

        console.log('✅ Connected successfully!');

        // Check if book already exists
        const existingBook = await booksCollection.findOne({ title: bookData.book.title, author: bookData.book.author });
        if (existingBook && !force) {
            console.log(`📚 Book "${bookData.book.title}" by ${bookData.book.author} already exists.`);
            console.log('💡 Use --force flag to overwrite existing book.');
            return;
        }

        if (existingBook && force) {
            console.log(`🗑️  Removing existing book and chapters...`);

            // Delete existing chapters
            const deleteChaptersResult = await chaptersCollection.deleteMany({ bookId: existingBook._id });
            console.log(`   Deleted ${deleteChaptersResult.deletedCount} existing chapters`);

            // Delete existing book
            await booksCollection.deleteOne({ _id: existingBook._id });
            console.log(`   Deleted existing book`);
        }

        // Prepare book data for database
        const bookToInsert = {
            title: bookData.book.title,
            author: bookData.book.author,
            description: bookData.book.description,
            coverImage: bookData.book.coverImage || null,
            totalChapters: bookData.book.totalChapters,
            totalWords: bookData.book.totalWords,
            language: bookData.book.language || 'en-US',
            createdAt: new Date(bookData.book.createdAt) || new Date(),
            updatedAt: new Date(),
            isPublic: bookData.book.isPublic !== undefined ? bookData.book.isPublic : true,
            uploadedBy: null // Set to actual user ID if available
        };

        // Insert the book
        console.log(`📖 Inserting book: "${bookToInsert.title}"...`);
        const bookResult = await booksCollection.insertOne(bookToInsert);
        const bookId = bookResult.insertedId;
        console.log(`   Book inserted with ID: ${bookId}`);

        // Prepare chapters data for database
        const chaptersToInsert = bookData.chapters.map(chapter => ({
            bookId: bookId,
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            content: {
                chunks: chapter.content.chunks.map(chunk => ({
                    index: chunk.index,
                    text: chunk.text,
                    wordCount: chunk.wordCount,
                    type: chunk.type || 'text',
                    ...(chunk.pageNumber !== undefined && { pageNumber: chunk.pageNumber }),
                    ...(chunk.imageUrl && { imageUrl: chunk.imageUrl }),
                    ...(chunk.imageAlt && { imageAlt: chunk.imageAlt })
                }))
            },
            wordCount: chapter.wordCount,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        // Insert chapters in batches to handle large books
        const batchSize = 10;
        let insertedCount = 0;

        console.log(`📚 Inserting ${chaptersToInsert.length} chapters...`);

        for (let i = 0; i < chaptersToInsert.length; i += batchSize) {
            const batch = chaptersToInsert.slice(i, i + batchSize);
            const batchResult = await chaptersCollection.insertMany(batch);
            insertedCount += batchResult.insertedCount;

            console.log(`   Inserted chapters ${i + 1}-${Math.min(i + batchSize, chaptersToInsert.length)} (${insertedCount}/${chaptersToInsert.length})`);
        }

        // Verify totals and update book if needed
        const actualChapterCount = await chaptersCollection.countDocuments({ bookId: bookId });
        const actualWordCount = chaptersToInsert.reduce((sum, chapter) => sum + chapter.wordCount, 0);

        if (actualChapterCount !== bookToInsert.totalChapters || actualWordCount !== bookToInsert.totalWords) {
            console.log(`🔧 Updating book totals...`);
            await booksCollection.updateOne(
                { _id: bookId },
                {
                    $set: {
                        totalChapters: actualChapterCount,
                        totalWords: actualWordCount,
                        updatedAt: new Date()
                    }
                }
            );
        }

        console.log('✅ Book uploaded successfully!');
        console.log(`📖 Title: "${bookToInsert.title}"`);
        console.log(`👤 Author: ${bookToInsert.author}`);
        console.log(`🆔 Book ID: ${bookId}`);
        console.log(`📚 Chapters: ${actualChapterCount}`);
        console.log(`📝 Total words: ${actualWordCount.toLocaleString()}`);

    } catch (error) {
        console.error('❌ Error uploading book:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('🔌 Database connection closed.');
    }
}

// CLI usage help
function showHelp() {
    console.log(`
Usage: node upload-parsed-book.js BOOK_FOLDER_PATH [--force]

Arguments:
  BOOK_FOLDER_PATH   Path to the book folder containing output.json and images/ (required)
  --force            Force upload even if book already exists (optional)

Examples:
  node upload-parsed-book.js ../files/MyBook/
  node upload-parsed-book.js ./books/transformers/ --force
  node upload-parsed-book.js /path/to/book-folder/

Book folder structure:
  MyBook/
  ├── output.json       # Generated by parser (required)
  ├── images/           # Generated by parser (optional)
  │   └── Book-Title/
  │       ├── page-001-image-1.jpg
  │       └── ...
  ├── book.pdf          # Original PDF file
  └── config.json       # Book configuration

The script will automatically find output.json and images/ folder in the specified directory.

Environment Variables:
  MONGODB_URI     MongoDB connection string (default: mongodb://localhost:27017)
  DATABASE_NAME   Database name (default: book_reader)
`);
}

// Main execution
async function main() {
    try {
        const args = process.argv.slice(2);

        // Show help if requested
        if (args.includes('--help') || args.includes('-h')) {
            showHelp();
            process.exit(0);
        }

        const bookFolderPath = args[0];
        const force = args.includes('--force');

        if (!bookFolderPath) {
            console.error('❌ Book folder path is required');
            showHelp();
            process.exit(1);
        }

        console.log('🚀 Starting book upload...');
        await uploadParsedBook(bookFolderPath, force);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { uploadParsedBook }; 