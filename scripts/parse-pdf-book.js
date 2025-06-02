const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { MongoClient, ObjectId } = require('mongodb');

// Text chunking function (fixed to preserve sentence punctuation)
function chunkText(text, minWords = 5, maxWords = 15) {
    // Split text while preserving punctuation
    const sentencePattern = /([.!?]+)/;
    const parts = text.split(sentencePattern);
    const sentences = [];

    // Reconstruct sentences with their punctuation
    for (let i = 0; i < parts.length; i += 2) {
        const sentence = parts[i]?.trim();
        const punctuation = parts[i + 1] || '';
        if (sentence) {
            sentences.push(sentence + punctuation);
        }
    }

    const chunks = [];
    let currentChunk = '';
    let currentWords = [];
    let wordIndex = 0;

    for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).filter(w => w.length > 0);

        // If adding this sentence would exceed maxWords, finalize current chunk
        if (currentWords.length > 0 && currentWords.length + sentenceWords.length > maxWords) {
            chunks.push({
                text: currentChunk.trim(),
                words: [...currentWords],
                startIndex: wordIndex - currentWords.length,
                endIndex: wordIndex - 1
            });
            currentChunk = '';
            currentWords = [];
        }

        // Add sentence to current chunk
        if (currentChunk.length > 0) {
            currentChunk += ' ';
        }
        currentChunk += sentence.trim();
        currentWords.push(...sentenceWords);
        wordIndex += sentenceWords.length;

        // If we have enough words, we can finalize the chunk
        if (currentWords.length >= minWords) {
            chunks.push({
                text: currentChunk.trim(),
                words: [...currentWords],
                startIndex: wordIndex - currentWords.length,
                endIndex: wordIndex - 1
            });
            currentChunk = '';
            currentWords = [];
        }
    }

    // Add remaining text as final chunk
    if (currentChunk.trim().length > 0) {
        chunks.push({
            text: currentChunk.trim(),
            words: [...currentWords],
            startIndex: wordIndex - currentWords.length,
            endIndex: wordIndex - 1
        });
    }

    // Post-process to merge chunks smaller than 10 words with adjacent chunks
    const mergedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        if (chunk.words.length < 10) {
            // For very small chunks (≤5 words), be more aggressive - allow exceeding maxWords slightly
            const isVerySmall = chunk.words.length <= 5;
            const maxAllowed = isVerySmall ? maxWords + 5 : maxWords;

            // Try to merge with next chunk if it exists
            if (i < chunks.length - 1 && chunk.words.length + chunks[i + 1].words.length <= maxAllowed) {
                const nextChunk = chunks[i + 1];
                const mergedChunk = {
                    text: chunk.text + ' ' + nextChunk.text,
                    words: [...chunk.words, ...nextChunk.words],
                    startIndex: chunk.startIndex,
                    endIndex: nextChunk.endIndex
                };
                mergedChunks.push(mergedChunk);
                i++; // Skip the next chunk since we merged it
            }
            // Otherwise try to merge with previous chunk if it exists
            else if (mergedChunks.length > 0 && mergedChunks[mergedChunks.length - 1].words.length + chunk.words.length <= maxAllowed) {
                const prevChunk = mergedChunks[mergedChunks.length - 1];
                prevChunk.text = prevChunk.text + ' ' + chunk.text;
                prevChunk.words = [...prevChunk.words, ...chunk.words];
                prevChunk.endIndex = chunk.endIndex;
            }
            // For very small chunks, try to merge with any adjacent chunk even if it exceeds normal limits
            else if (isVerySmall) {
                if (i < chunks.length - 1) {
                    const nextChunk = chunks[i + 1];
                    const mergedChunk = {
                        text: chunk.text + ' ' + nextChunk.text,
                        words: [...chunk.words, ...nextChunk.words],
                        startIndex: chunk.startIndex,
                        endIndex: nextChunk.endIndex
                    };
                    mergedChunks.push(mergedChunk);
                    i++; // Skip the next chunk since we merged it
                } else if (mergedChunks.length > 0) {
                    const prevChunk = mergedChunks[mergedChunks.length - 1];
                    prevChunk.text = prevChunk.text + ' ' + chunk.text;
                    prevChunk.words = [...prevChunk.words, ...chunk.words];
                    prevChunk.endIndex = chunk.endIndex;
                } else {
                    mergedChunks.push(chunk);
                }
            }
            // If can't merge, keep as is
            else {
                mergedChunks.push(chunk);
            }
        } else {
            mergedChunks.push(chunk);
        }
    }

    return mergedChunks;
}

// Chapter detection function
function detectChapters(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const chapters = [];
    let currentChapter = null;
    let chapterNumber = 1;
    let contentStarted = false;

    // Load chapter names from config
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, 'book-config.json');
    let chapterNames = [];

    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            chapterNames = config.chapterNames || [];
        } catch (error) {
            console.log('Could not load book config, falling back to auto-detection');
        }
    }

    // Skip front matter (title pages, copyright, etc.) by looking for substantial content
    let skipUntilContent = true;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip until we find "LIFE ITSELF" which is the first real chapter
        if (skipUntilContent) {
            // Look for the specific start of content
            const isLifeItself = line === "LIFE ITSELF";

            if (isLifeItself) {
                skipUntilContent = false;
                contentStarted = true;
            } else {
                continue; // Skip this line
            }
        }

        if (!contentStarted) continue;

        // Skip appendices and non-chapter sections
        const isAppendixOrBackMatter = /^(red protein mechanics|the krebs line|abbreviations|further reading|acknowledgements|index|bibliography|notes|references)$/i.test(line);
        if (isAppendixOrBackMatter) {
            break; // Stop processing chapters
        }

        // Check if this line matches any of the configured chapter names
        const isConfiguredChapter = chapterNames.some(name => line === name);

        // More relaxed chapter detection
        const explicitChapterMatch = line.match(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
        const numberedChapterMatch = line.match(/^(\d+)\.\s+([A-Za-z][a-zA-Z\s]{8,40})$/); // "1. Title" with 8-40 char title
        const clearTitleMatch = /^(epilogue|envoi)$/i.test(line); // Only allow epilogue and envoi as special chapters
        const allCapsTitle = line === line.toUpperCase() && /^[A-Z\s]{5,30}$/.test(line) && !/\d/.test(line); // All caps, 5-30 chars, no numbers

        // Strong filters to avoid false positives
        const isPageNumber = /^\d+$/.test(line) || /^page\s+\d+$/i.test(line);
        const isMetadata = /^(isbn|copyright|typeset|printed|published|all rights|first published|volume)/i.test(line);
        const isTooShort = line.length < 5;
        const isTooLong = line.length > 50; // Chapter titles shouldn't be too long
        const hasLowerCase = /[a-z]/.test(line) && !numberedChapterMatch; // Avoid partial sentences (except numbered chapters)
        const isPartialSentence = line.includes(',') || line.includes(';') || line.endsWith('of') || line.endsWith('the') || line.endsWith('and');
        const isBibliography = /\(\w+,|\d{4}\)|press|oxford|university|journal/i.test(line);

        // Check if this looks like a chapter heading (more permissive if it's in config)
        const isLikelyChapter = (isConfiguredChapter || explicitChapterMatch || numberedChapterMatch || clearTitleMatch || allCapsTitle)
            && !isPageNumber && !isMetadata && !isTooShort && !isTooLong
            && !isPartialSentence && !isBibliography && (!hasLowerCase || isConfiguredChapter);

        if (isLikelyChapter) {
            // Save previous chapter if it has substantial content
            if (currentChapter && currentChapter.content.length > 0) {
                const contentLength = currentChapter.content.join(' ').length;
                if (contentLength > 200) { // Reduced threshold for configured chapters
                    chapters.push(currentChapter);
                }
            }

            // Start new chapter
            let title = line;
            if (explicitChapterMatch) {
                title = line.replace(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*:?\s*/i, '').trim();
                if (!title) title = `Chapter ${chapterNumber}`;
            } else if (numberedChapterMatch) {
                title = numberedChapterMatch[2].trim();
            }

            currentChapter = {
                chapterNumber: chapterNumber++,
                title: title,
                content: []
            };
        } else if (currentChapter && line.length > 20 && !isMetadata && !isPageNumber) {
            // Add content to current chapter (skip short lines and metadata)
            currentChapter.content.push(line);
        } else if (!currentChapter && line.length > 50) {
            // No chapter detected yet, start with a general chapter for substantial content
            currentChapter = {
                chapterNumber: chapterNumber++,
                title: 'Introduction',
                content: [line]
            };
        }
    }

    // Add the last chapter if it has substantial content
    if (currentChapter && currentChapter.content.length > 0) {
        const contentLength = currentChapter.content.join(' ').length;
        if (contentLength > 200) {
            chapters.push(currentChapter);
        }
    }

    // If no chapters detected, create one big chapter from all substantial content
    if (chapters.length === 0) {
        const allContent = lines.filter(line =>
            line.length > 50 &&
            !/^(isbn|copyright|typeset|printed|published|all rights|first published)/i.test(line) &&
            !/^\d+$/.test(line)
        );

        if (allContent.length > 0) {
            chapters.push({
                chapterNumber: 1,
                title: 'Full Text',
                content: allContent
            });
        }
    }

    return chapters;
}

// Extract book metadata from PDF
function extractBookMetadata(pdfData, filename) {
    const info = pdfData.info || {};

    // Try to get title from PDF metadata or filename
    let title = info.Title || filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
    title = title.split('__').map(part =>
        part.split(/[-_]/).map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ')
    ).join(': ');

    const author = info.Author || info.Creator || 'Unknown Author';

    return {
        title,
        author,
        description: `Book parsed from PDF: ${filename}`,
        language: 'en-US',
        isPublic: true
    };
}

// Convert chapters to database format
function convertChaptersToDbFormat(chapters) {
    return chapters.map(chapter => {
        const chapterText = chapter.content.join(' ');
        const ttsChunks = chunkText(chapterText);

        const dbChunks = ttsChunks.map((chunk, index) => ({
            index,
            text: chunk.text,
            wordCount: chunk.words.length,
            type: 'text'
        }));

        const totalWords = dbChunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);

        return {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            content: {
                chunks: dbChunks
            },
            wordCount: totalWords
        };
    });
}

// Main parsing function
async function parsePdfBook(pdfPath) {
    console.log(`Parsing PDF: ${pdfPath}`);

    // Read and parse PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);

    console.log(`Extracted ${pdfData.numpages} pages, ${pdfData.text.length} characters`);

    // Extract metadata
    const filename = path.basename(pdfPath);
    const bookMetadata = extractBookMetadata(pdfData, filename);

    // Detect chapters
    const chapters = detectChapters(pdfData.text);
    console.log(`Detected ${chapters.length} chapters`);

    // Convert to database format
    const dbChapters = convertChaptersToDbFormat(chapters);

    // Calculate totals
    const totalWords = dbChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    const totalChapters = dbChapters.length;

    const book = {
        ...bookMetadata,
        totalChapters,
        totalWords,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    return { book, chapters: dbChapters };
}

// Save to database
async function saveParsedBook(book, chapters) {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DATABASE_NAME || 'book_reader';

    const client = new MongoClient(uri);

    try {
        console.log('Connecting to MongoDB...');
        await client.connect();

        const db = client.db(dbName);
        const booksCollection = db.collection('books');
        const chaptersCollection = db.collection('chapters');

        // Check if book already exists
        const existingBook = await booksCollection.findOne({ title: book.title });
        if (existingBook) {
            console.log('Book already exists. Skipping upload.');
            return;
        }

        // Insert book
        console.log('Inserting book...');
        const bookResult = await booksCollection.insertOne(book);
        const bookId = bookResult.insertedId;

        // Insert chapters
        console.log('Inserting chapters...');
        const chaptersToInsert = chapters.map(chapter => ({
            ...chapter,
            bookId,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        const chaptersResult = await chaptersCollection.insertMany(chaptersToInsert);

        console.log('✅ Book parsed and saved successfully!');
        console.log(`📖 Title: "${book.title}"`);
        console.log(`👤 Author: ${book.author}`);
        console.log(`📚 Chapters: ${chapters.length}`);
        console.log(`📝 Total words: ${book.totalWords.toLocaleString()}`);
        console.log(`🆔 Book ID: ${bookId}`);

    } catch (error) {
        console.error('❌ Error saving to database:', error);
        throw error;
    } finally {
        await client.close();
    }
}

// Save to file instead of database
function saveToFile(book, chapters, outputPath) {
    const output = {
        book,
        chapters,
        metadata: {
            parsedAt: new Date().toISOString(),
            totalChapters: chapters.length,
            totalWords: book.totalWords,
            avgWordsPerChapter: Math.round(book.totalWords / chapters.length)
        }
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`📄 Output saved to: ${outputPath}`);
}

// Main execution
async function main() {
    try {
        const pdfPath = process.argv[2] || path.join(__dirname, '../files/nick-lane__transformer.pdf');

        if (!fs.existsSync(pdfPath)) {
            console.error(`❌ PDF file not found: ${pdfPath}`);
            process.exit(1);
        }

        console.log('🚀 Starting PDF book parsing...');

        const { book, chapters } = await parsePdfBook(pdfPath);

        // Save to file instead of database
        const outputPath = path.join(__dirname, '../files/parsed-book-output.json');
        saveToFile(book, chapters, outputPath);

        console.log('✅ Book parsed and saved to file successfully!');
        console.log(`📖 Title: "${book.title}"`);
        console.log(`👤 Author: ${book.author}`);
        console.log(`📚 Chapters: ${chapters.length}`);
        console.log(`📝 Total words: ${book.totalWords.toLocaleString()}`);
        console.log(`📄 Output file: ${outputPath}`);

    } catch (error) {
        console.error('❌ Error parsing PDF:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { parsePdfBook, saveParsedBook }; 