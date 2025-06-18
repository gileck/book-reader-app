const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { put } = require('@vercel/blob');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Vercel Blob Configuration
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Upload a file to Vercel Blob
 */
async function uploadFileToBlob(key, content, contentType) {
    if (!BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
    }

    const blob = await put(key, content, {
        access: 'public',
        contentType: contentType || 'application/octet-stream',
        token: BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true
    });

    return blob.url;
}

/**
 * Get content type based on file extension
 */
function getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return types[ext] || 'application/octet-stream';
}

/**
 * Upload book images to Vercel Blob and update database
 * @param {Object} book - Book document from database
 * @param {string} imagesPath - Path to images folder
 * @param {Object} db - MongoDB database connection
 */
async function uploadImagesToBlob(book, imagesPath, db) {
    if (!imagesPath || !fs.existsSync(imagesPath)) {
        console.log('⚠️  No images folder found, skipping image upload');
        return;
    }

    // Get list of image files
    const imageFiles = [];
    function findImageFiles(dir, relativePath = '') {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const relativeFilePath = path.join(relativePath, file);

            if (fs.statSync(fullPath).isDirectory()) {
                findImageFiles(fullPath, relativeFilePath);
            } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
                imageFiles.push({
                    localPath: fullPath,
                    relativePath: relativeFilePath,
                    filename: file
                });
            }
        }
    }

    findImageFiles(imagesPath);

    if (imageFiles.length === 0) {
        console.log('⚠️  No image files found, skipping image upload');
        return;
    }

    console.log(`☁️  Uploading ${imageFiles.length} images to Vercel Blob...`);

    // Create folder path for this book
    const bookFolderName = book.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const blobPrefix = `books/${bookFolderName}/images/`;

    // Upload each image to Vercel Blob
    const uploadPromises = imageFiles.map(async (imageFile) => {
        const blobKey = `${blobPrefix}${imageFile.filename}`;
        const fileContent = fs.readFileSync(imageFile.localPath);
        const contentType = getContentType(imageFile.filename);

        console.log(`   📤 Uploading: ${imageFile.filename}`);

        const blobUrl = await uploadFileToBlob(blobKey, fileContent, contentType);

        return {
            filename: imageFile.filename,
            blobUrl: blobUrl
        };
    });

    const uploadedImages = await Promise.all(uploadPromises);
    console.log(`✅ Successfully uploaded ${uploadedImages.length} images to Vercel Blob`);

    // Update book with relative imageBaseURL path
    const relativeImagePath = `/${bookFolderName}/images/`;
    const booksCollection = db.collection('books');
    const chaptersCollection = db.collection('chapters');

    await booksCollection.updateOne(
        { _id: book._id },
        {
            $set: {
                imageBaseURL: relativeImagePath,
                updatedAt: new Date()
            }
        }
    );

    console.log(`📚 Updated book with relative imageBaseURL: ${relativeImagePath}`);

    // Update chapters to use imageName instead of imageUrl
    const chapters = await chaptersCollection.find({ bookId: book._id }).toArray();

    for (const chapter of chapters) {
        let hasUpdates = false;
        const updatedChunks = chapter.content.chunks.map(chunk => {
            if (chunk.type === 'image' && chunk.imageUrl) {
                // Extract filename from imageUrl
                const imageName = path.basename(chunk.imageUrl);

                // Check if this image was uploaded
                const uploadedImage = uploadedImages.find(img => img.filename === imageName);
                if (uploadedImage) {
                    hasUpdates = true;
                    return {
                        ...chunk,
                        imageName: imageName,
                        imageUrl: undefined // Remove the old imageUrl field
                    };
                }
            }
            return chunk;
        });

        if (hasUpdates) {
            await chaptersCollection.updateOne(
                { _id: chapter._id },
                {
                    $set: {
                        'content.chunks': updatedChunks,
                        updatedAt: new Date()
                    }
                }
            );
            console.log(`   📝 Updated Chapter ${chapter.chapterNumber} with image references`);
        }
    }

    console.log(`📊 Image upload summary: ${uploadedImages.length} images uploaded to ${relativeImagePath}`);
}

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
 * Upload parsed book data to MongoDB database and upload images to Vercel Blob
 * If a book with the same title exists, it will be updated with new content (keeping same ID)
 * @param {string} bookFolderPath - Path to the book folder containing output.json and images
 */
async function uploadParsedBook(bookFolderPath) {
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

        // Check if book already exists by title
        const existingBook = await booksCollection.findOne({ title: bookData.book.title });
        let bookId;
        let isUpdate = false;

        if (existingBook) {
            // Book exists - update it (default behavior)
            bookId = existingBook._id;
            isUpdate = true;
            console.log(`📚 Book "${bookData.book.title}" already exists with ID: ${bookId}`);
            console.log(`🔄 Updating existing book content...`);
            console.log(`   📊 Previous: ${existingBook.totalChapters} chapters, ${existingBook.totalWords?.toLocaleString() || 'unknown'} words`);
            console.log(`   📊 New:      ${bookData.book.totalChapters} chapters, ${bookData.book.totalWords.toLocaleString()} words`);

            // Delete existing chapters for this book
            const deleteChaptersResult = await chaptersCollection.deleteMany({ bookId: bookId });
            console.log(`   🗑️  Deleted ${deleteChaptersResult.deletedCount} existing chapters`);

            // Update book metadata
            const bookUpdateData = {
                author: bookData.book.author,
                description: bookData.book.description,
                coverImage: bookData.book.coverImage ? `/${bookData.book.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')}/images/${bookData.book.coverImage}` : null,
                totalChapters: bookData.book.totalChapters,
                totalWords: bookData.book.totalWords,
                language: bookData.book.language || 'en-US',
                updatedAt: new Date(),
                isPublic: bookData.book.isPublic !== undefined ? bookData.book.isPublic : true
            };

            const bookUpdateResult = await booksCollection.updateOne(
                { _id: bookId },
                { $set: bookUpdateData }
            );
            console.log(`   📖 Updated book metadata (${bookUpdateResult.modifiedCount} book record modified)`);

        } else {
            // Book doesn't exist - create new one
            console.log(`📖 Creating new book: "${bookData.book.title}"`);

            const bookToInsert = {
                title: bookData.book.title,
                author: bookData.book.author,
                description: bookData.book.description,
                coverImage: bookData.book.coverImage ? `/${bookData.book.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')}/images/${bookData.book.coverImage}` : null,
                totalChapters: bookData.book.totalChapters,
                totalWords: bookData.book.totalWords,
                language: bookData.book.language || 'en-US',
                createdAt: new Date(bookData.book.createdAt) || new Date(),
                updatedAt: new Date(),
                isPublic: bookData.book.isPublic !== undefined ? bookData.book.isPublic : true,
                uploadedBy: null // Set to actual user ID if available
            };

            const bookResult = await booksCollection.insertOne(bookToInsert);
            bookId = bookResult.insertedId;
            console.log(`   📖 Book created with ID: ${bookId}`);
        }

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
                    ...(chunk.imageUrl && { imageUrl: chunk.imageUrl }), // Keep imageUrl for now, will be converted to imageName
                    ...(chunk.imageName && { imageName: chunk.imageName }),
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

        console.log(`📚 ${isUpdate ? 'Updating' : 'Inserting'} ${chaptersToInsert.length} chapters...`);

        for (let i = 0; i < chaptersToInsert.length; i += batchSize) {
            const batch = chaptersToInsert.slice(i, i + batchSize);
            const batchResult = await chaptersCollection.insertMany(batch);
            insertedCount += batchResult.insertedCount;

            console.log(`   Inserted chapters ${i + 1}-${Math.min(i + batchSize, chaptersToInsert.length)} (${insertedCount}/${chaptersToInsert.length})`);
        }

        // Verify totals and update book if needed
        const actualChapterCount = await chaptersCollection.countDocuments({ bookId: bookId });
        const actualWordCount = chaptersToInsert.reduce((sum, chapter) => sum + chapter.wordCount, 0);

        if (actualChapterCount !== bookData.book.totalChapters || actualWordCount !== bookData.book.totalWords) {
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

        // Get the updated book document for image upload
        const finalBook = await booksCollection.findOne({ _id: bookId });

        // Upload images to Vercel Blob if available and not skipped
        const skipImages = process.argv.includes('--skip-images');
        
        if (skipImages) {
            console.log('⏭️  Skipping image upload (--skip-images flag provided)');
        } else if (BLOB_READ_WRITE_TOKEN && imagesPath) {
            await uploadImagesToBlob(finalBook, imagesPath, db);
        } else if (!BLOB_READ_WRITE_TOKEN && imagesPath) {
            console.log('⚠️  BLOB_READ_WRITE_TOKEN not set, skipping image upload to Vercel');
            console.log('   Images remain in local folder and imageUrl references are preserved');
        }

        console.log(`✅ Book ${isUpdate ? 'updated' : 'uploaded'} successfully!`);
        console.log(`📖 Title: "${bookData.book.title}"`);
        console.log(`👤 Author: ${bookData.book.author}`);
        console.log(`🆔 Book ID: ${bookId}`);
        console.log(`📚 Chapters: ${actualChapterCount}`);
        console.log(`📝 Total words: ${actualWordCount.toLocaleString()}`);
        console.log(`🔄 Operation: ${isUpdate ? 'Updated existing book' : 'Created new book'}`);
        
        if (isUpdate) {
            const totalChunks = chaptersToInsert.reduce((sum, ch) => sum + ch.content.chunks.length, 0);
            const imageChunks = chaptersToInsert.reduce((sum, ch) => 
                sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);
            console.log(`📊 Summary: Updated ${actualChapterCount} chapters with ${totalChunks} total chunks (${totalChunks - imageChunks} text + ${imageChunks} images)`);
        }

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
Usage: node upload-parsed-book.js BOOK_FOLDER_PATH [OPTIONS]

Arguments:
  BOOK_FOLDER_PATH   Path to the book folder containing output.json and images/ (required)

Options:
  --skip-images      Skip uploading images to Vercel Blob (only upload book content)

Examples:
  node upload-parsed-book.js ../files/MyBook/
  node upload-parsed-book.js ../files/MyBook/ --skip-images
  node upload-parsed-book.js ./books/transformers/
  node upload-parsed-book.js /path/to/book-folder/ --skip-images

Book folder structure:
  MyBook/
  ├── output.json       # Generated by parser (required)
  ├── images/           # Generated by parser (optional)
  │   └── *.jpg, *.png, etc.
  ├── book.pdf          # Original PDF file
  └── config.json       # Book configuration

Behavior:
  - If a book with the same title already exists in the database, the script will update it
    with the new content, keeping the same book ID
  - If no book with that title exists, a new book will be created
  - Images will be automatically uploaded to Vercel Blob if BLOB_READ_WRITE_TOKEN is set
  - This allows for re-parsing and updating books without losing bookmarks, reading progress, etc.

Environment Variables:
  BLOB_READ_WRITE_TOKEN    Vercel Blob read-write token for image uploads (optional)
  
If BLOB_READ_WRITE_TOKEN is not set, book content will be uploaded but images will remain local.
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

        if (!bookFolderPath) {
            console.error('❌ Book folder path is required');
            showHelp();
            process.exit(1);
        }

        console.log('🚀 Starting book upload...');
        await uploadParsedBook(bookFolderPath);

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