const { MongoClient, ObjectId } = require('mongodb');

// Sample book data
const sampleBook = {
    title: "The Adventures of Programming",
    author: "Code Writer",
    description: "A fascinating journey through the world of software development, exploring the challenges and triumphs of modern programming.",
    coverImage: "/images/sample-book-cover.jpg",
    totalChapters: 3,
    totalWords: 0, // Will be calculated
    language: "en-US",
    createdAt: new Date(),
    updatedAt: new Date(),
    isPublic: true
};

// Sample chapters with text content
const sampleChapters = [
    {
        chapterNumber: 1,
        title: "Getting Started",
        content: {
            chunks: [
                {
                    index: 0,
                    text: "Welcome to the wonderful world of programming! In this first chapter, we'll explore the fundamentals that every developer should know.",
                    wordCount: 23,
                    type: "text"
                },
                {
                    index: 1,
                    text: "Programming is both an art and a science. It requires creativity to solve problems and logical thinking to implement solutions effectively.",
                    wordCount: 22,
                    type: "text"
                },
                {
                    index: 2,
                    text: "Throughout this book, you'll discover various programming concepts, best practices, and real-world examples that will help you become a better developer.",
                    wordCount: 24,
                    type: "text"
                },
                {
                    index: 3,
                    text: "Let's begin this exciting journey together and unlock the power of code!",
                    wordCount: 13,
                    type: "text"
                }
            ]
        }
    },
    {
        chapterNumber: 2,
        title: "Understanding Variables and Data Types",
        content: {
            chunks: [
                {
                    index: 0,
                    text: "Variables are the building blocks of any programming language. They allow us to store and manipulate data in our programs.",
                    wordCount: 21,
                    type: "text"
                },
                {
                    index: 1,
                    text: "Different programming languages offer various data types such as strings, numbers, booleans, arrays, and objects.",
                    wordCount: 17,
                    type: "text"
                },
                {
                    index: 2,
                    text: "Understanding how to properly declare, initialize, and use variables is crucial for writing effective code.",
                    wordCount: 16,
                    type: "text"
                },
                {
                    index: 3,
                    text: "In this chapter, we'll explore how variables work in different programming paradigms and learn best practices for naming and organizing your data.",
                    wordCount: 25,
                    type: "text"
                },
                {
                    index: 4,
                    text: "By the end of this chapter, you'll have a solid foundation in working with variables and data types.",
                    wordCount: 18,
                    type: "text"
                }
            ]
        }
    },
    {
        chapterNumber: 3,
        title: "Control Flow and Logic",
        content: {
            chunks: [
                {
                    index: 0,
                    text: "Control flow statements determine the order in which your code executes. They are essential for creating dynamic and responsive programs.",
                    wordCount: 22,
                    type: "text"
                },
                {
                    index: 1,
                    text: "Conditional statements like if-else allow your program to make decisions based on different conditions and data states.",
                    wordCount: 18,
                    type: "text"
                },
                {
                    index: 2,
                    text: "Loops enable you to repeat code blocks efficiently, processing large amounts of data without writing repetitive code.",
                    wordCount: 18,
                    type: "text"
                },
                {
                    index: 3,
                    text: "Switch statements provide a clean way to handle multiple conditions, while functions help organize and reuse code effectively.",
                    wordCount: 19,
                    type: "text"
                },
                {
                    index: 4,
                    text: "Mastering control flow is key to writing programs that can handle complex logic and user interactions gracefully.",
                    wordCount: 18,
                    type: "text"
                },
                {
                    index: 5,
                    text: "Practice these concepts with real examples to build confidence in your programming abilities.",
                    wordCount: 14,
                    type: "text"
                }
            ]
        }
    }
];

async function uploadSampleBook() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DATABASE_NAME || 'book_reader';

    const client = new MongoClient(uri);

    try {
        console.log('Connecting to MongoDB...');
        await client.connect();

        const db = client.db(dbName);
        const booksCollection = db.collection('books');
        const chaptersCollection = db.collection('chapters');

        console.log('Connected successfully!');

        // Check if sample book already exists
        const existingBook = await booksCollection.findOne({ title: sampleBook.title });
        if (existingBook) {
            console.log('Sample book already exists. Skipping upload.');
            return;
        }

        // Calculate total word count
        const totalWords = sampleChapters.reduce((total, chapter) => {
            const chapterWords = chapter.content.chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
            return total + chapterWords;
        }, 0);

        // Insert the book
        console.log('Inserting sample book...');
        const bookResult = await booksCollection.insertOne({
            ...sampleBook,
            totalWords
        });

        const bookId = bookResult.insertedId;
        console.log(`Book inserted with ID: ${bookId}`);

        // Insert chapters
        console.log('Inserting sample chapters...');
        const chaptersToInsert = sampleChapters.map(chapter => {
            const chapterWordCount = chapter.content.chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
            return {
                ...chapter,
                bookId,
                wordCount: chapterWordCount,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        });

        const chaptersResult = await chaptersCollection.insertMany(chaptersToInsert);
        console.log(`${chaptersResult.insertedCount} chapters inserted successfully!`);

        // Update book with correct total chapters count
        await booksCollection.updateOne(
            { _id: bookId },
            {
                $set: {
                    totalChapters: chaptersResult.insertedCount,
                    updatedAt: new Date()
                }
            }
        );

        console.log('Sample book data uploaded successfully!');
        console.log(`Book: "${sampleBook.title}" by ${sampleBook.author}`);
        console.log(`Total chapters: ${chaptersResult.insertedCount}`);
        console.log(`Total words: ${totalWords}`);

    } catch (error) {
        console.error('Error uploading sample book:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('Database connection closed.');
    }
}

// Run the script
if (require.main === module) {
    uploadSampleBook().catch(console.error);
}

module.exports = { uploadSampleBook }; 