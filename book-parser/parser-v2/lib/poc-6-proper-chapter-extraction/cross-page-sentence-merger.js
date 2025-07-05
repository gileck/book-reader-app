const fs = require('fs');
const path = require('path');

/**
 * Fix sentences split across page boundaries (with blank lines between them)
 * This is the CORE issue: PDF page breaks create blank lines in mid-sentence
 */
function mergeCrossPageSentences(rawText) {
    console.log(`🔧 Merging sentences split across page boundaries...`);

    const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    console.log(`📊 Processing ${lines.length} lines for cross-page sentence merging...`);

    const mergedLines = [];
    let i = 0;

    while (i < lines.length) {
        const currentLine = lines[i].trim();

        // If it's an empty line, we need to check if it's splitting a sentence
        if (currentLine.length === 0) {
            // Look at the previous line (if exists)
            const prevLineIndex = mergedLines.length - 1;
            const prevLine = prevLineIndex >= 0 ? mergedLines[prevLineIndex].trim() : '';

            // Look at the next non-empty line
            let nextLineIndex = i + 1;
            while (nextLineIndex < lines.length && lines[nextLineIndex].trim().length === 0) {
                nextLineIndex++;
            }
            const nextLine = nextLineIndex < lines.length ? lines[nextLineIndex].trim() : '';

            // Check if this blank line is splitting a sentence
            const isSplittingSentence = (
                prevLine.length > 0 &&
                nextLine.length > 0 &&
                // Previous line doesn't end with sentence punctuation
                !/[.!?]$/.test(prevLine) &&
                // Next line starts with lowercase (clear continuation)
                /^[a-z]/.test(nextLine) &&
                // Skip if next line looks like a new paragraph (starts with common paragraph starters)
                !/^(and|or|but|so|yet|for|nor|the|of|to|in|on|at|with|by|from|as|that|which|who|where|when|why|how|this|these|those|however|therefore|thus|hence|consequently|meanwhile|furthermore|moreover|additionally|also|besides|furthermore|nevertheless|nonetheless|otherwise|accordingly|similarly|likewise|conversely|instead|rather|alternatively)$/i.test(nextLine) &&
                // Make sure previous line isn't too short (likely a header)
                prevLine.length > 20 &&
                // Make sure next line isn't too short (likely a fragment)
                nextLine.length > 5
            );

            if (isSplittingSentence) {
                console.log(`🔧 Merging split sentence: "${prevLine}" + "${nextLine}"`);
                // Merge the lines by combining the previous line with the next line
                mergedLines[prevLineIndex] = prevLine + ' ' + nextLine;
                // Skip the next line since we've already merged it
                i = nextLineIndex + 1;
                continue;
            } else {
                // Keep the empty line as a paragraph boundary
                mergedLines.push('');
                i++;
                continue;
            }
        }

        // Skip page numbers and very short lines
        if (/^\d+$/.test(currentLine) || currentLine.length < 3) {
            i++;
            continue;
        }

        // Add regular lines
        mergedLines.push(currentLine);
        i++;
    }

    const mergedText = mergedLines.join('\n');
    const originalLines = lines.filter(line => line.trim().length > 0).length;
    const finalLines = mergedLines.filter(line => line.trim().length > 0).length;

    console.log(`✅ Cross-page sentence merging complete:`);
    console.log(`   Original lines: ${originalLines}`);
    console.log(`   Final lines: ${finalLines}`);
    console.log(`   Lines merged: ${originalLines - finalLines}`);

    return mergedText;
}

/**
 * Apply sentence reconstruction to the cross-page merged text
 */
function reconstructSentences(mergedText) {
    console.log(`📝 Reconstructing remaining sentence fragments...`);

    const lines = mergedText.split('\n');
    const sentences = [];
    let currentSentence = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Empty lines mark paragraph boundaries
        if (line.length === 0) {
            if (currentSentence.trim().length > 0) {
                sentences.push(currentSentence.trim());
                currentSentence = '';
            }
            sentences.push('');
            continue;
        }

        // Add to current sentence
        if (currentSentence.length === 0) {
            currentSentence = line;
        } else {
            currentSentence += ' ' + line;
        }

        // Check if sentence is complete
        if (/[.!?]$/.test(currentSentence.trim()) && currentSentence.length > 30) {
            sentences.push(currentSentence.trim());
            currentSentence = '';
        }
    }

    // Add final sentence if exists
    if (currentSentence.trim().length > 0) {
        sentences.push(currentSentence.trim());
    }

    const finalText = sentences.join('\n');
    console.log(`✅ Sentence reconstruction complete`);

    return finalText;
}

/**
 * Detect logical paragraphs from the reconstructed text
 */
function detectLogicalParagraphs(reconstructedText) {
    console.log(`📝 Detecting logical paragraphs...`);

    const items = reconstructedText.split('\n');
    const paragraphs = [];
    let currentParagraph = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i].trim();

        if (item.length === 0) {
            if (currentParagraph.length > 0) {
                const paragraphText = currentParagraph.join(' ').trim();
                if (paragraphText.length > 30) {
                    paragraphs.push(paragraphText);
                }
                currentParagraph = [];
            }
            continue;
        }

        // Check for new paragraph indicators
        const isNewParagraph = (
            currentParagraph.length > 0 &&
            (
                // Headers and titles
                /^(Chapter|CHAPTER|Figure|Fig\.|Table|[IVX]+\.|\d+\.)/.test(item) ||
                // Title case headings
                (item.length < 60 && /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(item)) ||
                // All caps headings
                (item.length < 50 && /^[A-Z\s]+$/.test(item))
            )
        );

        if (isNewParagraph) {
            // Finish current paragraph
            const paragraphText = currentParagraph.join(' ').trim();
            if (paragraphText.length > 30) {
                paragraphs.push(paragraphText);
            }
            currentParagraph = [item];
        } else {
            currentParagraph.push(item);
        }
    }

    // Add final paragraph
    if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ').trim();
        if (paragraphText.length > 30) {
            paragraphs.push(paragraphText);
        }
    }

    console.log(`✅ Found ${paragraphs.length} logical paragraphs`);
    return paragraphs;
}

/**
 * Test the cross-page sentence merger
 */
async function testCrossPageMerger() {
    console.log('🎯 Testing cross-page sentence merger for split sentences...\n');

    try {
        const rawTextPath = path.join(__dirname, 'output', 'introduction-chapter-raw.txt');
        const rawFileContent = fs.readFileSync(rawTextPath, 'utf8');
        const lines = rawFileContent.split('\n');
        const contentStartIndex = lines.findIndex(line => line.includes('========================================'));
        const originalChapterText = lines.slice(contentStartIndex + 2).join('\n');

        console.log(`📊 Original: ${originalChapterText.length} chars, ${originalChapterText.split('\n').length} lines`);

        // Step 1: Merge sentences split across page boundaries (blank lines)
        const crossPageMerged = mergeCrossPageSentences(originalChapterText);

        // Step 2: Reconstruct remaining sentence fragments
        const sentenceReconstructed = reconstructSentences(crossPageMerged);

        // Step 3: Detect logical paragraphs
        const paragraphs = detectLogicalParagraphs(sentenceReconstructed);

        const paragraphObjects = paragraphs.map((text, index) => {
            const wordCount = text.trim().split(/\s+/).length;
            const startsWithCapital = /^[A-Z]/.test(text.trim());
            const endsWithPunctuation = /[.!?]$/.test(text.trim());

            return {
                id: `0_${index + 1}`,
                text: text,
                wordCount: wordCount,
                startsWithCapital: startsWithCapital,
                endsWithPunctuation: endsWithPunctuation
            };
        });

        const validParagraphs = paragraphObjects.filter(p =>
            p.startsWithCapital && p.endsWithPunctuation && p.wordCount >= 50 && p.wordCount <= 500
        );

        console.log(`\n📊 CROSS-PAGE MERGER RESULTS:`);
        console.log(`   Total paragraphs: ${paragraphObjects.length}`);
        console.log(`   Valid paragraphs: ${validParagraphs.length} (${Math.round(validParagraphs.length / paragraphObjects.length * 100)}%)`);
        console.log(`   Average word count: ${Math.round(paragraphObjects.reduce((sum, p) => sum + p.wordCount, 0) / paragraphObjects.length)}`);

        // CHECK FOR THE SPECIFIC FIX
        console.log(`\n🎯 Checking for 'shrink yourself' sentence reconstruction:`);
        const shrinkParagraph = paragraphObjects.find(p => p.text.includes('shrink yourself'));
        if (shrinkParagraph) {
            console.log(`   Found: "${shrinkParagraph.text.slice(0, 120)}..."`);
            if (shrinkParagraph.text.includes('If you shrink yourself down to the size of a molecule')) {
                console.log(`   ✅ SUCCESS: Cross-page sentence fully merged!`);
            } else {
                console.log(`   ❌ STILL SPLIT: Need to investigate further`);
            }
        } else {
            console.log(`   ❓ Paragraph with 'shrink yourself' not found`);
        }

        // Show the cell-related paragraphs
        console.log(`\n📖 Cell-related paragraphs to verify fix:`);
        const cellParagraphs = paragraphObjects.filter(p => p.text.toLowerCase().includes('cell'));
        cellParagraphs.slice(0, 3).forEach((paragraph, index) => {
            console.log(`\n--- Cell Paragraph ${index + 1} (${paragraph.wordCount} words) ---`);
            console.log(`Capital: ${paragraph.startsWithCapital ? '✅' : '❌'} | Punctuation: ${paragraph.endsWithPunctuation ? '✅' : '❌'}`);
            console.log(`"${paragraph.text}"`);
        });

        // Save results
        const outputPath = path.join(__dirname, 'output', 'introduction-paragraphs-CROSS-PAGE-FIXED.txt');
        let output = `# Introduction Chapter - CROSS-PAGE SENTENCE MERGER\n`;
        output += `# Generated: ${new Date().toISOString()}\n`;
        output += `# Total Paragraphs: ${paragraphObjects.length}\n`;
        output += `# Valid Paragraphs: ${validParagraphs.length}\n`;
        output += `# Method: 1) Cross-page sentence merger 2) Sentence reconstruction 3) Logical paragraphs\n\n`;

        paragraphObjects.forEach((paragraph, index) => {
            const compliance = [];
            if (paragraph.startsWithCapital) compliance.push('✅ Capital');
            else compliance.push('❌ Capital');

            if (paragraph.endsWithPunctuation) compliance.push('✅ Punctuation');
            else compliance.push('❌ Punctuation');

            if (paragraph.wordCount >= 50 && paragraph.wordCount <= 500) compliance.push('✅ Word Count');
            else compliance.push('❌ Word Count');

            if (paragraph.wordCount >= 80 && paragraph.wordCount <= 300) compliance.push('🎯 Target Range');
            else compliance.push('📊 Outside Target');

            output += `Paragraph ${index + 1} (ID: ${paragraph.id})\n`;
            output += `Words: ${paragraph.wordCount} | Chars: ${paragraph.text.length}\n`;
            output += `Compliance: ${compliance.join(' | ')}\n`;
            output += `Text: "${paragraph.text}"\n\n`;
            output += `========\n`;
        });

        fs.writeFileSync(outputPath, output, 'utf8');
        console.log(`\n💾 Cross-page fixed results saved to: ${outputPath}`);

        return paragraphObjects;

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

if (require.main === module) {
    testCrossPageMerger().catch(console.error);
}

module.exports = { mergeCrossPageSentences, reconstructSentences, detectLogicalParagraphs, testCrossPageMerger }; 