const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { put } = require('@vercel/blob');
const inquirer = require('inquirer');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
// Vercel Blob Configuration

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

    // Update book with relative imageBaseURL path and coverImage
    const relativeImagePath = `/${bookFolderName}/images/`;
    const booksCollection = db.collection('books');
    const chaptersCollection = db.collection('chapters');

    // Set coverImage to the first uploaded image
    const updateData = {
        imageBaseURL: relativeImagePath,
        updatedAt: new Date()
    };

    if (uploadedImages.length > 0) {
        updateData.coverImage = `${relativeImagePath}${uploadedImages[0].filename}`;
        console.log(`🖼️  Set cover image: ${updateData.coverImage}`);
    }

    await booksCollection.updateOne(
        { _id: book._id },
        { $set: updateData }
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
 * Find output.json file in a folder OR accept direct parser output
 */
function findOutputFile(folderPath) {
    // If it's a file path directly, use it
    if (folderPath.endsWith('.json') && fs.existsSync(folderPath)) {
        return folderPath;
    }

    // Look for output.json in the folder
    const outputPath = path.join(folderPath, 'output.json');

    if (!fs.existsSync(outputPath)) {
        throw new Error(`No output.json file found in folder: ${folderPath}`);
    }

    return outputPath;
}

/**
 * Find images folder in the output folder
 */
function findImagesFolder(folderPath) {
    // If it's a file, look in the same directory
    const baseDir = folderPath.endsWith('.json')
        ? path.dirname(folderPath)
        : folderPath;

    const imagesPath = path.join(baseDir, 'images');

    if (!fs.existsSync(imagesPath)) {
        console.log(`⚠️  No images folder found in: ${baseDir}`);
        return null;
    }

    if (!fs.statSync(imagesPath).isDirectory()) {
        console.log(`⚠️  'images' exists but is not a directory in: ${baseDir}`);
        return null;
    }

    return imagesPath;
}

/**
 * Convert parser final output to database format
 * Works with the new simplified parser.js output format: { chapters: [...], metadata: {...} }
 */
function convertParserOutputToChapters(finalOutput, bookTitle) {
    // Handle new simplified parser.js output format
    if (finalOutput.chapters && Array.isArray(finalOutput.chapters)) {
        console.log('📋 Processing simplified parser v2 output format...');

        const chapters = finalOutput.chapters.map(chapter => {
            const convertedChunks = chapter.chunks.map((chunk, index) => {
                // Map parser types to database schema types
                let dbType = 'text'; // default
                if (chunk.type === 'paragraph' || chunk.type === 'text') {
                    dbType = 'text';
                } else if (chunk.type === 'header') {
                    dbType = 'header';
                } else if (chunk.type === 'image') {
                    dbType = 'image';
                }

                return {
                    index: index,
                    text: chunk.content || chunk.text || (chunk.type === 'image' ? chunk.imageAlt || '' : ''),
                    wordCount: chunk.wordCount || 0,
                    type: dbType,
                    ...(chunk.pageNumber !== undefined && { pageNumber: chunk.pageNumber }),
                    ...(chunk.sentenceCount !== undefined && { sentenceCount: chunk.sentenceCount }),
                    ...(chunk.paragraphIndex !== undefined && { paragraphIndex: chunk.paragraphIndex }),
                    ...(chunk.links && chunk.links.length > 0 && {
                        links: chunk.links.map(link => ({
                            text: link.text,
                            targetPageNumber: link.targetPageNumber,
                            targetText: link.targetText,
                            linkId: link.linkId,
                            role: link.role,
                            // NEW: Step 5.1 chunk references
                            ...(link.targetChunkId && { targetChunkId: link.targetChunkId }),
                            ...(link.sourceChunkId && { sourceChunkId: link.sourceChunkId }),
                            // Legacy fields for compatibility
                            ...(link.targetChunk !== undefined && { targetChunk: link.targetChunk }),
                            ...(link.chapterNumber !== undefined && { chapterNumber: link.chapterNumber })
                        }))
                    }),
                    ...(chunk.imageName && { imageName: chunk.imageName }),
                    ...(chunk.imageAlt && { imageAlt: chunk.imageAlt })
                };
            });

            return {
                chapterNumber: chapter.chapterNumber,
                title: chapter.title || `Chapter ${chapter.chapterNumber}`,
                content: {
                    chunks: convertedChunks
                },
                wordCount: convertedChunks.reduce((sum, chunk) => sum + (chunk.wordCount || 0), 0),
                createdAt: new Date(),
                updatedAt: new Date()
            };
        });

        return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }

    throw new Error('Parser output format not recognized. Expected simplified format with chapters array and metadata.');
}

/**
 * Extract book metadata from parser final output
 */
function extractBookMetadata(finalOutput) {
    // Handle new simplified parser.js output format with basic metadata
    if (finalOutput.metadata) {
        const metadata = finalOutput.metadata;
        return {
            title: metadata.title || 'Unknown Title',
            author: metadata.author || 'Unknown Author',
            description: metadata.description || '',
            language: metadata.language || 'en',
            totalWords: 0, // Will be calculated from chapters
            totalChapters: 0, // Will be calculated from chapters
            parserVersion: metadata.parserVersion || 2
        };
    }

    // Fallback for missing metadata
    return {
        title: 'Unknown Title',
        author: 'Unknown Author',
        description: '',
        totalChapters: 0,
        totalWords: 0,
        language: 'en',
        parserVersion: 2
    };
}

/**
 * Prompt user to select an existing book or create a new one
 * @param {Object} booksCollection - MongoDB books collection
 * @param {string} suggestedTitle - The title from the parser metadata
 * @returns {Object|null} Selected book document or null to create new
 */
async function selectOrCreateBook(booksCollection, suggestedTitle) {
    // Fetch all books from database
    const allBooks = await booksCollection.find({}).sort({ title: 1 }).toArray();

    if (allBooks.length === 0) {
        console.log('📚 No books found in database. Will create a new book.');
        return null;
    }

    const choices = [
        {
            name: `➕ Create new book: "${suggestedTitle}"`,
            value: 'CREATE_NEW',
            short: 'Create new'
        },
        new inquirer.Separator('--- Existing Books ---')
    ];

    // Add all existing books as options
    allBooks.forEach(book => {
        const bookInfo = `${book.title}${book.author ? ` by ${book.author}` : ''} (${book.totalChapters || 0} chapters)`;
        choices.push({
            name: bookInfo,
            value: book._id.toString(),
            short: book.title
        });
    });

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'bookId',
            message: `Book "${suggestedTitle}" not found. Select an existing book to update or create a new one:`,
            choices: choices,
            pageSize: 15
        }
    ]);

    if (answer.bookId === 'CREATE_NEW') {
        return null;
    }

    return allBooks.find(book => book._id.toString() === answer.bookId);
}

/**
 * Upload parsed book data from Parser v2 to MongoDB database and upload images to Vercel Blob
 * If a book with the same title exists, it will be updated with new content (keeping same ID)
 * @param {string} outputFolderPath - Path to the parser output folder containing output.json and images/
 * @param {Object} [options]
 * @param {boolean} [options.uploadImages=false] - When true, uploads images to Vercel Blob (requires BLOB_READ_WRITE_TOKEN)
 */
async function uploadParsedBookV2(outputFolderPath, options = {}) {
    const uri = 'mongodb+srv://gileck:jfxccnxeruiowqrioqsdjkla@cluster0.frtddwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
    const dbName = 'book_reader_db'

    // Validate input path (should be the output folder created by parser.js)
    if (!fs.existsSync(outputFolderPath)) {
        console.error(`❌ Output folder not found: ${outputFolderPath}`);
        process.exit(1);
    }

    if (!fs.statSync(outputFolderPath).isDirectory()) {
        console.error(`❌ Path must be the output directory created by parser.js: ${outputFolderPath}`);
        process.exit(1);
    }

    // Find required files in the output folder
    let jsonPath, imagesPath;
    try {
        jsonPath = findOutputFile(outputFolderPath);
        console.log(`📄 Found output file: ${path.basename(jsonPath)}`);

        imagesPath = findImagesFolder(outputFolderPath);
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
    let finalOutput;
    try {
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        finalOutput = JSON.parse(jsonContent);
    } catch (error) {
        console.error('❌ Error reading or parsing output.json file:', error.message);
        process.exit(1);
    }

    // Validate parser v2 JSON structure (should be simplified format)
    if (!finalOutput.chapters || !finalOutput.metadata) {
        console.error('❌ Invalid parser v2 output.json structure. Expected simplified format: { chapters: [...], metadata: { title, author } }');
        process.exit(1);
    }

    console.log(`📊 Parser v2 final output: ${finalOutput.chapters.length} chapters found`);

    // Extract book metadata
    const bookMetadata = extractBookMetadata(finalOutput);
    console.log(`📖 Book metadata extracted: "${bookMetadata.title}"`);

    // Convert final output to chapter format
    const chapters = convertParserOutputToChapters(finalOutput, bookMetadata.title);
    console.log(`📚 Converted to ${chapters.length} chapters`);

    // Update book metadata with actual counts
    bookMetadata.totalChapters = chapters.length;
    bookMetadata.totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    // Determine the starting chapter number (0 or 1) based on first chapter present
    const chapterNumbers = chapters.map(ch => ch.chapterNumber).filter(n => typeof n === 'number');
    const firstChapterNumber = chapterNumbers.length > 0 ? Math.min(...chapterNumbers) : 1;
    bookMetadata.chapterStartNumber = firstChapterNumber;

    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();

        const db = client.db(dbName);
        const booksCollection = db.collection('books');
        const chaptersCollection = db.collection('chapters');

        console.log('✅ Connected successfully!');

        // Check if book already exists by title (case-insensitive)
        let existingBook = await booksCollection.findOne({
            title: { $regex: new RegExp(`^${bookMetadata.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        let bookId;
        let isUpdate = false;

        // If book not found by name, prompt user to select or create
        if (!existingBook) {
            console.log(`📚 Book "${bookMetadata.title}" not found in database.`);
            existingBook = await selectOrCreateBook(booksCollection, bookMetadata.title);
        }

        if (existingBook) {
            // Book exists - update it
            bookId = existingBook._id;
            isUpdate = true;
            console.log(`📚 Updating existing book: "${existingBook.title}" (ID: ${bookId})`);
            console.log(`🔄 Updating book content...`);
            console.log(`   📊 Previous: ${existingBook.totalChapters} chapters, ${existingBook.totalWords?.toLocaleString() || 'unknown'} words`);
            console.log(`   📊 New:      ${bookMetadata.totalChapters} chapters, ${bookMetadata.totalWords.toLocaleString()} words`);

            // Delete existing chapters for this book
            const deleteChaptersResult = await chaptersCollection.deleteMany({ bookId: bookId });
            console.log(`   🗑️  Deleted ${deleteChaptersResult.deletedCount} existing chapters`);

            // Update book metadata (keeping original title if user selected existing book)
            const bookUpdateData = {
                author: bookMetadata.author,
                description: bookMetadata.description,
                totalChapters: bookMetadata.totalChapters,
                totalWords: bookMetadata.totalWords,
                language: bookMetadata.language,
                parserVersion: bookMetadata.parserVersion,
                chapterStartNumber: bookMetadata.chapterStartNumber,
                updatedAt: new Date()
            };

            const bookUpdateResult = await booksCollection.updateOne(
                { _id: bookId },
                { $set: bookUpdateData }
            );
            console.log(`   📖 Updated book metadata (${bookUpdateResult.modifiedCount} book record modified)`);

        } else {
            // Create new book
            console.log(`📖 Creating new book: "${bookMetadata.title}"`);

            const bookToInsert = {
                title: bookMetadata.title,
                author: bookMetadata.author,
                description: bookMetadata.description,
                totalChapters: bookMetadata.totalChapters,
                totalWords: bookMetadata.totalWords,
                language: bookMetadata.language,
                parserVersion: bookMetadata.parserVersion,
                chapterStartNumber: bookMetadata.chapterStartNumber,
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

        // Upload images to Vercel Blob if requested via options
        const uploadImages = Boolean(options.uploadImages);

        if (imagesPath) {
            if (uploadImages && BLOB_READ_WRITE_TOKEN) {
                await uploadImagesToBlob(finalBook, imagesPath, db);
            } else if (uploadImages && !BLOB_READ_WRITE_TOKEN) {
                console.log('⚠️  BLOB_READ_WRITE_TOKEN not set, skipping image upload to Vercel');
                console.log('   Images remain in local folder and imageName references are preserved');
            } else {
                console.log('⏭️  Skipping image upload (enable with options.uploadImages or --upload-images)');
            }

            // Always set imageBaseURL and coverImage from local images folder when images exist
            try {
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

                if (imageFiles.length > 0) {
                    // Pick first by filename (sorted) to ensure deterministic cover selection
                    imageFiles.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));

                    const bookFolderName = finalBook.title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
                    const relativeImagePath = `/${bookFolderName}/images/`;
                    const coverImage = `${relativeImagePath}${imageFiles[0].filename}`;

                    await booksCollection.updateOne(
                        { _id: bookId },
                        {
                            $set: {
                                imageBaseURL: relativeImagePath,
                                coverImage: coverImage,
                                updatedAt: new Date()
                            }
                        }
                    );
                    console.log(`🖼️  Set cover image: ${coverImage}`);
                    console.log(`📚 Updated book with relative imageBaseURL: ${relativeImagePath}`);
                }
            } catch (err) {
                console.log('⚠️  Failed to set cover image from local images folder:', err.message);
            }
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
Usage: node upload-book.js OUTPUT_FOLDER [OPTIONS]

Arguments:
  OUTPUT_FOLDER      Path to parser output folder containing output.json and images/ (required)

Options:
  --upload-images    Upload images to Vercel Blob (requires BLOB_READ_WRITE_TOKEN)

Examples:
  # Upload from parser output folder
  node upload-book.js ./output/
  node upload-book.js ../files/MyBook/output/ --upload-images

Required folder structure (created by parser.js):
  output/
  ├── output.json       # Simplified parser output with chapters and metadata only
  ├── images/           # Extracted images (optional)
  │   └── *.jpg, *.png, etc.
  ├── steps/            # Individual step outputs (optional, for debugging)
  │   ├── step-1.json
  │   ├── step-2-1.json
  │   └── ...
  └── validation.json   # Validation results (optional)

Output.json format:
  {
    "chapters": [
      {
        "title": "Chapter Title",
        "chapterNumber": 1,
        "chunks": [
          {
            "type": "paragraph|image|header",
            "content": "text content",
            "wordCount": 100,
            ...
          }
        ]
      }
    ],
    "metadata": {
      "title": "Book Title",
      "author": "Author Name"
    }
  }

Behavior:
  - If a book with the same title already exists in the database, the script will update it
    with the new content, keeping the same book ID
  - If no book with that title exists, you will be prompted to:
    • Create a new book with the parsed title
    • OR select an existing book from the database to update
  - Only creates a new book if you explicitly choose "Create new book" option
  - Parser version 2 is automatically added to the book metadata
  - Images will be uploaded to Vercel Blob only if --upload-images flag is provided
  - The script reads ONLY the output.json file and images/ folder

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

        const outputFolderPath = args[0];
        const uploadImages = args.includes('--upload-images');

        if (!outputFolderPath) {
            console.error('❌ Output folder path is required');
            showHelp();
            process.exit(1);
        }

        console.log('🚀 Starting parser v2 book upload...');
        await uploadParsedBookV2(outputFolderPath, { uploadImages });

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