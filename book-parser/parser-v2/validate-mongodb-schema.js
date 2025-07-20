/**
 * MongoDB Schema Validation Script for Parser v2
 * 
 * This script validates that the database schema in MongoDB matches
 * the expected v2 structure for books and chapters.
 */

const { MongoClient } = require('mongodb');

// Connection details - Update these for your environment
const MONGO_URI = "mongodb+srv://gileck:jfxccnxeruiowqrioqsdjkla@cluster0.frtddwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
const DATABASE_NAME = 'book_reader_db';

async function validateSchema() {
    const client = new MongoClient(MONGO_URI);

    try {
        console.log('🔍 Connecting to MongoDB...');
        await client.connect();
        const db = client.db(DATABASE_NAME);

        console.log(`✅ Connected to database: ${DATABASE_NAME}\n`);

        // Validate Books Collection Schema
        await validateBooksSchema(db);

        // Validate Chapters Collection Schema  
        await validateChaptersSchema(db);

        // Validate Parser v2 Data
        await validateV2ParserData(db);

        console.log('\n🎉 Schema validation completed successfully!');

    } catch (error) {
        console.error('❌ Schema validation failed:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

async function validateBooksSchema(db) {
    console.log('📚 VALIDATING BOOKS COLLECTION SCHEMA');
    console.log('====================================');

    const booksCollection = db.collection('books');

    // Check if collection exists
    const collections = await db.listCollections({ name: 'books' }).toArray();
    if (collections.length === 0) {
        throw new Error('Books collection does not exist');
    }
    console.log('✅ Books collection exists');

    // Get all books to check schema (limit increased for better coverage)
    const allBooks = await booksCollection.find({}).limit(20).toArray();

    // Also specifically query for v2 books
    const v2Books = await booksCollection.find({ parserVersion: 2 }).toArray();
    const v1Books = await booksCollection.find({ parserVersion: { $ne: 2 } }).limit(10).toArray();

    if (allBooks.length === 0) {
        console.log('⚠️  No books found in database');
        return;
    }

    console.log(`📊 Found ${allBooks.length} books to validate`);
    console.log(`📊 Parser v1 books: ${v1Books.length}`);
    console.log(`📊 Parser v2 books: ${v2Books.length}`);

    const requiredFields = [
        'title', 'totalChapters', 'totalWords', 'language',
        'createdAt', 'updatedAt', 'isPublic'
    ];

    // imageBaseURL is required for v2, optional for v1 (legacy)
    const v2RequiredFields = [...requiredFields, 'imageBaseURL', 'parserVersion'];

    let schemaErrors = [];

    // Validate v1 books
    for (const book of v1Books) {
        // Check required fields for v1
        for (const field of requiredFields) {
            if (!(field in book)) {
                schemaErrors.push(`v1 Book ${book._id}: Missing required field '${field}'`);
            }
        }

        // Validate field types
        if (typeof book.title !== 'string') {
            schemaErrors.push(`v1 Book ${book._id}: title should be a string`);
        }
        if (typeof book.totalChapters !== 'number') {
            schemaErrors.push(`v1 Book ${book._id}: totalChapters should be a number`);
        }
        if (typeof book.totalWords !== 'number') {
            schemaErrors.push(`v1 Book ${book._id}: totalWords should be a number`);
        }
        if (typeof book.isPublic !== 'boolean') {
            schemaErrors.push(`v1 Book ${book._id}: isPublic should be a boolean`);
        }
    }

    // Validate v2 books
    for (const book of v2Books) {
        // Check required fields for v2
        for (const field of v2RequiredFields) {
            if (!(field in book)) {
                schemaErrors.push(`v2 Book ${book._id}: Missing required field '${field}'`);
            }
        }

        // Check parser version
        if (typeof book.parserVersion !== 'number') {
            schemaErrors.push(`v2 Book ${book._id}: parserVersion should be a number`);
        }
        if (book.parserVersion !== 2) {
            schemaErrors.push(`v2 Book ${book._id}: parserVersion should be 2 for v2 books`);
        }

        // Validate field types
        if (typeof book.title !== 'string') {
            schemaErrors.push(`v2 Book ${book._id}: title should be a string`);
        }
        if (typeof book.totalChapters !== 'number') {
            schemaErrors.push(`v2 Book ${book._id}: totalChapters should be a number`);
        }
        if (typeof book.totalWords !== 'number') {
            schemaErrors.push(`v2 Book ${book._id}: totalWords should be a number`);
        }
        if (typeof book.isPublic !== 'boolean') {
            schemaErrors.push(`v2 Book ${book._id}: isPublic should be a boolean`);
        }
        if (book.imageBaseURL && typeof book.imageBaseURL !== 'string') {
            schemaErrors.push(`v2 Book ${book._id}: imageBaseURL should be a string`);
        }
    }

    if (schemaErrors.length > 0) {
        console.log('❌ Books schema errors found:');
        schemaErrors.forEach(error => console.log(`   - ${error}`));
        throw new Error(`Found ${schemaErrors.length} books schema errors`);
    } else {
        console.log('✅ Books schema validation passed');
    }

    console.log('');
}

async function validateChaptersSchema(db) {
    console.log('📖 VALIDATING CHAPTERS COLLECTION SCHEMA');
    console.log('======================================');

    const chaptersCollection = db.collection('chapters');

    // Check if collection exists
    const collections = await db.listCollections({ name: 'chapters' }).toArray();
    if (collections.length === 0) {
        throw new Error('Chapters collection does not exist');
    }
    console.log('✅ Chapters collection exists');

    // Sample a few chapters to check schema
    const sampleChapters = await chaptersCollection.find({}).limit(5).toArray();

    if (sampleChapters.length === 0) {
        console.log('⚠️  No chapters found in database');
        return;
    }

    console.log(`📊 Found ${sampleChapters.length} sample chapters to validate`);

    const requiredFields = [
        'bookId', 'chapterNumber', 'title', 'content',
        'wordCount', 'createdAt', 'updatedAt'
    ];

    let schemaErrors = [];
    let chunksWithV2Fields = 0;
    let totalChunks = 0;

    for (const chapter of sampleChapters) {
        // Check required fields
        for (const field of requiredFields) {
            if (!(field in chapter)) {
                schemaErrors.push(`Chapter ${chapter._id}: Missing required field '${field}'`);
            }
        }

        // Validate content structure
        if (!chapter.content || typeof chapter.content !== 'object') {
            schemaErrors.push(`Chapter ${chapter._id}: content should be an object`);
            continue;
        }

        if (!Array.isArray(chapter.content.chunks)) {
            schemaErrors.push(`Chapter ${chapter._id}: content.chunks should be an array`);
            continue;
        }

        // Validate chunks
        for (const [index, chunk] of chapter.content.chunks.entries()) {
            totalChunks++;

            // Required chunk fields
            const requiredChunkFields = ['index', 'text', 'wordCount', 'type'];
            for (const field of requiredChunkFields) {
                if (!(field in chunk)) {
                    schemaErrors.push(`Chapter ${chapter._id}, chunk ${index}: Missing required field '${field}'`);
                }
            }

            // Check v2 fields
            const v2ChunkFields = ['sentenceCount', 'links', 'pageNumber'];
            let hasV2Fields = false;

            for (const field of v2ChunkFields) {
                if (field in chunk) {
                    hasV2Fields = true;

                    if (field === 'sentenceCount' && typeof chunk.sentenceCount !== 'number') {
                        schemaErrors.push(`Chapter ${chapter._id}, chunk ${index}: sentenceCount should be a number`);
                    }
                    if (field === 'links' && !Array.isArray(chunk.links)) {
                        schemaErrors.push(`Chapter ${chapter._id}, chunk ${index}: links should be an array`);
                    }
                    if (field === 'pageNumber' && typeof chunk.pageNumber !== 'number') {
                        schemaErrors.push(`Chapter ${chapter._id}, chunk ${index}: pageNumber should be a number`);
                    }
                }
            }

            if (hasV2Fields) {
                chunksWithV2Fields++;
            }

            // Validate chunk types
            const validTypes = ['text', 'header', 'image'];
            if (!validTypes.includes(chunk.type)) {
                schemaErrors.push(`Chapter ${chapter._id}, chunk ${index}: Invalid type '${chunk.type}'. Must be one of: ${validTypes.join(', ')}`);
            }

            // Image chunk validation
            if (chunk.type === 'image') {
                if (!('imageName' in chunk)) {
                    schemaErrors.push(`Chapter ${chapter._id}, chunk ${index}: Image chunk missing imageName`);
                }
            }
        }
    }

    console.log(`📊 Total chunks analyzed: ${totalChunks}`);
    console.log(`📊 Chunks with v2 fields: ${chunksWithV2Fields}`);
    console.log(`📊 v2 field coverage: ${totalChunks > 0 ? Math.round((chunksWithV2Fields / totalChunks) * 100) : 0}%`);

    if (schemaErrors.length > 0) {
        console.log('❌ Chapters schema errors found:');
        schemaErrors.forEach(error => console.log(`   - ${error}`));
        throw new Error(`Found ${schemaErrors.length} chapters schema errors`);
    } else {
        console.log('✅ Chapters schema validation passed');
    }

    console.log('');
}

async function validateV2ParserData(db) {
    console.log('🔬 VALIDATING PARSER V2 SPECIFIC DATA');
    console.log('===================================');

    const booksCollection = db.collection('books');
    const chaptersCollection = db.collection('chapters');

    // Find v2 books
    const v2Books = await booksCollection.find({ parserVersion: 2 }).toArray();

    if (v2Books.length === 0) {
        console.log('⚠️  No parser v2 books found in database');
        return;
    }

    console.log(`📊 Found ${v2Books.length} parser v2 books`);

    for (const book of v2Books) {
        console.log(`\n📖 Validating book: "${book.title || 'Unknown Title'}" (${book._id})`);

        // Find chapters for this book
        const chapters = await chaptersCollection.find({
            bookId: book._id
        }).toArray();

        console.log(`   📚 Chapters: ${chapters.length}/${book.totalChapters}`);

        if (chapters.length !== book.totalChapters) {
            console.log(`   ⚠️  Chapter count mismatch: found ${chapters.length}, expected ${book.totalChapters}`);
        }

        // Validate v2 specific features
        let totalChunks = 0;
        let chunksWithSentenceCount = 0;
        let chunksWithLinks = 0;
        let chunksWithPageNumbers = 0;
        let imageChunks = 0;
        let headerChunks = 0;
        let textChunks = 0;

        for (const chapter of chapters) {
            if (chapter.content && chapter.content.chunks) {
                for (const chunk of chapter.content.chunks) {
                    totalChunks++;

                    if ('sentenceCount' in chunk) chunksWithSentenceCount++;
                    if ('links' in chunk && chunk.links.length > 0) chunksWithLinks++;
                    if ('pageNumber' in chunk) chunksWithPageNumbers++;

                    if (chunk.type === 'image') imageChunks++;
                    else if (chunk.type === 'header') headerChunks++;
                    else if (chunk.type === 'text') textChunks++;
                }
            }
        }

        console.log(`   📊 Total chunks: ${totalChunks}`);
        console.log(`   📊 Text chunks: ${textChunks}`);
        console.log(`   📊 Header chunks: ${headerChunks}`);
        console.log(`   📊 Image chunks: ${imageChunks}`);
        console.log(`   📊 Chunks with sentence count: ${chunksWithSentenceCount} (${Math.round((chunksWithSentenceCount / totalChunks) * 100)}%)`);
        console.log(`   📊 Chunks with links: ${chunksWithLinks}`);
        console.log(`   📊 Chunks with page numbers: ${chunksWithPageNumbers} (${Math.round((chunksWithPageNumbers / totalChunks) * 100)}%)`);

        // Validate image URLs if imageBaseURL exists
        if (book.imageBaseURL && imageChunks > 0) {
            console.log(`   🖼️  Image base URL: ${book.imageBaseURL}`);
        }
    }

    console.log('\n✅ Parser v2 data validation completed');
}

// CLI execution
if (require.main === module) {
    console.log('🚀 Starting MongoDB Schema Validation for Parser v2\n');
    validateSchema().catch(console.error);
}

module.exports = {
    validateSchema,
    validateBooksSchema,
    validateChaptersSchema,
    validateV2ParserData
}; 