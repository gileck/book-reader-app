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

    // Update chapters to use imageName instead of imageUrl for image chunks
    const chapters = await chaptersCollection.find({ bookId: book._id }).toArray();

    for (const chapter of chapters) {
        let hasUpdates = false;
        const updatedChunks = chapter.content.chunks.map(chunk => {
            if (chunk.type === 'image' && chunk.imageName) {
                // Check if this image was uploaded
                const uploadedImage = uploadedImages.find(img => img.filename === chunk.imageName);
                if (uploadedImage) {
                    hasUpdates = true;
                    return {
                        ...chunk,
                        // Keep imageName, remove any absolute imageUrl if present
                        imageUrl: undefined
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
 * Convert parser v2 chunks to database format
 * Groups chunks by chapter number extracted from chunkId
 */
function convertV2ChunksToChapters(chunks, bookTitle) {
    const chapterMap = new Map();

    // Group chunks by chapter number
    chunks.forEach(chunk => {
        // Extract chapter number from chunkId (format: "chapterNum_chunkNum")
        const chapterNumber = parseInt(chunk.chunkId.split('_')[0]);

        if (!chapterMap.has(chapterNumber)) {
            chapterMap.set(chapterNumber, {
                chapterNumber: chapterNumber,
                title: `Chapter ${chapterNumber}`, // Default title
                content: {
                    chunks: []
                },
                wordCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        const chapter = chapterMap.get(chapterNumber);

        // Convert v2 chunk format to original chunk format
        const convertedChunk = {
            index: chapter.content.chunks.length,
            text: chunk.content || '',
            wordCount: chunk.wordCount || 0,
            type: chunk.type || 'text',
            ...(chunk.pageNumber !== undefined && { pageNumber: chunk.pageNumber }),
            ...(chunk.links && chunk.links.length > 0 && { links: chunk.links }),
            ...(chunk.imageName && { imageName: chunk.imageName }),
            ...(chunk.imageAlt && { imageAlt: chunk.imageAlt })
        };

        chapter.content.chunks.push(convertedChunk);
        chapter.wordCount += convertedChunk.wordCount;
    });

    return Array.from(chapterMap.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
}

/**
 * Extract book metadata from parser v2 output
 */
function extractBookMetadata(parserV2Data) {
    // Try to extract title from the raw text or use a placeholder
    let title = 'Unknown Title';
    if (parserV2Data.rawText) {
        // Look for title patterns in the first few pages
        const titleMatch = parserV2Data.rawText.match(/TRANSFORMER[^\n]*\n([^\n]+)/i) ||
            parserV2Data.rawText.match(/^([A-Z][^.\n]{10,60})\s*$/m);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
        }
    }

    return {
        title: title,
        author: 'Unknown Author', // Parser v2 doesn't extract author
        description: '',
        totalChapters: 0, // Will be calculated from chapters
        totalWords: 0, // Will be calculated from chapters
        language: 'en-US',
        parserVersion: 2
    };
}

/**
 * Upload parsed book data from Parser v2 to MongoDB database and upload images to Vercel Blob
 * If a book with the same title exists, it will be updated with new content (keeping same ID)
 * @param {string} bookFolderPath - Path to the book folder containing output.json and images
 */
async function uploadParsedBookV2(bookFolderPath) {
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
    let parserV2Data;
    try {
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        parserV2Data = JSON.parse(jsonContent);
    } catch (error) {
        console.error('❌ Error reading or parsing JSON file:', error.message);
        process.exit(1);
    }

    // Validate parser v2 JSON structure
    if (!parserV2Data.chunks || !Array.isArray(parserV2Data.chunks)) {
        console.error('❌ Invalid parser v2 JSON structure. Expected { chunks: [...] }');
        process.exit(1);
    }

    console.log(`📊 Parser v2 data: ${parserV2Data.chunks.length} chunks found`);

    // Extract book metadata
    const bookMetadata = extractBookMetadata(parserV2Data);
    console.log(`📖 Book metadata extracted: "${bookMetadata.title}"`);

    // Convert v2 chunks to chapter format
    const chapters = convertV2ChunksToChapters(parserV2Data.chunks, bookMetadata.title);
    console.log(`📚 Converted to ${chapters.length} chapters`);

    // Update book metadata with actual counts
    bookMetadata.totalChapters = chapters.length;
    bookMetadata.totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();

        const db = client.db(dbName);
        const booksCollection = db.collection('books');
        const chaptersCollection = db.collection('chapters');

        console.log('✅ Connected successfully!');

        // Check if book already exists by title
        const existingBook = await booksCollection.findOne({ title: bookMetadata.title });
        let bookId;
        let isUpdate = false;

        if (existingBook) {
            // Book exists - update it
            bookId = existingBook._id;
            isUpdate = true;
            console.log(`📚 Book "${bookMetadata.title}" already exists with ID: ${bookId}`);
            console.log(`🔄 Updating existing book content...`);
            console.log(`   📊 Previous: ${existingBook.totalChapters} chapters, ${existingBook.totalWords?.toLocaleString() || 'unknown'} words`);
            console.log(`   📊 New:      ${bookMetadata.totalChapters} chapters, ${bookMetadata.totalWords.toLocaleString()} words`);

            // Delete existing chapters for this book
            const deleteChaptersResult = await chaptersCollection.deleteMany({ bookId: bookId });
            console.log(`   🗑️  Deleted ${deleteChaptersResult.deletedCount} existing chapters`);

            // Update book metadata
            const bookUpdateData = {
                author: bookMetadata.author,
                description: bookMetadata.description,
                totalChapters: bookMetadata.totalChapters,
                totalWords: bookMetadata.totalWords,
                language: bookMetadata.language,
                parserVersion: bookMetadata.parserVersion,
                updatedAt: new Date()
            };

            const bookUpdateResult = await booksCollection.updateOne(
                { _id: bookId },
                { $set: bookUpdateData }
            );
            console.log(`   📖 Updated book metadata (${bookUpdateResult.modifiedCount} book record modified)`);

        } else {
            // Book doesn't exist - create new one
            console.log(`📖 Creating new book: "${bookMetadata.title}"`);

            const bookToInsert = {
                title: bookMetadata.title,
                author: bookMetadata.author,
                description: bookMetadata.description,
                totalChapters: bookMetadata.totalChapters,
                totalWords: bookMetadata.totalWords,
                language: bookMetadata.language,
                parserVersion: bookMetadata.parserVersion,
                createdAt: new Date(),
                updatedAt: new Date(),
                isPublic: true,
                uploadedBy: null
            };

            const bookResult = await booksCollection.insertOne(bookToInsert);
            bookId = bookResult.insertedId;
            console.log(`   📖 Book created with ID: ${bookId}`);
        }

        // Prepare chapters data for database
        const chaptersToInsert = chapters.map(chapter => ({
            ...chapter,
            bookId: bookId
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

        if (actualChapterCount !== bookMetadata.totalChapters || actualWordCount !== bookMetadata.totalWords) {
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

        // Upload images to Vercel Blob if flag is provided and not skipped
        const uploadImages = process.argv.includes('--upload-images');
        const skipImages = process.argv.includes('--skip-images');

        if (skipImages) {
            console.log('⏭️  Skipping image upload (--skip-images flag provided)');
        } else if (!uploadImages) {
            console.log('⏭️  Skipping image upload (use --upload-images flag to upload images)');
        } else if (BLOB_READ_WRITE_TOKEN && imagesPath) {
            await uploadImagesToBlob(finalBook, imagesPath, db);
        } else if (!BLOB_READ_WRITE_TOKEN && imagesPath) {
            console.log('⚠️  BLOB_READ_WRITE_TOKEN not set, skipping image upload to Vercel');
            console.log('   Images remain in local folder and imageName references are preserved');
        }

        console.log(`✅ Book ${isUpdate ? 'updated' : 'uploaded'} successfully!`);
        console.log(`📖 Title: "${bookMetadata.title}"`);
        console.log(`👤 Author: ${bookMetadata.author}`);
        console.log(`🆔 Book ID: ${bookId}`);
        console.log(`📚 Chapters: ${actualChapterCount}`);
        console.log(`📝 Total words: ${actualWordCount.toLocaleString()}`);
        console.log(`🔄 Operation: ${isUpdate ? 'Updated existing book' : 'Created new book'}`);
        console.log(`🔢 Parser Version: ${bookMetadata.parserVersion}`);

        if (isUpdate) {
            const totalChunks = chaptersToInsert.reduce((sum, ch) => sum + ch.content.chunks.length, 0);
            const imageChunks = chaptersToInsert.reduce((sum, ch) =>
                sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);
            const headerChunks = chaptersToInsert.reduce((sum, ch) =>
                sum + ch.content.chunks.filter(chunk => chunk.type === 'header').length, 0);
            const textChunks = totalChunks - imageChunks - headerChunks;
            console.log(`📊 Summary: Updated ${actualChapterCount} chapters with ${totalChunks} total chunks (${textChunks} text + ${headerChunks} headers + ${imageChunks} images)`);
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
Usage: node upload-book-v2.js BOOK_FOLDER_PATH [OPTIONS]

Arguments:
  BOOK_FOLDER_PATH   Path to the book folder containing output.json and images/ (required)

Options:
  --upload-images    Upload images to Vercel Blob (requires BLOB_READ_WRITE_TOKEN)
  --skip-images      Skip uploading images to Vercel Blob (only upload book content)

Examples:
  node upload-book-v2.js ../files/MyBook/
  node upload-book-v2.js ../files/MyBook/ --upload-images
  node upload-book-v2.js ./transformers-output/
  node upload-book-v2.js /path/to/book-folder/ --skip-images

Book folder structure (Parser v2):
  MyBook/
  ├── output.json       # Generated by parser v2 (required)
  ├── images/           # Generated by parser v2 (optional)
  │   └── *.jpg, *.png, etc.
  ├── book.pdf          # Original PDF file
  └── debug/            # Debug information (optional)

Behavior:
  - If a book with the same title already exists in the database, the script will update it
    with the new content, keeping the same book ID
  - If no book with that title exists, a new book will be created
  - Parser version 2 is automatically added to the book metadata
  - Images will be uploaded to Vercel Blob only if --upload-images flag is provided
  - The script converts the flat chunk structure from parser v2 to the chapter-based
    structure expected by the database

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

        console.log('🚀 Starting parser v2 book upload...');
        await uploadParsedBookV2(bookFolderPath);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { uploadParsedBookV2 }; 