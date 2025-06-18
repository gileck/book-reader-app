const fs = require('fs');
const path = require('path');

/**
 * Chunk text into manageable pieces
 */
function chunkText(text, minWords = 5, maxWords = 15) {
    const sentences = [];
    let currentSentence = '';
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        currentSentence += (currentSentence ? ' ' : '') + word;
        
        if (/[.!?]+$/.test(word)) {
            const nextWord = words[i + 1];
            const isAbbreviation = endsWithAbbreviation(currentSentence);
            const nextIsLowercase = nextWord && /^[a-z]/.test(nextWord);
            
            if (!isAbbreviation || !nextIsLowercase) {
                sentences.push(currentSentence.trim());
                currentSentence = '';
            }
        }
    }
    
    if (currentSentence.trim()) {
        sentences.push(currentSentence.trim());
    }

    const chunks = [];
    let currentChunk = '';
    let currentWords = [];

    for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).filter(w => w.length > 0);

        if (currentWords.length > 0 && currentWords.length + sentenceWords.length > maxWords) {
            chunks.push({
                text: currentChunk.trim(),
                words: [...currentWords]
            });
            currentChunk = '';
            currentWords = [];
        }

        if (currentChunk.length > 0) {
            currentChunk += ' ';
        }
        currentChunk += sentence.trim();
        currentWords.push(...sentenceWords);

        if (currentWords.length >= minWords) {
            chunks.push({
                text: currentChunk.trim(),
                words: [...currentWords]
            });
            currentChunk = '';
            currentWords = [];
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push({
            text: currentChunk.trim(),
            words: [...currentWords]
        });
    }

    return chunks;
}

function endsWithAbbreviation(text) {
    const abbreviations = [
        'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'Inc', 'Ltd', 'Co', 'Corp',
        'vs', 'etc', 'eg', 'ie', 'al', 'et', 'cf', 'ca', 'pp', 'Ch', 'Sec',
        'Fig', 'No', 'Vol', 'Rev', 'Ed', 'St', 'Ave', 'Blvd', 'Mt', 'Ft'
    ];
    
    const words = text.trim().split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (!lastWord) return false;
    
    const cleanWord = lastWord.replace(/[.!?]+$/, '');
    return abbreviations.includes(cleanWord);
}

/**
 * Parse TOC to extract chapter structure
 */
function parseTOC(tocContent) {
    const lines = tocContent.split('\n').filter(line => line.trim());
    const chapters = [];
    let currentChapter = null;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Check for main chapter headings
        if (trimmedLine.startsWith('CHAPTER')) {
            if (currentChapter) {
                chapters.push(currentChapter);
            }
            
            const chapterMatch = trimmedLine.match(/CHAPTER\s+(\w+)\s*(.*)/);
            if (chapterMatch) {
                const chapterNumber = chapterMatch[1] === 'ONE' ? 1 : 
                                   chapterMatch[1] === 'TWO' ? 2 : 
                                   chapterMatch[1] === 'THREE' ? 3 : 1;
                
                currentChapter = {
                    chapterNumber,
                    title: chapterMatch[2] || `Chapter ${chapterNumber}`,
                    sections: []
                };
            }
        } else if (currentChapter && trimmedLine.length > 0 && !trimmedLine.match(/^\d+$/)) {
            // Extract section title and page number
            const pageMatch = trimmedLine.match(/^(.+?)\s+(\d+)$/);
            if (pageMatch) {
                currentChapter.sections.push({
                    title: pageMatch[1].trim(),
                    page: parseInt(pageMatch[2])
                });
            }
        }
    }
    
    if (currentChapter) {
        chapters.push(currentChapter);
    }
    
    return chapters;
}

/**
 * Split full book text into chapters based on TOC structure
 */
function splitBookIntoChapters(fullText, tocStructure) {
    const chapters = [];
    
    // Define chapter boundaries based on the actual text patterns
    const chapterMarkers = [
        { number: 1, pattern: /Chapter 1 The Force/i, title: "The Force: The Origins and Evolution of Mitochondria in Human Physiology" },
        { number: 2, pattern: /Chapter 2|The Dark Side of the Force/i, title: "The Dark Side of the Force: Health Conditions Linked to Mitochondrial Dysfunction" },
        { number: 3, pattern: /Chapter 3|Nurturing the Force/i, title: "Nurturing the Force: Nutritional and Lifestyle Factors to Improve Mitochondrial Health" }
    ];
    
    // Find chapter start positions
    const chapterPositions = [];
    for (const marker of chapterMarkers) {
        const match = fullText.search(marker.pattern);
        if (match !== -1) {
            chapterPositions.push({
                number: marker.number,
                title: marker.title,
                start: match,
                sections: tocStructure.find(ch => ch.chapterNumber === marker.number)?.sections || []
            });
        }
    }
    
    // Sort by position
    chapterPositions.sort((a, b) => a.start - b.start);
    
    // Extract chapter content
    for (let i = 0; i < chapterPositions.length; i++) {
        const currentChapter = chapterPositions[i];
        const nextChapter = chapterPositions[i + 1];
        
        const endPos = nextChapter ? nextChapter.start : fullText.length;
        const chapterContent = fullText.substring(currentChapter.start, endPos);
        
        // Clean up the content - remove the chapter header
        const cleanContent = chapterContent.replace(/^Chapter \d+ [^\n]*\n*/, '').trim();
        
        chapters.push({
            chapterNumber: currentChapter.number,
            title: currentChapter.title,
            content: cleanContent,
            sections: currentChapter.sections
        });
    }
    
    return chapters;
}

/**
 * Convert chapters to database format with chunks
 */
function convertChaptersToDbFormat(chapters) {
    return chapters.map(chapter => {
        const textChunks = chunkText(chapter.content);
        
        const dbChunks = textChunks.map((chunk, index) => {
            let text = chunk.text;
            
            // Clean the first chunk by removing any remaining chapter markers
            if (index === 0) {
                text = text.replace(/^(The Force|The Dark Side of the Force|Nurturing the Force)[^\n]*\n*/i, '').trim();
            }
            
            return {
                index,
                text: text,
                wordCount: chunk.words.length,
                type: 'text'
            };
        });
        
        const totalWords = dbChunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
        
        return {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            content: {
                chunks: dbChunks
            },
            wordCount: totalWords,
            sections: chapter.sections
        };
    });
}

/**
 * Generate book metadata
 */
function generateBookMetadata(chapters) {
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    
    return {
        title: "Mitochondria and the Future of Medicine",
        author: "Lee Know",
        totalWords,
        totalChapters: chapters.length,
        parsedAt: new Date().toISOString()
    };
}

/**
 * Save output to JSON file
 */
function saveToFile(book, chapters, outputPath) {
    const output = {
        book,
        chapters,
        metadata: {
            parsedAt: new Date().toISOString(),
            totalChapters: chapters.length,
            totalWords: book.totalWords,
            avgWordsPerChapter: Math.round(book.totalWords / chapters.length),
            hasImages: false,
            totalImages: 0,
            imagesFolderPath: null
        }
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`📄 Output saved to: ${outputPath}`);
    
    // Generate parser summary
    const summaryPath = path.join(path.dirname(outputPath), 'parser-summary.json');
    generateParserSummary(book, chapters, summaryPath);
}

/**
 * Generate parser summary
 */
function generateParserSummary(book, chapters, summaryPath) {
    const chapterSummaries = chapters.map(chapter => {
        const textChunks = chapter.content.chunks.filter(chunk => chunk.type === 'text');
        const previewText = textChunks.slice(0, 3).map(chunk => chunk.text).join(' ').substring(0, 200) + '...';
        
        return {
            chapterNumber: chapter.chapterNumber,
            chapterName: chapter.title,
            wordCount: chapter.wordCount,
            textChunks: textChunks.length,
            imageChunks: 0,
            totalChunks: textChunks.length,
            sections: chapter.sections || [],
            previewText
        };
    });
    
    const summary = {
        bookInfo: {
            title: book.title,
            author: book.author,
            parsedAt: new Date().toISOString()
        },
        overview: {
            totalChapters: chapters.length,
            totalWords: book.totalWords,
            totalTextChunks: chapters.reduce((sum, ch) => sum + ch.content.chunks.length, 0),
            totalImageChunks: 0,
            totalChunks: chapters.reduce((sum, ch) => sum + ch.content.chunks.length, 0),
            averageWordsPerChapter: Math.round(book.totalWords / chapters.length),
            averageChunksPerChapter: Math.round(chapters.reduce((sum, ch) => sum + ch.content.chunks.length, 0) / chapters.length)
        },
        chapters: chapterSummaries
    };
    
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📊 Parser summary saved to: ${summaryPath}`);
    
    console.log('\n📊 PARSER SUMMARY:');
    console.log('='.repeat(80));
    console.log(`📖 Book: "${book.title}" by ${book.author}`);
    console.log(`📚 Total Chapters: ${chapters.length}`);
    console.log(`📝 Total Words: ${book.totalWords.toLocaleString()}`);
    console.log(`🧩 Total Chunks: ${summary.overview.totalChunks.toLocaleString()}`);
    console.log('='.repeat(80));
    console.log('📚 CHAPTER BREAKDOWN:');
    
    chapterSummaries.forEach(ch => {
        const chNum = String(ch.chapterNumber).padStart(2);
        const words = String(ch.wordCount).padStart(6);
        const chunks = String(ch.totalChunks).padStart(4);
        const title = ch.chapterName.length > 50 ? 
            ch.chapterName.substring(0, 47) + '...' : ch.chapterName;
        
        console.log(`${chNum}. ${title.padEnd(50)} ${words}w ${chunks}c`);
        
        if (ch.sections && ch.sections.length > 0) {
            ch.sections.forEach(section => {
                console.log(`    - ${section.title}`);
            });
        }
    });
    console.log('='.repeat(80));
}

/**
 * Main function
 */
async function main() {
    try {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log(`
Usage: node parse-text-book.js [OUTPUT_PATH]

Arguments:
  OUTPUT_PATH  Output JSON file path (optional, defaults to output-text-files/output.json)

This script parses the full-book.txt file using the TOC structure to create 3 chapters
with their sub-sections as defined in the table of contents.
            `);
            process.exit(1);
        }
        
        const outputPath = args[0] || path.join(__dirname, '../output-text-files/output.json');
        const fullBookPath = path.join(__dirname, '../output-text-files/full-book.txt');
        const tocPath = path.join(__dirname, '../output-text-files/TOC.txt');
        
        // Check if files exist
        if (!fs.existsSync(fullBookPath)) {
            console.error(`❌ Full book file not found: ${fullBookPath}`);
            process.exit(1);
        }
        
        if (!fs.existsSync(tocPath)) {
            console.error(`❌ TOC file not found: ${tocPath}`);
            process.exit(1);
        }
        
        console.log('🚀 Starting text book parsing...');
        console.log(`📁 Full Book: ${fullBookPath}`);
        console.log(`📑 TOC: ${tocPath}`);
        console.log(`📄 Output: ${outputPath}`);
        
        // Read files
        const fullText = fs.readFileSync(fullBookPath, 'utf-8');
        const tocContent = fs.readFileSync(tocPath, 'utf-8');
        
        // Parse TOC structure
        const tocStructure = parseTOC(tocContent);
        console.log(`📋 Parsed ${tocStructure.length} chapters from TOC`);
        
        // Split book into chapters
        const chapters = splitBookIntoChapters(fullText, tocStructure);
        console.log(`📚 Split book into ${chapters.length} chapters`);
        
        // Convert to database format
        const dbChapters = convertChaptersToDbFormat(chapters);
        
        // Generate book metadata
        const book = generateBookMetadata(dbChapters);
        
        // Save to file
        saveToFile(book, dbChapters, outputPath);
        
        console.log('✅ Text book parsed and saved successfully!');
        console.log(`📖 Title: "${book.title}"`);
        console.log(`👤 Author: ${book.author}`);
        console.log(`📚 Chapters: ${dbChapters.length}`);
        console.log(`📝 Total words: ${book.totalWords.toLocaleString()}`);
        console.log(`📄 Output file: ${outputPath}`);
        
    } catch (error) {
        console.error('❌ Error parsing text book:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    chunkText,
    parseTOC,
    splitBookIntoChapters,
    convertChaptersToDbFormat,
    generateBookMetadata
}; 