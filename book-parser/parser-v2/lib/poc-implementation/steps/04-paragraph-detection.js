/**
 * Step 4: Paragraph Detection
 * 
 * Detect paragraph boundaries in the page content from step 3.
 * This step creates clean paragraph structure for chunking.
 * 
 * Requirements:
 * - Paragraphs end when a sentence ends with punctuation AND is followed by a newline
 * - Process clean page content from step 3
 * - Extract links that exist within paragraph content
 * - Output: array of chapters, each chapter has array of paragraphs
 * - Each paragraph has pageNumber (start), content, and links (if any)
 * 
 * Expected Input:
 * - pipelineState: { chapters: [...] with pages[].content and pages[].links, ... }
 * - config: { OUTPUT_DIR: path, DEBUG_DIR: path, ... }
 * 
 * Expected Output:
 * - { chapters: [{ title, chapterNumber, paragraphs: [{ pageNumber, content, links }] }] }
 */

const fs = require('fs');
const path = require('path');

/**
 * Execute paragraph detection step
 * @param {Object} pipelineState - Current pipeline state
 * @param {Object} config - Configuration object
 * @returns {Object} - Updated pipeline state with paragraph structure
 */
async function execute(pipelineState, config) {
    console.log('📄 Starting paragraph detection (Step 4)...');
    
    // Validate prerequisites
    if (!pipelineState.chapters || pipelineState.chapters.length === 0) {
        throw new Error('Step 3 (page extraction) must be completed first');
    }
    
    const startTime = Date.now();
    
    try {
        const chaptersWithParagraphs = [];
        let totalParagraphs = 0;
        let totalLinksExtracted = 0;
        
        console.log(`📚 Processing ${pipelineState.chapters.length} chapters...`);
        
        for (const chapter of pipelineState.chapters) {
            console.log(`  📖 Processing chapter: ${chapter.title} (${chapter.pages.length} pages)`);
            
            // Detect paragraphs across all pages in the chapter
            const paragraphs = detectParagraphsInChapter(chapter);
            
            const chapterWithParagraphs = {
                title: chapter.title,
                chapterNumber: chapter.chapterNumber,
                paragraphs: paragraphs
            };
            
            chaptersWithParagraphs.push(chapterWithParagraphs);
            totalParagraphs += paragraphs.length;
            
            // Count links in this chapter
            const chapterLinksCount = paragraphs.reduce((sum, p) => sum + (p.links ? p.links.length : 0), 0);
            totalLinksExtracted += chapterLinksCount;
            
            // Show word count distribution and links for this chapter
            const wordCounts = paragraphs.map(p => p.wordCount || getWordCount(p.content));
            const under100 = wordCounts.filter(w => w < 100).length;
            const over200 = wordCounts.filter(w => w > 200).length;
            const inRange = wordCounts.filter(w => w >= 100 && w <= 200).length;
            
            console.log(`    ✅ ${paragraphs.length} paragraphs (${inRange} in range, ${under100} under 100, ${over200} over 200)`);
            if (chapterLinksCount > 0) {
                console.log(`    🔗 ${chapterLinksCount} links extracted`);
            }
        }
        
        // Generate statistics
        const stats = generateParagraphStats(chaptersWithParagraphs);
        
        // Save debug output
        const debugOutput = {
            paragraphDetectionMetadata: {
                totalParagraphs: totalParagraphs,
                totalChapters: chaptersWithParagraphs.length,
                totalLinksExtracted: totalLinksExtracted,
                processingTime: Date.now() - startTime,
                detectionTime: new Date().toISOString()
            },
            paragraphStats: stats,
            linkStats: {
                totalLinks: totalLinksExtracted,
                averageLinksPerChapter: chaptersWithParagraphs.length > 0 ? totalLinksExtracted / chaptersWithParagraphs.length : 0,
                chaptersWithLinks: chaptersWithParagraphs.filter(ch => ch.paragraphs.some(p => p.links && p.links.length > 0)).length
            },
            sampleParagraphs: chaptersWithParagraphs.slice(0, 2).map(chapter => ({
                chapterTitle: chapter.title,
                chapterNumber: chapter.chapterNumber,
                paragraphCount: chapter.paragraphs.length,
                sampleParagraphs: chapter.paragraphs.slice(0, 3).map(p => ({
                    pageNumber: p.pageNumber,
                    contentPreview: p.content.substring(0, 100) + '...',
                    wordCount: p.wordCount || getWordCount(p.content),
                    sentencesCount: p.sentencesCount || getSentenceCount(p.content),
                    linksCount: p.links ? p.links.length : 0,
                    links: p.links || []
                }))
            }))
        };
        
        const debugFile = path.join(config.DEBUG_DIR, 'step-04-paragraph-detection.json');
        fs.writeFileSync(debugFile, JSON.stringify(debugOutput, null, 2));
        
        console.log(`✅ Paragraph detection completed: ${totalParagraphs} paragraphs detected`);
        console.log(`🔗 Links extracted: ${totalLinksExtracted} links across ${chaptersWithParagraphs.filter(ch => ch.paragraphs.some(p => p.links && p.links.length > 0)).length} chapters`);
        console.log(`📊 Processing took ${Date.now() - startTime}ms`);
        console.log(`📄 Average paragraphs per chapter: ${Math.round(stats.averageParagraphsPerChapter)}`);
        console.log(`📏 Word count distribution: ${stats.wordCountDistribution.percentageInTargetRange}% in target range (100-200 words)`);
        console.log(`📝 Average sentences per paragraph: ${Math.round(stats.averageSentencesPerParagraph * 10) / 10}`);
        console.log(`📄 Debug output: ${debugFile}`);
        
        return {
            chapters: chaptersWithParagraphs,
            metadata: {
                ...pipelineState.metadata,
                paragraphDetection: {
                    totalParagraphs: totalParagraphs,
                    totalChapters: chaptersWithParagraphs.length,
                    totalLinksExtracted: totalLinksExtracted,
                    averageParagraphsPerChapter: stats.averageParagraphsPerChapter,
                    processingTime: Date.now() - startTime,
                    detectionTime: new Date().toISOString()
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Paragraph detection failed:', error.message);
        throw error;
    }
}

/**
 * Detect paragraphs in a chapter by processing all its pages
 * @param {Object} chapter - Chapter object with pages
 * @returns {Array} - Array of paragraph objects
 */
function detectParagraphsInChapter(chapter) {
    const paragraphs = [];
    
    // Process each page in the chapter
    for (const page of chapter.pages) {
        const pageParagraphs = detectParagraphsInPage(page);
        paragraphs.push(...pageParagraphs);
    }
    
    // Combine and adjust paragraphs to be between 100-200 words
    const adjustedParagraphs = adjustParagraphSizes(paragraphs);
    
    return adjustedParagraphs;
}

/**
 * Adjust paragraph sizes to be between 100-200 words
 * @param {Array} paragraphs - Array of paragraph objects
 * @returns {Array} - Adjusted paragraphs
 */
function adjustParagraphSizes(paragraphs) {
    const adjustedParagraphs = [];
    let i = 0;
    
    while (i < paragraphs.length) {
        const currentParagraph = paragraphs[i];
        const wordCount = currentParagraph.wordCount || getWordCount(currentParagraph.content);
        
        if (wordCount < 100) {
            // Combine with next paragraphs until we reach 100+ words
            const combinedParagraph = combineSmallParagraphs(paragraphs, i);
            adjustedParagraphs.push(combinedParagraph.paragraph);
            i = combinedParagraph.nextIndex;
        } else if (wordCount > 200) {
            // Split large paragraph into smaller ones
            const splitParagraphs = splitLargeParagraph(currentParagraph);
            adjustedParagraphs.push(...splitParagraphs);
            i++;
        } else {
            // Paragraph is the right size
            adjustedParagraphs.push(currentParagraph);
            i++;
        }
    }
    
    return adjustedParagraphs;
}

/**
 * Combine small paragraphs with subsequent ones until target size is reached
 * @param {Array} paragraphs - Array of all paragraphs
 * @param {number} startIndex - Starting index
 * @returns {Object} - Combined paragraph and next index
 */
function combineSmallParagraphs(paragraphs, startIndex) {
    let combinedContent = paragraphs[startIndex].content;
    let combinedPageNumber = paragraphs[startIndex].pageNumber;
    let combinedLinks = [...(paragraphs[startIndex].links || [])];
    let currentIndex = startIndex + 1;
    
    // Keep combining until we reach at least 100 words or run out of paragraphs
    while (currentIndex < paragraphs.length && getWordCount(combinedContent) < 100) {
        combinedContent += ' ' + paragraphs[currentIndex].content;
        // Merge links from additional paragraphs
        if (paragraphs[currentIndex].links) {
            combinedLinks.push(...paragraphs[currentIndex].links);
        }
        currentIndex++;
    }
    
    // If still under 100 words and we have more paragraphs, add one more
    if (currentIndex < paragraphs.length && getWordCount(combinedContent) < 100) {
        combinedContent += ' ' + paragraphs[currentIndex].content;
        // Merge links from final paragraph
        if (paragraphs[currentIndex].links) {
            combinedLinks.push(...paragraphs[currentIndex].links);
        }
        currentIndex++;
    }
    
    // Remove duplicate links (same linkId)
    const uniqueLinks = removeDuplicateLinks(combinedLinks);
    
    return {
        paragraph: {
            pageNumber: combinedPageNumber,
            content: combinedContent,
            wordCount: getWordCount(combinedContent),
            sentencesCount: getSentenceCount(combinedContent),
            links: uniqueLinks
        },
        nextIndex: currentIndex
    };
}

/**
 * Split large paragraph into smaller ones
 * @param {Object} paragraph - Paragraph to split
 * @returns {Array} - Array of smaller paragraphs
 */
function splitLargeParagraph(paragraph) {
    const sentences = splitIntoSentences(paragraph.content);
    const splitParagraphs = [];
    
    let currentParagraphSentences = [];
    let currentWordCount = 0;
    
    for (const sentence of sentences) {
        const sentenceWordCount = getWordCount(sentence);
        
        // If adding this sentence would exceed 200 words, finish current paragraph
        if (currentWordCount + sentenceWordCount > 200 && currentParagraphSentences.length > 0) {
            const paragraphContent = currentParagraphSentences.join(' ');
            const paragraphLinks = extractLinksFromContent(paragraphContent, paragraph.links || []);
            
            splitParagraphs.push({
                pageNumber: paragraph.pageNumber,
                content: paragraphContent,
                wordCount: getWordCount(paragraphContent),
                sentencesCount: getSentenceCount(paragraphContent),
                links: paragraphLinks
            });
            
            currentParagraphSentences = [];
            currentWordCount = 0;
        }
        
        currentParagraphSentences.push(sentence);
        currentWordCount += sentenceWordCount;
    }
    
    // Handle remaining sentences
    if (currentParagraphSentences.length > 0) {
        const paragraphContent = currentParagraphSentences.join(' ');
        const paragraphLinks = extractLinksFromContent(paragraphContent, paragraph.links || []);
        
        splitParagraphs.push({
            pageNumber: paragraph.pageNumber,
            content: paragraphContent,
            wordCount: getWordCount(paragraphContent),
            sentencesCount: getSentenceCount(paragraphContent),
            links: paragraphLinks
        });
    }
    
    return splitParagraphs;
}

/**
 * Split text into sentences
 * @param {string} text - Text to split
 * @returns {Array} - Array of sentences
 */
function splitIntoSentences(text) {
    // First, protect footnote references by temporarily replacing them
    // Handle patterns like: "sentence.\n2\nNext sentence" and "sentence.2\nNext sentence"
    let protectedText = text.replace(/([.!?]+)\n(\d+)\n/g, '$1$2◊FOOTNOTE_BREAK◊');
    protectedText = protectedText.replace(/([.!?]+)\s*(\d+)\s*\n/g, '$1$2◊FOOTNOTE_BREAK◊');
    
    // Split on sentence endings followed by space and capital letter
    const sentences = protectedText.split(/([.!?]+\s+)(?=[A-Z])/);
    const result = [];
    
    for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i];
        const punctuation = sentences[i + 1] || '';
        if (sentence && sentence.trim()) {
            // Restore footnote breaks as regular line breaks
            const cleanSentence = (sentence + punctuation).replace(/◊FOOTNOTE_BREAK◊/g, '\n');
            result.push(cleanSentence.trim());
        }
    }
    
    return result;
}

/**
 * Get word count for a text
 * @param {string} text - Text to count words in
 * @returns {number} - Word count
 */
function getWordCount(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Get sentence count for a text
 * @param {string} text - Text to count sentences in
 * @returns {number} - Sentence count
 */
function getSentenceCount(text) {
    if (!text || text.trim().length === 0) {
        return 0;
    }
    
    // Split on sentence endings (.!?:;) and count non-empty parts
    const sentences = text.split(/[.!?:;]+/).filter(sentence => sentence.trim().length > 0);
    return sentences.length;
}

/**
 * Detect paragraphs in a single page's content
 * @param {Object} page - Page object with content
 * @returns {Array} - Array of paragraph objects
 */
function detectParagraphsInPage(page) {
    const paragraphs = [];
    
    if (!page.content || page.content.trim().length === 0) {
        return paragraphs;
    }
    
    const content = page.content.trim();
    const pageLinks = page.links || [];
    
    // Split content into lines
    const lines = content.split('\n');
    
    let currentParagraphLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (line.length === 0) {
            continue;
        }
        
        // Add line to current paragraph
        currentParagraphLines.push(line);
        
        // Check if this line ends a paragraph
        // Paragraph ends when a sentence ends with punctuation AND is followed by a newline
        if (endsWithSentenceTerminator(line)) {
            // Check if next line starts a new paragraph or is empty
            const nextLineIndex = i + 1;
            let isEndOfParagraph = false;
            let footnoteFound = false;
            
            if (nextLineIndex >= lines.length) {
                // End of page = end of paragraph
                isEndOfParagraph = true;
            } else {
                // Look ahead to see what follows
                for (let j = nextLineIndex; j < lines.length; j++) {
                    const nextLine = lines[j].trim();
                    
                    if (nextLine === '') {
                        // Empty line = end of paragraph
                        isEndOfParagraph = true;
                        break;
                    }
                    
                    if (startsNewParagraph(nextLine)) {
                        // New paragraph indicator = end of current paragraph
                        isEndOfParagraph = true;
                        break;
                    }
                    
                    if (j === nextLineIndex) {
                        // Check if next line is just a footnote reference (single digit(s))
                        if (/^\d+$/.test(nextLine)) {
                            // This is a footnote reference, add it to current paragraph with newline preserved
                            currentParagraphLines.push(nextLine);
                            footnoteFound = true;
                            i = j; // Skip ahead to the footnote line
                            
                            // Check what comes after the footnote to determine if paragraph should end
                            for (let k = j + 1; k < lines.length; k++) {
                                const afterFootnote = lines[k].trim();
                                if (afterFootnote === '') {
                                    isEndOfParagraph = true;
                                    break;
                                }
                                if (startsNewParagraph(afterFootnote)) {
                                    isEndOfParagraph = true;
                                    break;
                                }
                                // If there's more content, continue building paragraph
                                break;
                            }
                            break;
                        }
                    }
                    
                    // If we reach here, continue building paragraph
                    break;
                }
            }
            
            if (isEndOfParagraph && currentParagraphLines.length > 0) {
                // Create paragraph - preserve original structure including newlines before footnotes
                let paragraphContent = currentParagraphLines.join('\n');
                
                // Don't trim if this could remove important formatting like footnote spacing
                // Check for patterns like "sentence.\n1 word" which should preserve the newline before footnotes
                if (/\.\n\d+\s+[A-Za-z]/.test(paragraphContent)) {
                    // For footnote cases, only trim excessive whitespace at the very start/end, preserve internal structure
                    paragraphContent = paragraphContent.replace(/^\s+/, '').replace(/\s+$/, '');
                } else {
                    paragraphContent = paragraphContent.trim();
                }
                
                if (paragraphContent.length > 0) {
                    // Extract links that exist within this paragraph's content
                    const paragraphLinks = extractLinksFromParagraph(paragraphContent, pageLinks);
                    
                    paragraphs.push({
                        pageNumber: page.pageNumber,
                        content: paragraphContent,
                        wordCount: getWordCount(paragraphContent),
                        sentencesCount: getSentenceCount(paragraphContent),
                        links: paragraphLinks
                    });
                }
                currentParagraphLines = [];
            }
        }
    }
    
    // Handle any remaining content as a paragraph
    if (currentParagraphLines.length > 0) {
        let paragraphContent = currentParagraphLines.join('\n');
        
        // Don't trim if this could remove important formatting like footnote spacing
        // Check for patterns like "sentence.\n1 word" which should preserve the newline before footnotes
        if (/\.\n\d+\s+[A-Za-z]/.test(paragraphContent)) {
            // For footnote cases, only trim excessive whitespace at the very start/end, preserve internal structure
            paragraphContent = paragraphContent.replace(/^\s+/, '').replace(/\s+$/, '');
        } else {
            paragraphContent = paragraphContent.trim();
        }
        
        if (paragraphContent.length > 0) {
            // Extract links that exist within this paragraph's content
            const paragraphLinks = extractLinksFromParagraph(paragraphContent, pageLinks);
            
            paragraphs.push({
                pageNumber: page.pageNumber,
                content: paragraphContent,
                wordCount: getWordCount(paragraphContent),
                sentencesCount: getSentenceCount(paragraphContent),
                links: paragraphLinks
            });
        }
    }
    
    return paragraphs;
}

/**
 * Check if a line ends with sentence terminator punctuation
 * @param {string} line - Line to check
 * @returns {boolean} - True if line ends with sentence terminator
 */
function endsWithSentenceTerminator(line) {
    if (!line || line.length === 0) {
        return false;
    }
    
    const trimmed = line.trim();
    const lastChar = trimmed[trimmed.length - 1];
    
    // Check for sentence terminators
    return ['.', '!', '?', ':', ';'].includes(lastChar);
}

/**
 * Check if a line starts with a capital letter and is substantial content
 * @param {string} line - Line to check
 * @returns {boolean} - True if line is a new paragraph indicator
 */
function startsNewParagraph(line) {
    return /^[A-Z]/.test(line) && line.length > 10; // Simple heuristic for substantial content
}

/**
 * Extract links from paragraph content based on page links
 * @param {string} paragraphContent - The content of the paragraph
 * @param {Array} pageLinks - Links available on the page
 * @returns {Array} - Array of links that exist within the paragraph content
 */
function extractLinksFromParagraph(paragraphContent, pageLinks) {
    const paragraphLinks = [];
    
    // Check each page link to see if its source text exists in the paragraph
    for (const link of pageLinks) {
        if (link.sourceText && isSourceTextInParagraph(link.sourceText, paragraphContent)) {
            paragraphLinks.push(link);
        }
    }
    
    return paragraphLinks;
}

/**
 * Check if source text exists in paragraph content with flexible matching
 * @param {string} sourceText - The source text to find
 * @param {string} paragraphContent - The content to search in
 * @returns {boolean} - True if source text is found
 */
function isSourceTextInParagraph(sourceText, paragraphContent) {
    // First try exact match
    if (paragraphContent.includes(sourceText)) {
        return true;
    }
    
    // For short numeric references (likely footnotes), try more flexible matching
    if (/^\d+$/.test(sourceText.trim())) {
        // Create regex pattern that matches the EXACT number with flexible whitespace
        // But ensure it's not part of a larger word/number (like "Chapter 2" when looking for "3")
        const escapedText = sourceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flexiblePattern = new RegExp(`(?:^|\\s|\\.|,|;|:|!|\\?)\\s*${escapedText}(?=\\s|$|\\.|,|;|:|!|\\?|\\n)`, 'g');
        
        if (flexiblePattern.test(paragraphContent)) {
            return true;
        }
    }
    
    // For other text, try with normalized whitespace
    const normalizedSource = sourceText.replace(/\s+/g, ' ').trim();
    const normalizedContent = paragraphContent.replace(/\s+/g, ' ');
    
    return normalizedContent.includes(normalizedSource);
}

/**
 * Extract links from content when splitting paragraphs
 * @param {string} content - The text content to check
 * @param {Array} originalLinks - The original links from the larger paragraph
 * @returns {Array} - Array of links found within the content
 */
function extractLinksFromContent(content, originalLinks) {
    const links = [];
    
    // Check each original link to see if its source text exists in this content
    for (const link of originalLinks) {
        if (link.sourceText && isSourceTextInParagraph(link.sourceText, content)) {
            links.push(link);
        }
    }
    
    return links;
}

/**
 * Remove duplicate links based on linkId
 * @param {Array} links - Array of link objects
 * @returns {Array} - Array of unique link objects
 */
function removeDuplicateLinks(links) {
    const uniqueLinks = [];
    const seen = new Set();

    for (const link of links) {
        const key = link.linkId || `${link.sourceText}-${link.targetText}`;
        if (!seen.has(key)) {
            uniqueLinks.push(link);
            seen.add(key);
        }
    }
    
    return uniqueLinks;
}

/**
 * Generate statistics about paragraph detection
 * @param {Array} chapters - Array of chapters with paragraphs
 * @returns {Object} - Statistics object
 */
function generateParagraphStats(chapters) {
    const allParagraphs = chapters.flatMap(chapter => chapter.paragraphs);
    const totalParagraphs = allParagraphs.length;
    
    const paragraphsPerChapter = {};
    const wordsPerParagraph = [];
    const sentencesPerParagraph = [];
    
    chapters.forEach(chapter => {
        paragraphsPerChapter[chapter.chapterNumber] = chapter.paragraphs.length;
        
        chapter.paragraphs.forEach(paragraph => {
            const wordCount = paragraph.wordCount || getWordCount(paragraph.content);
            const sentenceCount = paragraph.sentencesCount || getSentenceCount(paragraph.content);
            wordsPerParagraph.push(wordCount);
            sentencesPerParagraph.push(sentenceCount);
        });
    });
    
    const averageWordsPerParagraph = wordsPerParagraph.length > 0 
        ? wordsPerParagraph.reduce((sum, count) => sum + count, 0) / wordsPerParagraph.length 
        : 0;
    
    const averageSentencesPerParagraph = sentencesPerParagraph.length > 0 
        ? sentencesPerParagraph.reduce((sum, count) => sum + count, 0) / sentencesPerParagraph.length 
        : 0;
    
    // Calculate word count distribution
    const under100 = wordsPerParagraph.filter(w => w < 100).length;
    const between100And200 = wordsPerParagraph.filter(w => w >= 100 && w <= 200).length;
    const over200 = wordsPerParagraph.filter(w => w > 200).length;
    
    return {
        totalParagraphs: totalParagraphs,
        averageParagraphsPerChapter: chapters.length > 0 ? totalParagraphs / chapters.length : 0,
        paragraphsPerChapter: paragraphsPerChapter,
        averageWordsPerParagraph: averageWordsPerParagraph,
        averageSentencesPerParagraph: averageSentencesPerParagraph,
        minWordsPerParagraph: wordsPerParagraph.length > 0 ? Math.min(...wordsPerParagraph) : 0,
        maxWordsPerParagraph: wordsPerParagraph.length > 0 ? Math.max(...wordsPerParagraph) : 0,
        minSentencesPerParagraph: sentencesPerParagraph.length > 0 ? Math.min(...sentencesPerParagraph) : 0,
        maxSentencesPerParagraph: sentencesPerParagraph.length > 0 ? Math.max(...sentencesPerParagraph) : 0,
        wordCountDistribution: {
            under100: under100,
            between100And200: between100And200,
            over200: over200,
            percentageInTargetRange: totalParagraphs > 0 ? Math.round((between100And200 / totalParagraphs) * 100) : 0
        }
    };
}

module.exports = { execute }; 