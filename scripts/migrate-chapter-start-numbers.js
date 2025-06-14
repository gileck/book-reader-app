const { MongoClient } = require('mongodb');

// MongoDB connection URL - update this to match your database
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/book-reader-app';

async function migrateChapterStartNumbers() {
    const client = new MongoClient(MONGODB_URL);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db();
        const booksCollection = db.collection('books');
        const chaptersCollection = db.collection('chapters');

        // Find all books that don't have chapterStartNumber
        const booksToUpdate = await booksCollection.find({
            chapterStartNumber: { $exists: false }
        }).toArray();

        console.log(`Found ${booksToUpdate.length} books to update`);

        for (const book of booksToUpdate) {
            console.log(`\nProcessing book: "${book.title}"`);

            // Find the first chapter for this book
            const firstChapter = await chaptersCollection.findOne(
                { bookId: book._id },
                { sort: { chapterNumber: 1 } }
            );

            let chapterStartNumber = 1; // Default value

            if (firstChapter) {
                chapterStartNumber = firstChapter.chapterNumber;
                console.log(`  First chapter number: ${chapterStartNumber}`);
            } else {
                console.log(`  No chapters found, using default: ${chapterStartNumber}`);
            }

            // Update the book with chapterStartNumber
            const result = await booksCollection.updateOne(
                { _id: book._id },
                { $set: { chapterStartNumber } }
            );

            if (result.modifiedCount === 1) {
                console.log(`  ✅ Updated "${book.title}" with chapterStartNumber: ${chapterStartNumber}`);
            } else {
                console.log(`  ❌ Failed to update "${book.title}"`);
            }
        }

        console.log('\n🎉 Migration completed!');

        // Show summary
        const updatedBooks = await booksCollection.find({
            chapterStartNumber: { $exists: true }
        }).toArray();

        console.log(`\nSummary:`);
        console.log(`- Total books with chapterStartNumber: ${updatedBooks.length}`);

        const booksWithChapter0 = updatedBooks.filter(b => b.chapterStartNumber === 0);
        const booksWithChapter1 = updatedBooks.filter(b => b.chapterStartNumber === 1);

        console.log(`- Books starting with chapter 0: ${booksWithChapter0.length}`);
        console.log(`- Books starting with chapter 1: ${booksWithChapter1.length}`);

        if (booksWithChapter0.length > 0) {
            console.log(`\nBooks with chapter 0 (likely have Introduction):`);
            booksWithChapter0.forEach(book => {
                console.log(`  - "${book.title}"`);
            });
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.close();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
migrateChapterStartNumbers().catch(console.error); 