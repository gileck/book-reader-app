const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { MongoClient, ObjectId } = require('mongodb');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { execSync } = require('child_process');

// Load book configurations (now optional)
function loadBookConfig(configPath) {
    // If no config path provided, return defaults
    if (!configPath) {
        console.log('No config file provided, using defaults');
        return getDefaultConfig();
    }

    if (!fs.existsSync(configPath)) {
        console.log(`Config file not found: ${configPath}, using defaults`);
        return getDefaultConfig();
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('Loaded config file successfully');

        // Merge with defaults
        return {
            ...getDefaultConfig(),
            ...config,
            metadata: { ...getDefaultConfig().metadata, ...(config.metadata || {}) }
        };
    } catch (error) {
        console.log(`Error reading config file: ${error.message}, using defaults`);
        return getDefaultConfig();
    }
}

function getDefaultConfig() {
    return {
        chapterNames: [],
        chapterPatterns: [
            "^chapter\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\b",
            "^(\\d+)\\.\\s+([A-Za-z][a-zA-Z\\s]{8,40})$",
            "^(introduction|conclusion|epilogue|prologue|preface|foreword|afterword)$",
            "^[A-Z\\s]{5,30}$"
        ],
        excludePatterns: [
            "^(appendix|bibliography|index|notes|references|acknowledgements|about the author|glossary)$"
        ],
        skipFrontMatter: true,
        chapterNumbering: "sequential",
        metadata: { title: null, author: null }
    };
}

/**
 * Extract embedded images from PDF and save to local folder
 */
async function extractImages(pdfPath, bookTitle, bookFolderPath) {
    console.log('🖼️  Extracting embedded images from PDF...');

    // Create images directory in the book folder
    const bookFolderName = bookTitle.replace(/[^a-zA-Z0-9]/g, '-');
    const imagesDir = path.join(bookFolderPath, 'images', bookFolderName);
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log(`📁 Created images directory: ${imagesDir}`);
    }

    const images = [];

    // Step 1: Use PDF.js to detect which pages have images and how many
    console.log('   🔍 Scanning pages for image locations...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;

    const pageImageMap = []; // Array of { pageNumber, imageCount }
    let totalImagesDetected = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
            const page = await pdf.getPage(pageNum);
            const operatorList = await page.getOperatorList();

            let imageCount = 0;
            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const fn = operatorList.fnArray[i];
                if (fn === pdfjsLib.OPS.paintImageXObject) {
                    imageCount++;
                }
            }

            if (imageCount > 0) {
                pageImageMap.push({ pageNumber: pageNum, imageCount });
                totalImagesDetected += imageCount;
                console.log(`     📄 Page ${pageNum}: ${imageCount} image(s)`);
            }
        } catch (pageError) {
            console.log(`     ⚠️ Error scanning page ${pageNum}: ${pageError.message}`);
        }
    }

    console.log(`   📊 Detected ${totalImagesDetected} images across ${pageImageMap.length} pages`);

    try {
        // Step 2: Extract actual images using pdfimages
        const tempDir = path.join(__dirname, '../temp/pdfimages-temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        console.log('   🔧 Extracting embedded images using pdfimages...');
        const tempPrefix = path.join(tempDir, 'image');
        execSync(`pdfimages -all "${pdfPath}" "${tempPrefix}"`, { stdio: 'inherit' });

        // Get list of extracted files
        const extractedFiles = fs.readdirSync(tempDir).filter(file =>
            file.startsWith('image') && /\.(jpg|jpeg|png|ppm|pbm)$/i.test(file)
        );

        console.log(`   📊 Extracted ${extractedFiles.length} image files`);

        // Step 3: Correlate extracted images with page locations
        if (extractedFiles.length === totalImagesDetected) {
            console.log('   ✅ Perfect match: extracted files = detected images');

            let imageFileIndex = 0;
            let globalImageCounter = 1;

            // Go through pages in order and assign extracted images
            for (const pageInfo of pageImageMap) {
                for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                    if (imageFileIndex < extractedFiles.length) {
                        const file = extractedFiles[imageFileIndex];
                        const tempFilePath = path.join(tempDir, file);
                        const finalFileName = `page-${String(pageInfo.pageNumber).padStart(3, '0')}-image-${pageImageIndex + 1}.jpg`;
                        const finalFilePath = path.join(imagesDir, finalFileName);

                        // Copy file to final location
                        fs.copyFileSync(tempFilePath, finalFilePath);

                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: finalFileName,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber})`,
                            originalName: file,
                            extracted: true
                        });

                        console.log(`     ✅ Page ${pageInfo.pageNumber}: ${finalFileName}`);
                        imageFileIndex++;
                        globalImageCounter++;
                    }
                }
            }
        } else {
            console.log(`   ⚠️ Mismatch: extracted ${extractedFiles.length} files but detected ${totalImagesDetected} images`);
            console.log('   🔄 Using fallback approach...');

            // Fallback: distribute extracted images across detected pages proportionally
            let imageFileIndex = 0;
            let globalImageCounter = 1;

            for (const pageInfo of pageImageMap) {
                for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                    if (imageFileIndex < extractedFiles.length) {
                        const file = extractedFiles[imageFileIndex];
                        const tempFilePath = path.join(tempDir, file);
                        const finalFileName = `page-${String(pageInfo.pageNumber).padStart(3, '0')}-image-${pageImageIndex + 1}.jpg`;
                        const finalFilePath = path.join(imagesDir, finalFileName);

                        // Copy file to final location
                        fs.copyFileSync(tempFilePath, finalFilePath);

                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: finalFileName,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber})`,
                            originalName: file,
                            extracted: true
                        });

                        console.log(`     ✅ Page ${pageInfo.pageNumber}: ${finalFileName}`);
                        imageFileIndex++;
                        globalImageCounter++;
                    } else {
                        // Create placeholder for remaining detected images
                        images.push({
                            pageNumber: pageInfo.pageNumber,
                            imageName: `page-${pageInfo.pageNumber}-image-${pageImageIndex + 1}.placeholder`,
                            imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber}) - Not extracted`,
                            placeholder: true
                        });
                        globalImageCounter++;
                    }
                }
            }
        }

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true });

    } catch (error) {
        console.log(`     ❌ Error extracting images: ${error.message}`);
        console.log('   🔄 Using PDF.js detection only...');

        // Fallback to PDF.js detection with placeholders
        let globalImageCounter = 1;
        for (const pageInfo of pageImageMap) {
            for (let pageImageIndex = 0; pageImageIndex < pageInfo.imageCount; pageImageIndex++) {
                images.push({
                    pageNumber: pageInfo.pageNumber,
                    imageName: `page-${pageInfo.pageNumber}-image-${pageImageIndex + 1}.placeholder`,
                    imageAlt: `Figure ${globalImageCounter} (Page ${pageInfo.pageNumber}) - Detection only`,
                    placeholder: true
                });
                globalImageCounter++;
            }
        }
    }

    console.log(`✅ Processed ${images.length} images with correct page numbers`);

    // Return both images and folder information
    return {
        images,
        imagesFolderPath: `./images/${bookFolderName}`
    };
}

// Text chunking function (preserved from original)
function chunkText(text, minWords = 5, maxWords = 15) {
    // Split by sentence endings, but be smarter about abbreviations
    const sentences = [];
    let currentSentence = '';
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        currentSentence += (currentSentence ? ' ' : '') + word;
        
        // Check if this word ends a sentence
        if (/[.!?]+$/.test(word)) {
            // Don't split if it's a common abbreviation and next word is lowercase
            const nextWord = words[i + 1];
            const isAbbreviation = endsWithAbbreviation(currentSentence);
            const nextIsLowercase = nextWord && /^[a-z]/.test(nextWord);
            
            if (!isAbbreviation || !nextIsLowercase) {
                // This is a real sentence ending
                sentences.push(currentSentence.trim());
                currentSentence = '';
            }
        }
    }
    
    // Add any remaining text as a sentence
    if (currentSentence.trim()) {
        sentences.push(currentSentence.trim());
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
 * Clean page numbers from text - uses the observed pattern that book internal page numbers
 * are typically 1 less than the PDF page number (e.g., PDF page 10 contains book page "9")
 */
function cleanPageNumbers(text, pageNumber = null) {
    if (!pageNumber) {
        return text; // If no page number provided, don't clean anything
    }
    
    // Use the observed pattern: book page number = PDF page number - 1
    const bookPageNumber = pageNumber - 1;
    if (bookPageNumber >= 1) {
        const bookPageRegex = new RegExp(`^\\s*${bookPageNumber}\\s+`, '');
        if (bookPageRegex.test(text)) {
            text = text.replace(bookPageRegex, '');
        }
    }
    
    // Handle Roman numerals for front matter pages (i, ii, iii, etc.)
    // These usually appear in the first few pages where the pattern might not apply
    if (pageNumber <= 20) {
        const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];
        for (const roman of romanNumerals) {
            const romanRegex = new RegExp(`^\\s*${roman}\\s+`, 'i');
            if (romanRegex.test(text)) {
                // Only remove if what follows looks like content
                const afterRoman = text.replace(romanRegex, '');
                if (afterRoman.match(/^[A-Z]/) || afterRoman.match(/^(the|and|or|but|in|on|at|to|for|of|with|by)/i)) {
                    text = afterRoman;
                    break;
                }
            }
        }
    }
    
    return text;
}

/**
 * Chunk text with page information preserved
 */
function chunkTextWithPages(pages, minWords = 5, maxWords = 15) {
    const allChunks = [];
    let chunkIndex = 0;

    for (const page of pages) {
        const pageChunks = chunkText(page.text, minWords, maxWords);

        // Add page information to each chunk
        for (const chunk of pageChunks) {
            // Clean page numbers from beginning of chunks - pass the actual page number
            let cleanedText = cleanPageNumbers(chunk.text, page.pageNumber);
            
            allChunks.push({
                ...chunk,
                text: cleanedText,
                pageNumber: page.pageNumber,
                index: chunkIndex++
            });
        }
    }

    // Merge chunks where sentences are split across pages
    const mergedChunks = mergeSplitSentences(allChunks);

    return mergedChunks;
}

/**
 * Merge text chunks where sentences are split across page boundaries
 * This improves readability and TTS quality by keeping complete sentences together
 */
function mergeSplitSentences(chunks) {
    if (chunks.length === 0) return chunks;

    const mergedChunks = [];
    let i = 0;

    while (i < chunks.length) {
        const currentChunk = chunks[i];
        
        // Check if this chunk ends with an incomplete sentence (no proper sentence ending)
        // and the next chunk is from a different page
        if (i < chunks.length - 1) {
            const nextChunk = chunks[i + 1];
            
            // Only merge if chunks are from consecutive pages
            if (nextChunk.pageNumber === currentChunk.pageNumber + 1) {
                const shouldMerge = shouldMergeSentence(currentChunk.text, nextChunk.text);
                
                if (shouldMerge) {
                    // Find where the sentence ends in the next chunk
                    const sentenceEndMatch = nextChunk.text.match(/^([^.!?]*[.!?])\s*(.*)/);
                    
                    if (sentenceEndMatch) {
                        const sentenceEnd = sentenceEndMatch[1];
                        const remainingText = sentenceEndMatch[2].trim();
                        
                        // Create merged chunk with complete sentence
                        const mergedText = currentChunk.text + ' ' + sentenceEnd;
                        const mergedChunk = {
                            ...currentChunk,
                            text: mergedText,
                            wordCount: mergedText.split(/\s+/).filter(w => w.length > 0).length,
                            // Keep the original page number of where the sentence started
                            index: currentChunk.index
                        };
                        
                        mergedChunks.push(mergedChunk);
                        
                        // If there's remaining text in the next chunk, create a new chunk for it
                        if (remainingText.length > 0) {
                            const remainingChunk = {
                                ...nextChunk,
                                text: remainingText,
                                wordCount: remainingText.split(/\s+/).filter(w => w.length > 0).length,
                                index: nextChunk.index
                            };
                            mergedChunks.push(remainingChunk);
                        }
                        
                        console.log(`🔗 Merged split sentence across pages ${currentChunk.pageNumber}-${nextChunk.pageNumber}`);
                        i += 2; // Skip both chunks as they've been processed
                        continue;
                    }
                }
            }
        }
        
        // No merge needed, add chunk as-is
        mergedChunks.push(currentChunk);
        i++;
    }

    // Reindex the chunks
    mergedChunks.forEach((chunk, index) => {
        chunk.index = index;
    });

    return mergedChunks;
}

/**
 * List of common abbreviations that end with periods but don't end sentences
 */
const COMMON_ABBREVIATIONS = [
    'Ph.D', 'M.D', 'Ph.D.', 'M.D.', 'B.A', 'B.A.', 'M.A', 'M.A.', 
    'B.S', 'B.S.', 'M.S', 'M.S.', 'U.S', 'U.S.', 'U.K', 'U.K.',
    'Dr', 'Dr.', 'Mr', 'Mr.', 'Mrs', 'Mrs.', 'Ms', 'Ms.',
    'Prof', 'Prof.', 'vs', 'vs.', 'etc', 'etc.', 'i.e', 'i.e.',
    'e.g', 'e.g.', 'Inc', 'Inc.', 'Co', 'Co.', 'Corp', 'Corp.',
    'Ltd', 'Ltd.', 'St', 'St.', 'Ave', 'Ave.', 'Blvd', 'Blvd.'
];

/**
 * Check if text ends with a common abbreviation
 */
function endsWithAbbreviation(text) {
    const trimmed = text.trim();
    return COMMON_ABBREVIATIONS.some(abbrev => 
        trimmed.toLowerCase().endsWith(abbrev.toLowerCase())
    );
}

/**
 * Fix spaced first letter issue (e.g., "O   nce upon a time" -> "Once upon a time")
 */
function fixSpacedFirstLetter(text) {
    // Look for pattern: single capital letter followed by one or more spaces and lowercase letter
    // This handles PDF formatting artifacts where the first letter is separated
    return text.replace(/^([A-Z])\s+([a-z])/, '$1$2');
}

/**
 * Clean chapter heading from the beginning of text
 * Handles various patterns like "INTRODUCTION LIFE ITSELF", "1 DISCOVERING THE NANOCOSM", etc.
 */
function cleanChapterHeading(text, chapterTitle, chapterNumber) {
    let cleanedText = text;
    
    // Step 1: Remove ":" from chapter name and normalize it to uppercase
    const normalizedChapterTitle = chapterTitle.replace(/[:\?]/g, '').toUpperCase();
    
    // Step 2: Normalize the text to uppercase for comparison
    const normalizedText = text.toUpperCase();
    
    // Step 3: Find and remove ONLY the normalized chapter name from the text
    const chapterIndex = normalizedText.indexOf(normalizedChapterTitle);
    if (chapterIndex !== -1 && chapterIndex < 200) { // Only look in first 200 chars
        // Remove ONLY the chapter title, keeping everything before and after
        const beforeChapter = text.substring(0, chapterIndex);
        const afterChapter = text.substring(chapterIndex + normalizedChapterTitle.length);
        
        // Combine before + after, removing the chapter heading
        const combined = (beforeChapter + afterChapter).trim();
        
        if (combined.length > 10) { // Make sure we don't remove too much
            // Step 4: Remove extra spaces ONLY at the very beginning (fix split words like "I n" → "In")
            cleanedText = combined
                .replace(/^([A-Za-z])\s+([a-z])/, '$1$2') // Fix split words only at the beginning
                .trim();
            
            console.log(`✂️  Removed chapter heading "${normalizedChapterTitle}" from text`);
        }
    }
    
    return cleanedText;
}

/**
 * Determine if two text chunks should be merged because they contain a split sentence
 * Uses simple character-based detection: last char + first char analysis
 */
function shouldMergeSentence(firstText, secondText) {
    const first = firstText.trim();
    const second = secondText.trim();
    
    if (first.length === 0 || second.length === 0) return false;
    
    const lastChar = first.slice(-1);
    const firstChar = second.charAt(0);
    
    // Core logic: not sentence ending + lowercase start
    const notSentenceEnding = !/[.!?;:]$/.test(lastChar);
    const startsWithLowercase = /[a-z]/.test(firstChar);
    
    if (notSentenceEnding && startsWithLowercase) {
        return true;
    }
    
    // Enhancement: handle common abbreviations
    // If ends with period but might be abbreviation (like "U.S. government")
    if (lastChar === '.' && startsWithLowercase) {
        // Check if it's likely an abbreviation (short word before period)
        const beforePeriod = first.match(/\b(\w{1,3})\.$$/);
        if (beforePeriod && beforePeriod[1].length <= 3) {
            return true; // Likely abbreviation, merge
        }
        
        // Also check against our hardcoded list
        if (endsWithAbbreviation(first)) {
            return true;
        }
    }
    
    return false;
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

// TOC Extraction Functions
async function extractTOCFromPdf(pdfPath) {
    try {
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const doc = await pdfjsLib.getDocument(data).promise;

        console.log(`PDF has ${doc.numPages} pages`);

        // Check for PDF bookmarks/outlines first
        const outline = await doc.getOutline();
        if (outline && outline.length > 0) {
            console.log('Found PDF bookmarks/outline, extracting chapters...');
            const chapters = await extractBookmarks(outline, doc);
            return {
                source: 'pdf_bookmarks',
                chapters: chapters
            };
        }

        // If no bookmarks, search for TOC pages
        console.log('No PDF bookmarks found, searching for TOC pages...');

        const tocPages = [];
        const searchTerms = ['contents', 'table of contents', 'index'];

        // Search first 20 pages for TOC
        const pagesToSearch = Math.min(20, doc.numPages);

        for (let i = 1; i <= pagesToSearch; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ').toLowerCase();

            // Check if page contains TOC indicators
            const hasTOC = searchTerms.some(term => pageText.includes(term));
            if (hasTOC) {
                console.log(`Found potential TOC on page ${i}`);
                tocPages.push({
                    pageNum: i,
                    textItems: textContent.items
                });
            }
        }

        if (tocPages.length === 0) {
            console.log('No TOC pages found');
            return null;
        }

        // Parse TOC structure from found pages
        const allChapters = [];

        for (const tocPage of tocPages) {
            console.log(`Parsing TOC from page ${tocPage.pageNum}:`);
            const tocEntries = parseTOCEntries(tocPage.textItems);
            allChapters.push(...tocEntries);
        }

        return {
            source: 'text_parsing',
            chapters: allChapters
        };

    } catch (error) {
        console.error('Error extracting TOC:', error);
        return null;
    }
}

async function extractBookmarks(outline, doc, level = 0) {
    const chapters = [];

    for (const item of outline) {
        // Skip non-chapter items like "Contents"
        if (item.title.toLowerCase() === 'contents') {
            continue;
        }

        const chapter = parseChapterFromBookmark(item.title);
        if (chapter) {
            // Try to get page number from destination
            if (item.dest) {
                try {
                    const pageNum = await getPageNumberFromDest(item.dest, doc);
                    chapter.startingPage = pageNum;
                } catch (error) {
                    console.log(`Could not get page number for "${item.title}": ${error.message}`);
                }
            }
            chapters.push(chapter);
        }

        if (item.items && item.items.length > 0) {
            const subChapters = await extractBookmarks(item.items, doc, level + 1);
            chapters.push(...subChapters);
        }
    }

    return chapters;
}

async function getPageNumberFromDest(dest, doc) {
    try {
        // dest is usually an array where the first element contains page reference
        if (Array.isArray(dest) && dest.length > 0) {
            const pageRef = dest[0];
            if (pageRef && typeof pageRef === 'object' && pageRef.num !== undefined) {
                // Get page index from reference
                const pageIndex = await doc.getPageIndex(pageRef);
                return pageIndex + 1; // Convert 0-based to 1-based page number
            }
        }
    } catch (error) {
        throw new Error(`Failed to resolve page reference: ${error.message}`);
    }
    return null;
}

function parseChapterFromBookmark(title) {
    // Remove leading/trailing whitespace
    title = title.trim();

    // Pattern for numbered chapters: "1. Title" or "1 Title"
    const numberedChapterMatch = title.match(/^(\d+)\.?\s+(.+)$/);
    if (numberedChapterMatch) {
        return {
            chapterNumber: parseInt(numberedChapterMatch[1]),
            chapterTitle: numberedChapterMatch[2].trim(),
            startingPage: null, // Will be filled if we can extract from dest
            originalTitle: title
        };
    }

    // Pattern for word-numbered chapters: "Chapter One:", "Chapter Two:", etc.
    const wordNumberedChapterMatch = title.match(/^Chapter\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty)[:]\s*(.+)$/i);
    if (wordNumberedChapterMatch) {
        const wordToNumber = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20
        };
        const chapterNum = wordToNumber[wordNumberedChapterMatch[1].toLowerCase()];
        return {
            chapterNumber: chapterNum,
            chapterTitle: title, // Keep full title
            startingPage: null,
            originalTitle: title
        };
    }

    // Pattern for introduction or other special chapters
    if (title.toLowerCase().includes('introduction')) {
        return {
            chapterNumber: 0, // or null for Introduction
            chapterTitle: title,
            startingPage: null,
            originalTitle: title
        };
    }

    // Pattern for appendices: "Appendix 1", "Appendix A", etc.
    const appendixMatch = title.match(/^Appendix\s+([A-Z0-9]+)/i);
    if (appendixMatch) {
        return {
            chapterNumber: `Appendix ${appendixMatch[1]}`,
            chapterTitle: title,
            startingPage: null,
            originalTitle: title
        };
    }

    // Pattern for epilogue
    if (title.toLowerCase().includes('epilogue')) {
        return {
            chapterNumber: 'Epilogue',
            chapterTitle: title,
            startingPage: null,
            originalTitle: title
        };
    }

    // Other sections (Acknowledgments, Bibliography, Notes, Index)
    const otherSections = ['acknowledgments', 'bibliography', 'notes', 'index'];
    if (otherSections.some(section => title.toLowerCase().includes(section))) {
        return {
            chapterNumber: null,
            chapterTitle: title,
            startingPage: null,
            originalTitle: title
        };
    }

    // Generic fallback: return any remaining title as a potential chapter
    return {
        chapterNumber: null,
        chapterTitle: title,
        startingPage: null,
        originalTitle: title
    };
}

function parseTOCEntries(textItems) {
    const entries = [];
    let currentLine = '';
    let currentY = null;

    // Group text items by line (same Y coordinate)
    const lines = [];

    for (const item of textItems) {
        const y = Math.round(item.transform[5]); // Y coordinate

        if (currentY === null || Math.abs(y - currentY) > 5) {
            // New line
            if (currentLine.trim()) {
                lines.push({
                    text: currentLine.trim(),
                    y: currentY
                });
            }
            currentLine = item.str;
            currentY = y;
        } else {
            // Same line
            currentLine += item.str;
        }
    }

    // Add last line
    if (currentLine.trim()) {
        lines.push({
            text: currentLine.trim(),
            y: currentY
        });
    }

    // Parse each line for TOC patterns
    for (const line of lines) {
        const tocEntry = parseTOCLine(line.text);
        if (tocEntry) {
            entries.push(tocEntry);
        }
    }

    return entries;
}

function parseTOCLine(text) {
    // Skip common non-TOC text
    const skipPatterns = [
        /^contents?$/i,
        /^table of contents$/i,
        /^page$/i,
        /^chapter$/i
    ];

    if (skipPatterns.some(pattern => pattern.test(text.trim()))) {
        return null;
    }

    // Look for patterns like:
    // "1. The Search for Emotion's "Fingerprints" 1"
    // "Introduction: The Two-Thousand-Year-Old Assumption ix"
    // "Appendix A: Brain Basics 302"

    const patterns = [
        // Numbered chapter: "1. Title 25" or "1 Title 25"
        /^(\d+)\.?\s+(.+?)\s+(\d+)$/,
        // Introduction or special chapters: "Introduction: Title ix" or "Introduction: Title 25"
        /^(Introduction[:\s]*.*?)\s+([ivx]+|\d+)$/i,
        // Appendix: "Appendix A: Title 302"
        /^(Appendix\s+[A-Z][:\s]*.*?)\s+(\d+)$/i,
        // Other sections: "Acknowledgments 293", "Bibliography 321"
        /^([A-Za-z\s]+)\s+(\d+)$/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const titlePart = match[1].trim();
            const pagePart = match[2];

            // Parse chapter number and title
            let chapterNumber = null;
            let chapterTitle = titlePart;

            // Extract chapter number if it's a numbered chapter
            const numberedMatch = titlePart.match(/^(\d+)\.?\s*(.*)$/);
            if (numberedMatch) {
                chapterNumber = parseInt(numberedMatch[1]);
                chapterTitle = numberedMatch[2].trim();
            } else if (titlePart.toLowerCase().includes('introduction')) {
                chapterNumber = 0;
            } else if (titlePart.toLowerCase().includes('appendix')) {
                const appendixMatch = titlePart.match(/appendix\s+([A-Z])/i);
                if (appendixMatch) {
                    chapterNumber = `Appendix ${appendixMatch[1]}`;
                }
            }

            return {
                chapterNumber: chapterNumber,
                chapterTitle: chapterTitle,
                startingPage: isNaN(parseInt(pagePart)) ? pagePart : parseInt(pagePart),
                originalText: text
            };
        }
    }

    return null;
}

// Extract chapter content using TOC data
async function extractChapterContentFromTOC(tocChapters, fullText, pdfPath, config = null) {
    try {
        // Filter out non-content chapters (appendix, bibliography, etc.)
        const contentChapters = tocChapters.filter(ch => {
            if (!ch.startingPage) return false;

            // Original numeric chapter logic (preserve existing functionality)
            if ((typeof ch.chapterNumber === 'number' && ch.chapterNumber >= 0) ||
                ch.chapterNumber === 'Epilogue' ||
                (typeof ch.chapterNumber === 'string' && ch.chapterNumber.toLowerCase().includes('epilogue'))) {
                return true;
            }

            // NEW: If config has chapterNames, also include chapters that match those names
            if (config && config.chapterNames && config.chapterNames.length > 0) {
                return config.chapterNames.some(configName =>
                    ch.chapterTitle === configName ||
                    ch.chapterTitle.includes(configName) ||
                    configName.includes(ch.chapterTitle)
                );
            }

            return false;
        });

        if (contentChapters.length === 0) {
            console.log('No content chapters found in TOC');
            return null;
        }

        console.log(`Extracting content for ${contentChapters.length} chapters using page-based extraction`);

        // Use pdfjs to extract text page by page for precise chapter boundaries
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const doc = await pdfjsLib.getDocument(data).promise;

        const chapters = [];

        for (let i = 0; i < contentChapters.length; i++) {
            const currentChapter = contentChapters[i];
            const nextChapter = contentChapters[i + 1];

            const startPage = currentChapter.startingPage;
            const endPage = nextChapter ? nextChapter.startingPage - 1 : doc.numPages;

            console.log(`Extracting "${currentChapter.chapterTitle}" from pages ${startPage} to ${endPage}`);

            const chapterPages = [];

            // Extract text from pages for this chapter, preserving page information
            for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
                try {
                    const page = await doc.getPage(pageNum);
                    const textContent = await page.getTextContent();

                    // Combine text items from the page
                    let pageText = textContent.items
                        .map(item => item.str)
                        .join(' ')
                        .trim();

                    // Clean page number from beginning of page text - pass the actual page number
                    pageText = cleanPageNumbers(pageText, pageNum);

                    if (pageText.length > 50) { // Only include pages with substantial content
                        chapterPages.push({
                            pageNumber: pageNum,
                            text: pageText
                        });
                    }
                } catch (error) {
                    console.log(`Error extracting page ${pageNum}: ${error.message}`);
                }
            }

            if (chapterPages.length > 0) {
                // Combine all page text for content lines (for backward compatibility)
                const combinedContent = chapterPages.map(p => p.text).join(' ')
                    // Clean up the text
                    .replace(/\s+/g, ' ')
                    .trim();

                // Split into reasonable chunks/paragraphs for content array
                const contentLines = combinedContent
                    .split(/[.!?]+\s+/)
                    .filter(line => line.trim().length > 20)
                    .map(line => line.trim() + (line.endsWith('.') ? '' : '.'));

                // Assign sequential chapter numbers when using config-based extraction
                const assignedChapterNumber = (config && config.chapterNames && config.chapterNames.length > 0)
                    ? i + 1  // Sequential numbering for config-based chapters
                    : currentChapter.chapterNumber; // Preserve original for TOC-only extraction

                chapters.push({
                    chapterNumber: assignedChapterNumber,
                    title: currentChapter.chapterTitle,
                    content: contentLines,
                    pages: chapterPages, // Add page-by-page data
                    startingPage: startPage,
                    endingPage: endPage
                });

                // console.log(`✅ Extracted ${contentLines.length} content segments for "${currentChapter.chapterTitle}"`);
            } else {
                console.log(`⚠️ No content found for "${currentChapter.chapterTitle}"`);
            }
        }

        return chapters.length > 0 ? chapters : null;

    } catch (error) {
        console.error('Error extracting chapter content from TOC:', error);
        return null;
    }
}

// Generic chapter detection function with TOC support
async function detectChapters(text, config, pdfPath = null) {
    // Try TOC extraction first if PDF path is provided
    if (pdfPath) {
        console.log('🔍 Attempting TOC extraction...');
        const tocData = await extractTOCFromPdf(pdfPath);

        // add tocData to debug file (only in debug mode)
        if (process.env.DEBUG_TEXT || process.argv.includes('--debug') || process.argv.includes('-d')) {
            const debugFolder = path.join(path.dirname(pdfPath), 'debug');
            if (!fs.existsSync(debugFolder)) {
                fs.mkdirSync(debugFolder, { recursive: true });
            }
            fs.writeFileSync(path.join(debugFolder, 'tocData.json'), JSON.stringify(tocData, null, 2), 'utf8');
        }

        if (tocData && tocData.chapters && tocData.chapters.length > 0) {
            console.log(`✅ Found ${tocData.chapters.length} chapters via ${tocData.source}`);

            // Extract chapter content using TOC data and full text
            const chapters = await extractChapterContentFromTOC(tocData.chapters, text, pdfPath, config);

            if (chapters && chapters.length > 0) {
                console.log(`✅ Successfully extracted content for ${chapters.length} chapters using TOC`);
                return chapters;
            } else {
                console.log('⚠️ TOC found but failed to extract content, falling back to text-based detection');
            }
        } else {
            console.log('⚠️ No TOC found, falling back to text-based chapter detection');
        }
    }

    // Fallback to original text-based detection
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

            // Also check for multi-line titles (title split across consecutive lines)
            if (i < lines.length - 1) {
                const nextLine = lines[i + 1];
                const combinedLine = line + ' ' + nextLine;

                const multiLineMatchingTitle = config.chapterNames.find(title => fuzzyMatch(combinedLine, title));

                if (multiLineMatchingTitle) {
                    if (!allChapterOccurrences[multiLineMatchingTitle]) {
                        allChapterOccurrences[multiLineMatchingTitle] = [];
                    }
                    allChapterOccurrences[multiLineMatchingTitle].push({
                        line: multiLineMatchingTitle,
                        index: i,
                        originalLine: combinedLine.trim(),
                        isMultiLine: true
                    });

                    if (process.env.DEBUG_TEXT) {
                        console.log(`DEBUG: Found multi-line occurrence of "${multiLineMatchingTitle}" at line ${i}: "${combinedLine.trim()}"`);
                    }
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

        const dbChunks = ttsChunks.map((chunk, index) => {
            let text = chunk.text;

            // Clean the first chunk by removing chapter title
            if (index === 0) {
                const titleToRemove = chapter.title;
                const chapterNum = chapter.chapterNumber;

                // Try multiple patterns:
                // 1. "1 The Search for Emotion's "Fingerprints" O nce upon..."
                // 2. "Introduction: The Two-Thousand-Year-Old Assumption O n December..."
                const patterns = [];

                if (typeof chapterNum === 'number') {
                    // For numbered chapters: try "1 Title" pattern
                    patterns.push(`${chapterNum} ${titleToRemove}`);
                }
                // Also try just the title
                patterns.push(titleToRemove);

                for (const pattern of patterns) {
                    if (text.startsWith(pattern)) {
                        const cleaned = text.substring(pattern.length).trim();
                        if (cleaned.length > 10) { // Make sure we don't remove too much
                            text = cleaned;
                            console.log(`✂️  Removed "${pattern}" from first chunk of "${chapter.title}"`);
                            break;
                        }
                    }
                }
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
            wordCount: totalWords
        };
    });
}

/**
 * Create unified chunks with text and images, maintaining page correlation
 */
function createPageAwareChunksWithImages(chapters, images) {
    console.log('🔗 Creating page-aware chunks with images...');

    // Create a map of images by page for quick lookup
    const imagesByPage = {};
    images.forEach(image => {
        if (!imagesByPage[image.pageNumber]) {
            imagesByPage[image.pageNumber] = [];
        }
        imagesByPage[image.pageNumber].push(image);
    });

    // Process each chapter
    const enhancedChapters = chapters.map(chapter => {
        const allChunks = [];
        let chunkIndex = 0;

        // Use page-aware chunking if pages data is available
        if (chapter.pages && chapter.pages.length > 0) {
            console.log(`📄 Using page-aware chunking for "${chapter.title}"`);

            // Get text chunks with page information
            const pageAwareChunks = chunkTextWithPages(chapter.pages);

            // Group chunks by page
            const chunksByPage = {};
            pageAwareChunks.forEach(chunk => {
                if (!chunksByPage[chunk.pageNumber]) {
                    chunksByPage[chunk.pageNumber] = [];
                }
                chunksByPage[chunk.pageNumber].push(chunk);
            });

            // Process each page in order
            const pageNumbers = Object.keys(chunksByPage).map(p => parseInt(p)).sort((a, b) => a - b);

            for (const pageNum of pageNumbers) {
                const pageChunks = chunksByPage[pageNum];

                // Add text chunks for this page
                pageChunks.forEach((chunk, index) => {
                    let text = chunk.text;

                    // Clean page numbers from beginning of text - pass the actual page number
                    text = cleanPageNumbers(text, chunk.pageNumber);

                                    // Clean the first chunk of the first page by removing chapter title
                if (pageNum === pageNumbers[0] && index === 0) {
                    text = cleanChapterHeading(text, chapter.title, chapter.chapterNumber);
                }
                
                // Fix spaced first letter issue (e.g., "O   nce upon a time")
                text = fixSpacedFirstLetter(text);

                    allChunks.push({
                        index: chunkIndex++,
                        text: text,
                        wordCount: chunk.words.length,
                        type: 'text',
                        pageNumber: chunk.pageNumber
                    });
                });

                // Add images for this page at the end of the page
                const pageImages = imagesByPage[pageNum] || [];
                pageImages.forEach(image => {
                    allChunks.push({
                        index: chunkIndex++,
                        text: "",
                        wordCount: 0,
                        type: 'image',
                        pageNumber: image.pageNumber,
                        imageName: image.imageName,
                        imageAlt: image.imageAlt
                    });
                });

                if (pageImages.length > 0) {
                    console.log(`📸 Added ${pageImages.length} image(s) to page ${pageNum} of "${chapter.title}"`);
                }
            }
        } else {
            // Fallback to original chunking for chapters without page data
            console.log(`📄 Using fallback chunking for "${chapter.title}"`);

            const chapterText = chapter.content.join(' ');
            const textChunks = chunkText(chapterText);

            // Convert text chunks
            textChunks.forEach((chunk, index) => {
                let text = chunk.text;
                
                // Note: In fallback mode we don't have individual page numbers for chunks,
                // so we skip page number cleaning to avoid removing legitimate content numbers

                // Clean the first chunk by removing chapter title
                if (index === 0) {
                    text = cleanChapterHeading(text, chapter.title, chapter.chapterNumber);
                }
                
                // Fix spaced first letter issue (e.g., "O   nce upon a time")
                text = fixSpacedFirstLetter(text);

                allChunks.push({
                    index: chunkIndex++,
                    text: text,
                    wordCount: chunk.words.length,
                    type: 'text'
                });
            });

            // Add images that belong to this chapter based on page ranges (fallback)
            let addedImages = 0;
            if (chapter.startingPage && chapter.endingPage) {
                images.forEach(image => {
                    const imagePage = image.pageNumber;
                    if (imagePage >= chapter.startingPage && imagePage <= chapter.endingPage) {
                        allChunks.push({
                            index: chunkIndex++,
                            text: "",
                            wordCount: 0,
                            type: 'image',
                            pageNumber: image.pageNumber,
                            imageName: image.imageName,
                            imageAlt: image.imageAlt
                        });
                        addedImages++;
                    }
                });

                if (addedImages > 0) {
                    console.log(`📸 Added ${addedImages} images to chapter ${chapter.chapterNumber} "${chapter.title}" (fallback)`);
                }
            }
        }

        const totalWords = allChunks
            .filter(chunk => chunk.type === 'text')
            .reduce((sum, chunk) => sum + chunk.wordCount, 0);

        return {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            content: {
                chunks: allChunks
            },
            wordCount: totalWords
        };
    });

    const textCount = enhancedChapters.reduce((sum, ch) =>
        sum + ch.content.chunks.filter(c => c.type === 'text').length, 0);
    const imageCount = enhancedChapters.reduce((sum, ch) =>
        sum + ch.content.chunks.filter(c => c.type === 'image').length, 0);

    console.log(`✅ Created chapters with ${textCount} text chunks and ${imageCount} image chunks`);
    return enhancedChapters;
}

// Main parsing function
async function parsePdfBook(pdfPath, configPath, debugMode = false) {
    console.log(`Parsing PDF: ${pdfPath}`);
    console.log(`Using config: ${configPath}`);
    if (debugMode) console.log(`🐛 Debug mode enabled`);

    const config = loadBookConfig(configPath);

    // Read and parse PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);

    console.log(`Extracted ${pdfData.numpages} pages, ${pdfData.text.length} characters`);

    // Debug: Save pdfData
    if (debugMode) {
        const debugFolder = path.join(path.dirname(pdfPath), 'debug');
        if (!fs.existsSync(debugFolder)) {
            fs.mkdirSync(debugFolder, { recursive: true });
        }

        // 1. Raw pdfData from pdfParse - split into text and others
        fs.writeFileSync(path.join(debugFolder, '1-pdfData-text.txt'), pdfData.text || '');

        const { text, ...pdfDataOthers } = pdfData;
        fs.writeFileSync(path.join(debugFolder, '1-pdfData-others.json'), JSON.stringify(pdfDataOthers, null, 2));

        // 4. Raw result of pdfjsLib.getDocument
        const doc = await pdfjsLib.getDocument(pdfBuffer).promise;
        const docInfo = {
            numPages: doc.numPages,
            fingerprint: doc.fingerprint,
            _pdfInfo: doc._pdfInfo
        };
        fs.writeFileSync(path.join(debugFolder, '4-raw-pdfjsDocument.json'), JSON.stringify(docInfo, null, 2));

        // 5. Raw outline content
        const outline = await doc.getOutline();
        fs.writeFileSync(path.join(debugFolder, '5-raw-outline.json'), JSON.stringify(outline, null, 2));

        console.log(`🐛 Debug files saved to: ${debugFolder}`);
    }

    // Extract metadata
    const filename = path.basename(pdfPath);
    const bookMetadata = extractBookMetadata(pdfData, filename, config);

    // Debug: Save bookMetadata
    if (debugMode) {
        const debugFolder = path.join(path.dirname(pdfPath), 'debug');
        fs.writeFileSync(path.join(debugFolder, '2-raw-bookMetadata.json'), JSON.stringify(bookMetadata, null, 2));
    }

    // Detect chapters (now supports TOC extraction)
    const chapters = await detectChapters(pdfData.text, config, pdfPath);

    // Debug: Log chapter structure before saving
    if (debugMode && chapters && chapters.length > 0) {
        console.log(`🐛 DEBUG: First chapter has pages field: ${!!chapters[0].pages}`);
        if (chapters[0].pages) {
            console.log(`🐛 DEBUG: First chapter has ${chapters[0].pages.length} pages`);
        }
    }

    // Debug: Save chapters
    if (debugMode) {
        const debugFolder = path.join(path.dirname(pdfPath), 'debug');
        fs.writeFileSync(path.join(debugFolder, '3-raw-chapters.json'), JSON.stringify(chapters, null, 2));
    }
    console.log(`Detected ${chapters.length} chapters`);

    // Extract images from PDF
    const bookFolderPath = path.dirname(pdfPath);
    const { images, imagesFolderPath } = await extractImages(pdfPath, bookMetadata.title, bookFolderPath);

    // Convert to database format with image integration
    const dbChapters = createPageAwareChunksWithImages(chapters, images);

    // Calculate totals
    const totalWords = dbChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    const totalChapters = dbChapters.length;

    // Use first image as cover image
    const coverImage = images.length > 0 ? images[0].imageName : null;

    const book = {
        ...bookMetadata,
        totalChapters,
        totalWords,
        coverImage,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    return { book, chapters: dbChapters, imagesFolderPath };
}

// Save to file
function saveToFile(book, chapters, outputPath, imagesFolderPath) {
    const output = {
        book,
        chapters,
        metadata: {
            parsedAt: new Date().toISOString(),
            totalChapters: chapters.length,
            totalWords: book.totalWords,
            avgWordsPerChapter: Math.round(book.totalWords / chapters.length),
            hasImages: chapters.some(ch => ch.content.chunks.some(chunk => chunk.type === 'image')),
            totalImages: chapters.reduce((sum, ch) =>
                sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0),
            imagesFolderPath: imagesFolderPath || null
        }
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`📄 Output saved to: ${outputPath}`);

    // Generate parser summary file automatically
    const outputDir = path.dirname(outputPath);
    const summaryPath = path.join(outputDir, 'parser-summary.json');
    generateParserSummary(book, chapters, summaryPath);
}

// Generate parser summary file
function generateParserSummary(book, chapters, summaryPath) {
    const chapterSummaries = chapters.map((chapter, index) => {
        const textChunks = chapter.content.chunks.filter(chunk => chunk.type === 'text');
        const imageChunks = chapter.content.chunks.filter(chunk => chunk.type === 'image');
        
        // Get first 5 text chunks combined for preview
        const firstFiveTextChunks = textChunks.slice(0, 5);
        const previewText = firstFiveTextChunks.map(chunk => chunk.text).join(' ');
        
        // Extract page information from chunks that have pageNumber
        const chunksWithPages = chapter.content.chunks.filter(chunk => chunk.pageNumber);
        let pageRanges = 'Unknown';
        let numberOfPages = 0;
        
        if (chunksWithPages.length > 0) {
            const pageNumbers = chunksWithPages.map(chunk => chunk.pageNumber).sort((a, b) => a - b);
            const firstPage = pageNumbers[0];
            const lastPage = pageNumbers[pageNumbers.length - 1];
            pageRanges = `From ${firstPage} to ${lastPage}`;
            numberOfPages = lastPage - firstPage + 1;
        }
        
        return {
            chapterNumber: chapter.chapterNumber,
            chapterName: chapter.title,
            wordCount: chapter.wordCount,
            textChunks: textChunks.length,
            imageChunks: imageChunks.length,
            totalChunks: chapter.content.chunks.length,
            pageRanges: pageRanges,
            numberOfPages: numberOfPages,
            previewText: previewText
        };
    });

    const totalTextChunks = chapters.reduce((sum, ch) => 
        sum + ch.content.chunks.filter(chunk => chunk.type === 'text').length, 0);
    const totalImageChunks = chapters.reduce((sum, ch) => 
        sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);
    const totalChunks = totalTextChunks + totalImageChunks;

    const summary = {
        bookInfo: {
            title: book.title,
            author: book.author,
            parsedAt: new Date().toISOString()
        },
        overview: {
            totalChapters: chapters.length,
            totalWords: book.totalWords,
            totalTextChunks: totalTextChunks,
            totalImageChunks: totalImageChunks,
            totalChunks: totalChunks,
            averageWordsPerChapter: Math.round(book.totalWords / chapters.length),
            averageChunksPerChapter: Math.round(totalChunks / chapters.length)
        },
        chapters: chapterSummaries
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📊 Parser summary saved to: ${summaryPath}`);
    
    // Also log a nice table to console
    console.log('\n📊 PARSER SUMMARY:');
    console.log('='.repeat(80));
    console.log(`📖 Book: "${book.title}" by ${book.author}`);
    console.log(`📚 Total Chapters: ${chapters.length}`);
    console.log(`📝 Total Words: ${book.totalWords.toLocaleString()}`);
    console.log(`🧩 Total Chunks: ${totalChunks.toLocaleString()} (${totalTextChunks.toLocaleString()} text + ${totalImageChunks.toLocaleString()} images)`);
    console.log('='.repeat(80));
    console.log('📚 CHAPTER BREAKDOWN:');
    
    chapterSummaries.forEach((ch, i) => {
        const chNum = String(ch.chapterNumber).padStart(2);
        const words = String(ch.wordCount).padStart(6);
        const chunks = String(ch.totalChunks).padStart(4);
        const images = String(ch.imageChunks).padStart(3);
        const title = ch.chapterName.length > 40 ? 
            ch.chapterName.substring(0, 37) + '...' : ch.chapterName;
        
        console.log(`${chNum}. ${title.padEnd(40)} ${words}w ${chunks}c ${images}i`);
    });
    console.log('='.repeat(80));
}

// Main execution
async function main() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const pdfPath = args[0];

        // Check for debug flag
        const debugMode = args.includes('--debug') || args.includes('-d');
        const filteredArgs = args.filter(arg => arg !== '--debug' && arg !== '-d');

        // Smart argument parsing: if second arg looks like a path ending in .json and doesn't exist,
        // or if it exists and looks like an output file, treat it as output path
        let configPath = filteredArgs[1];
        let outputPath = filteredArgs[2];

        if (filteredArgs[1] && !filteredArgs[2]) {
            // Only two arguments provided - determine if second is config or output
            if (filteredArgs[1].endsWith('.json') && !fs.existsSync(filteredArgs[1])) {
                // Looks like output path (doesn't exist yet)
                outputPath = filteredArgs[1];
                configPath = null;
            } else if (!filteredArgs[1].endsWith('.json')) {
                // Doesn't look like config file
                outputPath = filteredArgs[1];
                configPath = null;
            }
        }

        return parseBook(pdfPath, configPath, outputPath, debugMode);
    } catch (error) {
        console.error('❌ Error parsing book:', error);
        process.exit(1);
    }
}

async function parseBook(pdfPath, configPath, outputPath, debugMode) {
    try {
        if (!pdfPath) {
            console.error('❌ PDF file path is required');
            showHelp();
            process.exit(1);
        }

        // Config file is now optional - we'll try TOC extraction first

        const finalOutputPath = outputPath || path.join(path.dirname(pdfPath), 'output.json');

        if (!fs.existsSync(pdfPath)) {
            console.error(`❌ PDF file not found: ${pdfPath}`);
            process.exit(1);
        }

        console.log('🚀 Starting PDF book parsing...');
        console.log(`📁 PDF: ${pdfPath}`);
        console.log(`⚙️  Config: ${configPath || 'None (using TOC extraction)'}`);
        console.log(`📄 Output: ${finalOutputPath}`);
        if (debugMode) console.log(`🐛 Debug mode: ON`);

        const { book, chapters, imagesFolderPath } = await parsePdfBook(pdfPath, configPath, debugMode);

        saveToFile(book, chapters, finalOutputPath, imagesFolderPath);

        const totalImages = chapters.reduce((sum, ch) =>
            sum + ch.content.chunks.filter(chunk => chunk.type === 'image').length, 0);

        console.log('✅ Book parsed and saved to file successfully!');
        console.log(`📖 Title: "${book.title}"`);
        console.log(`👤 Author: ${book.author}`);
        console.log(`📚 Chapters: ${chapters.length}`);
        console.log(`📝 Total words: ${book.totalWords.toLocaleString()}`);
        console.log(`🖼️ Total images: ${totalImages}`);
        console.log(`📄 Output file: ${finalOutputPath}`);

    } catch (error) {
        console.error('❌ Error parsing PDF:', error);
        process.exit(1);
    }
}

// CLI usage help
function showHelp() {
    console.log(`
Usage: node parse-pdf-book-generic.js PDF_PATH [CONFIG_PATH] [OUTPUT_PATH] [--debug|-d]

Arguments:
  PDF_PATH    Path to the PDF file (required)
  CONFIG_PATH Path to the book configuration JSON file (optional)
  OUTPUT_PATH Output JSON file path (optional, defaults to same directory as PDF)
  --debug|-d  Enable debug mode to save raw parsing data

Examples:
  # Use TOC extraction with image support (recommended for books with bookmarks/outline)
  node parse-pdf-book-generic.js ./my-book.pdf
  node parse-pdf-book-generic.js ./my-book.pdf ./output.json
  
  # Use config file for custom chapter detection
  node parse-pdf-book-generic.js ./my-book.pdf ./my-book-config.json
  node parse-pdf-book-generic.js ./my-book.pdf ./my-book-config.json ./output.json
  
  # Enable debug mode to save raw parsing data
  node parse-pdf-book-generic.js ./my-book.pdf --debug
  node parse-pdf-book-generic.js ./my-book.pdf ./output.json --debug

Features:
  - TOC-based chapter detection from PDF bookmarks/outline
  - Fallback to pattern-based chapter detection using config files
  - Embedded image extraction using pdfimages
  - Page-aware correlation of text and images
  - Clean chapter title removal from content

Output:
  - Creates output.json with book metadata, chapters, and image references
  - Creates images/ subfolder with extracted images organized by page

The parser will first attempt to extract chapters from PDF bookmarks/table of contents.
If no TOC is found, it will fall back to pattern-based detection using the config file.
Images are extracted and correlated with appropriate pages for enhanced reading experience.
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

module.exports = { parseBook, parsePdfBook, loadBookConfig, detectChapters, extractTOCFromPdf, extractImages, chunkTextWithPages, createPageAwareChunksWithImages, extractChapterContentFromTOC, cleanPageNumbers }; 