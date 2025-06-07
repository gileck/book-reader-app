const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { MongoClient, ObjectId } = require('mongodb');

// Load book configurations
function loadBookConfig(configPath) {
    if (!configPath) {
        throw new Error('Config file path is required');
    }

    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Set defaults for optional fields
    return {
        chapterNames: config.chapterNames || [],
        chapterPatterns: config.chapterPatterns || [
            "^chapter\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\b",
            "^(\\d+)\\.\\s+([A-Za-z][a-zA-Z\\s]{8,40})$",
            "^(introduction|conclusion|epilogue|prologue|preface|foreword|afterword)$",
            "^[A-Z\\s]{5,30}$"
        ],
        excludePatterns: config.excludePatterns || [
            "^(appendix|bibliography|index|notes|references|acknowledgements|about the author|glossary)$"
        ],
        skipFrontMatter: config.skipFrontMatter !== undefined ? config.skipFrontMatter : true,
        chapterNumbering: config.chapterNumbering || "sequential",
        metadata: config.metadata || { title: null, author: null }
    };
}

// Text chunking function (preserved from original)
function chunkText(text, minWords = 5, maxWords = 15) {
    const sentencePattern = /([.!?]+)/;
    const parts = text.split(sentencePattern);
    const sentences = [];

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

        if (currentChunk.length > 0) {
            currentChunk += ' ';
        }
        currentChunk += sentence.trim();
        currentWords.push(...sentenceWords);
        wordIndex += sentenceWords.length;

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

    if (currentChunk.trim().length > 0) {
        chunks.push({
            text: currentChunk.trim(),
            words: [...currentWords],
            startIndex: wordIndex - currentWords.length,
            endIndex: wordIndex - 1
        });
    }

    // Post-process to merge small chunks
    const mergedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        if (chunk.words.length < 10) {
            const isVerySmall = chunk.words.length <= 5;
            const maxAllowed = isVerySmall ? maxWords + 5 : maxWords;

            if (i < chunks.length - 1 && chunk.words.length + chunks[i + 1].words.length <= maxAllowed) {
                const nextChunk = chunks[i + 1];
                const mergedChunk = {
                    text: chunk.text + ' ' + nextChunk.text,
                    words: [...chunk.words, ...nextChunk.words],
                    startIndex: chunk.startIndex,
                    endIndex: nextChunk.endIndex
                };
                mergedChunks.push(mergedChunk);
                i++;
            } else if (mergedChunks.length > 0 && mergedChunks[mergedChunks.length - 1].words.length + chunk.words.length <= maxAllowed) {
                const prevChunk = mergedChunks[mergedChunks.length - 1];
                prevChunk.text = prevChunk.text + ' ' + chunk.text;
                prevChunk.words = [...prevChunk.words, ...chunk.words];
                prevChunk.endIndex = chunk.endIndex;
            } else if (isVerySmall) {
                if (i < chunks.length - 1) {
                    const nextChunk = chunks[i + 1];
                    const mergedChunk = {
                        text: chunk.text + ' ' + nextChunk.text,
                        words: [...chunk.words, ...nextChunk.words],
                        startIndex: chunk.startIndex,
                        endIndex: nextChunk.endIndex
                    };
                    mergedChunks.push(mergedChunk);
                    i++;
                } else if (mergedChunks.length > 0) {
                    const prevChunk = mergedChunks[mergedChunks.length - 1];
                    prevChunk.text = prevChunk.text + ' ' + chunk.text;
                    prevChunk.words = [...prevChunk.words, ...chunk.words];
                    prevChunk.endIndex = chunk.endIndex;
                } else {
                    mergedChunks.push(chunk);
                }
            } else {
                mergedChunks.push(chunk);
            }
        } else {
            mergedChunks.push(chunk);
        }
    }

    return mergedChunks;
}

/**
 * Normalize text for fuzzy matching
 */
function normalizeText(text) {
    return text
        .replace(/\s+/g, ' ')           // Multiple spaces → single space
        .replace(/[\u201C\u201D]/g, '"') // Smart quotes → straight quotes (U+201C, U+201D)
        .replace(/[\u2018\u2019]/g, "'") // Smart apostrophes → straight (U+2018, U+2019)
        .replace(/[\u2033\u2036]/g, '"') // Additional smart quotes (U+2033, U+2036)
        .replace(/\\/g, '')             // Remove escape characters from config
        .replace(/\s+(ix|xi{1,3}|[0-9]+)\s*$/i, '') // Remove page numbers at end
        .trim();
}

/**
 * Fuzzy match PDF line against config title
 */
function fuzzyMatch(pdfLine, configTitle) {
    const normalizedLine = normalizeText(pdfLine);
    const normalizedTitle = normalizeText(configTitle);

    // Check exact match after normalization
    if (normalizedLine === normalizedTitle) {
        return true;
    }

    // Check if line starts with the title (handles joined content)
    if (normalizedLine.startsWith(normalizedTitle)) {
        return true;
    }

    // Check if title is contained in line (handles split lines)
    if (normalizedLine.includes(normalizedTitle) && normalizedTitle.length > 10) {
        return true;
    }

    // Handle split titles: check if line ends with most of the title
    // Example: "e Search for Emotion's \"Fingerprints\"" should match "The Search for Emotion's \"Fingerprints\""
    if (normalizedTitle.length > 10) {
        // Try removing first 1-3 characters from title to handle split
        for (let skip = 1; skip <= 3; skip++) {
            const partialTitle = normalizedTitle.substring(skip);
            if (partialTitle.length > 8 && normalizedLine === partialTitle) {
                return true;
            }
            // Also check if line starts with partial title
            if (partialTitle.length > 8 && normalizedLine.startsWith(partialTitle)) {
                return true;
            }
        }
    }

    return false;
}

// Generic chapter detection function
function detectChapters(text, config) {
    // DEBUG: Output raw text to file for inspection
    if (process.env.DEBUG_TEXT) {
        const fs = require('fs');
        const debugPath = process.env.DEBUG_TEXT;
        fs.writeFileSync(debugPath, text, 'utf8');
        console.log(`DEBUG: Raw PDF text saved to ${debugPath}`);
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const chapters = [];
    let currentChapter = null;
    let chapterNumber = 1;
    let contentStarted = !config.skipFrontMatter;

    // Create regex patterns from config
    const chapterPatterns = config.chapterPatterns.map(pattern => new RegExp(pattern, 'i'));
    const excludePattern = config.excludePatterns.length > 0 ?
        new RegExp(config.excludePatterns.join('|'), 'i') : null;

    // Auto-detect content start by finding "Contents" page and looking for first chapter
    let contentStartIndex = 0;
    for (let i = 0; i < Math.min(lines.length, 200); i++) { // Check first 200 lines
        const line = lines[i].toLowerCase();
        if (line.includes('contents') || line.includes('table of contents')) {
            // Look for the first chapter title from config right after TOC
            contentStartIndex = i + 5; // Start looking just a few lines after Contents

            // Search for the first chapter title from our config
            let foundFirstChapter = false;
            for (let j = i + 5; j < Math.min(lines.length, i + 100); j++) {
                const candidateLine = lines[j];

                // Check if this line matches any chapter from config
                if (config.chapterNames && config.chapterNames.length > 0) {
                    const matchingTitle = config.chapterNames.find(title => fuzzyMatch(candidateLine, title));
                    if (matchingTitle) {
                        contentStartIndex = j - 2; // Start a bit before the chapter title
                        foundFirstChapter = true;
                        console.log(`DEBUG: Found first chapter "${matchingTitle}" at line ${j}, starting detection from line ${contentStartIndex}`);
                        break;
                    }
                }
            }

            // If no chapter found, fall back to conservative approach
            if (!foundFirstChapter) {
                contentStartIndex = i + 15; // More conservative than before
                console.log(`DEBUG: No first chapter found, using fallback start at line ${contentStartIndex}`);
            }

            console.log(`DEBUG: Found "Contents" at line ${i}, starting chapter detection from line ${contentStartIndex}`);

            // DEBUG: Show some lines around the content start
            if (process.env.DEBUG_TEXT) {
                console.log(`DEBUG: Lines around content start:`);
                for (let j = Math.max(0, contentStartIndex - 5); j < Math.min(lines.length, contentStartIndex + 20); j++) {
                    const prefix = j === contentStartIndex ? '>>> ' : '    ';
                    console.log(`${prefix}Line ${j}: "${lines[j]}"`);
                }
            }
            break;
        }
    }

    // For explicit chapters, find ALL occurrences of each chapter name and pick the best one
    if (config.chapterNames && config.chapterNames.length > 0) {
        let allChapterOccurrences = {};

        // Find ALL occurrences of each chapter name using fuzzy matching
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Find matching title using fuzzy matching
            const matchingTitle = config.chapterNames.find(title => fuzzyMatch(line, title));

            if (matchingTitle) {
                if (!allChapterOccurrences[matchingTitle]) {
                    allChapterOccurrences[matchingTitle] = [];
                }
                allChapterOccurrences[matchingTitle].push({ line: matchingTitle, index: i, originalLine: line });

                if (process.env.DEBUG_TEXT) {
                    console.log(`DEBUG: Found occurrence of "${matchingTitle}" at line ${i}: "${line}"`);
                }
            }
        }

        // For each chapter, pick the occurrence that has the most content after it
        let chapterOccurrences = [];
        for (const [chapterTitle, occurrences] of Object.entries(allChapterOccurrences)) {
            let bestOccurrence = null;
            let maxContentLines = 0;

            for (const occurrence of occurrences) {
                // Count content lines after this occurrence
                let contentLines = 0;
                for (let j = occurrence.index + 1; j < Math.min(lines.length, occurrence.index + 100); j++) {
                    const nextLine = lines[j];

                    // Stop if we hit another chapter name
                    const isNextChapter = config.chapterNames.some(title => fuzzyMatch(nextLine, title));
                    if (isNextChapter) {
                        break;
                    }

                    // Count substantial content lines
                    if (nextLine.length > 20 && !/^\d+$/.test(nextLine)) {
                        contentLines++;
                    }
                }

                if (process.env.DEBUG_TEXT) {
                    console.log(`DEBUG: "${chapterTitle}" at line ${occurrence.index} has ${contentLines} content lines`);
                }

                // Pick the occurrence with the most content
                if (contentLines > maxContentLines) {
                    maxContentLines = contentLines;
                    bestOccurrence = occurrence;
                }
            }

            if (bestOccurrence && maxContentLines >= 1) {
                chapterOccurrences.push(bestOccurrence);
                console.log(`DEBUG: Selected "${chapterTitle}" at line ${bestOccurrence.index} (${maxContentLines} content lines)`);
            } else if (process.env.DEBUG_TEXT) {
                console.log(`DEBUG: Rejected all occurrences of "${chapterTitle}" - insufficient content (${maxContentLines} lines)`);
            }
        }

        console.log(`DEBUG: Found ${chapterOccurrences.length} chapters with validated content`);

        // Sort chapters by their line index to ensure proper order
        chapterOccurrences.sort((a, b) => a.index - b.index);

        // Process the selected chapters
        for (let chapterIdx = 0; chapterIdx < chapterOccurrences.length; chapterIdx++) {
            const currentChapterOcc = chapterOccurrences[chapterIdx];
            const nextChapterOcc = chapterOccurrences[chapterIdx + 1];

            const startLine = currentChapterOcc.index;
            const endLine = nextChapterOcc ? nextChapterOcc.index : lines.length;

            console.log(`DEBUG: Processing chapter "${currentChapterOcc.line}" from line ${startLine} to ${endLine}`);

            const chapterContent = [];
            for (let i = startLine + 1; i < endLine; i++) {
                const line = lines[i];

                // Skip page numbers and metadata
                const isPageNumber = /^\d+$/.test(line);
                const isMetadata = /^(isbn|copyright|typeset|printed|published|all rights|first published|volume)/i.test(line);

                if (line.length > 10 && !isPageNumber && !isMetadata) {
                    chapterContent.push(line);
                }
            }

            console.log(`DEBUG: Chapter "${currentChapterOcc.line}" extracted ${chapterContent.length} content lines`);

            if (chapterContent.length > 0) {
                chapters.push({
                    chapterNumber: chapterNumber++,
                    title: currentChapterOcc.line,
                    content: chapterContent
                });
                console.log(`DEBUG: Added chapter "${currentChapterOcc.line}" to final list (total chapters: ${chapters.length})`);
            } else {
                console.log(`DEBUG: Skipped chapter "${currentChapterOcc.line}" - no valid content lines`);
            }
        }
    } else {
        // Fallback to pattern-based detection (original logic)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Skip front matter if configured
            if (!contentStarted) {
                const isLikelyContent = line.length > 100 ||
                    chapterPatterns.some(pattern => pattern.test(line));
                if (isLikelyContent) {
                    contentStarted = true;
                } else {
                    continue;
                }
            }

            // Check if we should stop (back matter)
            if (excludePattern && excludePattern.test(line)) {
                console.log(`DEBUG: Stopping at back matter: "${line}"`);
                break;
            }

            const isChapterHeading = chapterPatterns.some(pattern => pattern.test(line));

            // Additional filters
            const isPageNumber = /^\d+$/.test(line) || /^page\s+\d+$/i.test(line);
            const isMetadata = /^(isbn|copyright|typeset|printed|published|all rights|first published|volume)/i.test(line);
            const isTooShort = line.length < 5;
            const isTooLong = line.length > 50;
            const isPartialSentence = line.includes(',') || line.includes(';') ||
                line.endsWith('of') || line.endsWith('the') || line.endsWith('and');
            const isBibliography = /\(\w+,|\d{4}\)|press|oxford|university|journal/i.test(line);

            const isLikelyChapter = isChapterHeading && !isPageNumber &&
                !isMetadata && !isTooShort && !isTooLong && !isPartialSentence && !isBibliography;

            if (isLikelyChapter) {
                // Save previous chapter
                if (currentChapter && currentChapter.content.length > 0) {
                    const contentLength = currentChapter.content.join(' ').length;
                    if (contentLength > 200) {
                        chapters.push(currentChapter);
                    }
                }

                // Start new chapter
                let title = line;
                const explicitChapterMatch = line.match(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*:?\s*/i);
                const numberedChapterMatch = line.match(/^(\d+)\.\s+([A-Za-z][a-zA-Z\s]{8,40})$/);

                if (explicitChapterMatch) {
                    title = line.replace(explicitChapterMatch[0], '').trim();
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
                currentChapter.content.push(line);
            } else if (!currentChapter && line.length > 50) {
                // Create first chapter if none detected yet
                currentChapter = {
                    chapterNumber: chapterNumber++,
                    title: 'Chapter 1',
                    content: [line]
                };
            }
        }

        // Add final chapter
        if (currentChapter && currentChapter.content.length > 0) {
            const contentLength = currentChapter.content.join(' ').length;
            if (contentLength > 200) {
                chapters.push(currentChapter);
            }
        }
    }

    console.log(`DEBUG: Total chapters found: ${chapters.length}`);
    chapters.forEach((ch, idx) => {
        console.log(`DEBUG: Chapter ${idx + 1}: "${ch.title}" (${ch.content.length} lines)`);
    });

    // Fallback: create single chapter if no chapters detected
    if (chapters.length === 0) {
        console.log(`DEBUG: No chapters detected, creating fallback chapter`);
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
function extractBookMetadata(pdfData, filename, config) {
    const info = pdfData.info || {};

    let title = config.metadata.title || info.Title ||
        filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

    if (!config.metadata.title) {
        title = title.split('__').map(part =>
            part.split(/[-_]/).map(word =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
        ).join(': ');
    }

    const author = config.metadata.author || info.Author || info.Creator || 'Unknown Author';

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
async function parsePdfBook(pdfPath, configPath) {
    console.log(`Parsing PDF: ${pdfPath}`);
    console.log(`Using config: ${configPath}`);

    const config = loadBookConfig(configPath);

    // Read and parse PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);

    console.log(`Extracted ${pdfData.numpages} pages, ${pdfData.text.length} characters`);

    // Extract metadata
    const filename = path.basename(pdfPath);
    const bookMetadata = extractBookMetadata(pdfData, filename, config);

    // Detect chapters
    const chapters = detectChapters(pdfData.text, config);
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

// Save to file
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
        // Parse command line arguments
        const args = process.argv.slice(2);
        const pdfPath = args[0];
        const configPath = args[1];
        const outputPath = args[2];

        if (!pdfPath) {
            console.error('❌ PDF file path is required');
            showHelp();
            process.exit(1);
        }

        if (!configPath) {
            console.error('❌ Config file path is required');
            showHelp();
            process.exit(1);
        }

        const finalOutputPath = outputPath || path.join(path.dirname(pdfPath), 'parsed-book-output.json');

        if (!fs.existsSync(pdfPath)) {
            console.error(`❌ PDF file not found: ${pdfPath}`);
            process.exit(1);
        }

        console.log('🚀 Starting PDF book parsing...');

        const { book, chapters } = await parsePdfBook(pdfPath, configPath);

        saveToFile(book, chapters, finalOutputPath);

        console.log('✅ Book parsed and saved to file successfully!');
        console.log(`📖 Title: "${book.title}"`);
        console.log(`👤 Author: ${book.author}`);
        console.log(`📚 Chapters: ${chapters.length}`);
        console.log(`📝 Total words: ${book.totalWords.toLocaleString()}`);
        console.log(`📄 Output file: ${finalOutputPath}`);

    } catch (error) {
        console.error('❌ Error parsing PDF:', error);
        process.exit(1);
    }
}

// CLI usage help
function showHelp() {
    console.log(`
Usage: node parse-pdf-book-generic.js PDF_PATH CONFIG_PATH [OUTPUT_PATH]

Arguments:
  PDF_PATH    Path to the PDF file (required)
  CONFIG_PATH Path to the book configuration JSON file (required)
  OUTPUT_PATH Output JSON file path (optional, defaults to same directory as PDF)

Examples:
  node parse-pdf-book-generic.js ./my-book.pdf ./my-book-config.json
  node parse-pdf-book-generic.js ./my-book.pdf ./my-book-config.json ./output.json
  node parse-pdf-book-generic.js ../files/nick-lane__transformer.pdf ./book-config.json

Each book should have its own configuration file defining chapter names and metadata.
`);
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { parsePdfBook, loadBookConfig, detectChapters }; 