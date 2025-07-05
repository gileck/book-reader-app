const fs = require('fs');
const path = require('path');

/**
 * Reconstruct sentences that were split across page boundaries
 * This must happen BEFORE paragraph detection
 */
function reconstructSentences(rawText) {
    console.log(`🔧 Reconstructing sentences split across pages...`);

    // Normalize newlines 
    const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');

    console.log(`📊 Processing ${lines.length} lines for sentence reconstruction...`);

    const reconstructedLines = [];
    let i = 0;

    while (i < lines.length) {
        let currentLine = lines[i].trim();

        // Skip empty lines - preserve them as paragraph boundaries
        if (currentLine.length === 0) {
            reconstructedLines.push('');
            i++;
            continue;
        }

        // Skip page numbers and very short fragments
        if (/^\d+$/.test(currentLine) || currentLine.length < 5) {
            i++;
            continue;
        }

        // Check if this line looks like a sentence fragment (split sentence)
        let mergedSentence = currentLine;
        let linesToMerge = 1;

        // Keep merging while we detect split sentences
        while (i + linesToMerge < lines.length) {
            const nextLine = lines[i + linesToMerge].trim();

            // Stop if we hit an empty line (paragraph boundary)
            if (nextLine.length === 0) {
                break;
            }

            // Skip page numbers
            if (/^\d+$/.test(nextLine)) {
                linesToMerge++;
                continue;
            }

            // Check if current line suggests continuation (split sentence indicators)
            const needsContinuation = (
                // Current line doesn't end with sentence-ending punctuation
                !/[.!?]$/.test(mergedSentence.trim()) ||
                // Current line ends with incomplete phrases
                /\b(the|and|of|to|in|on|at|for|with|by|from|as|a|an|but|or|so|if|when|that|which|who|where|why|how|this|these|those|his|her|its|their|our|my|your|some|any|all|each|every|one|two|three|can|will|would|could|should|may|might|must|do|does|did|have|has|had|is|are|was|were|am|be|been|being)$/i.test(mergedSentence.trim()) ||
                // Current line ends with a comma, colon, semicolon, or dash
                /[,:;–—-]$/.test(mergedSentence.trim())
            );

            const isContinuation = (
                // Next line starts with lowercase (clear continuation)
                /^[a-z]/.test(nextLine) ||
                // Next line starts with common continuation words
                /^(and|or|but|so|yet|for|nor|the|of|to|in|on|at|with|by|from|as|that|which|who|where|when|why|how|this|these|those)/i.test(nextLine)
            );

            // Merge if either line suggests continuation
            if (needsContinuation || isContinuation) {
                mergedSentence += ' ' + nextLine;
                linesToMerge++;

                // Stop merging if we now have a complete sentence
                if (/[.!?]$/.test(mergedSentence.trim()) && !/\b(the|and|of|to|in|on|at|for|with|by|from|as|a|an|but|or|so|if|when|that|which|who|where|why|how|this|these|those|his|her|its|their|our|my|your|some|any|all|each|every|one|two|three|can|will|would|could|should|may|might|must|do|does|did|have|has|had|is|are|was|were|am|be|been|being)$/i.test(mergedSentence.trim())) {
                    break;
                }
            } else {
                // No continuation needed
                break;
            }
        }

        // Add the reconstructed sentence/line
        if (mergedSentence.trim().length > 0) {
            reconstructedLines.push(mergedSentence.trim());
        }

        i += linesToMerge;
    }

    const reconstructedText = reconstructedLines.join('\n');
    const sentencesMerged = lines.length - reconstructedLines.filter(line => line.trim().length > 0).length;

    console.log(`✅ Sentence reconstruction complete:`);
    console.log(`   Original lines: ${lines.length}`);
    console.log(`   Reconstructed lines: ${reconstructedLines.length}`);
    console.log(`   Sentences merged: ${sentencesMerged}`);

    return reconstructedText;
}

/**
 * Fixed logical paragraph detection (same as before)
 */
function detectLogicalParagraphs(reconstructedText) {
    console.log(`📝 Detecting logical paragraph boundaries...`);

    const lines = reconstructedText.split('\n');
    console.log(`📊 Found ${lines.length} reconstructed lines`);

    const logicalParagraphs = [];
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip completely empty lines - they indicate paragraph breaks
        if (line.length === 0) {
            if (currentParagraph.length > 0) {
                const paragraphText = currentParagraph.join(' ').trim();
                if (paragraphText.length > 20) {
                    logicalParagraphs.push(paragraphText);
                }
                currentParagraph = [];
            }
            continue;
        }

        const prevLine = currentParagraph.length > 0 ? currentParagraph[currentParagraph.length - 1] : '';

        // Check for logical paragraph boundary indicators
        const isNewParagraph = (
            // Line starts with capital and previous line ended with sentence punctuation
            (/^[A-Z]/.test(line) && /[.!?]$/.test(prevLine.trim())) ||
            // Line looks like a heading (short, mostly capitals, or title case)
            (line.length < 50 && (/^[A-Z\s]+$/.test(line) || /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(line))) ||
            // Line starts with special markers
            /^(Chapter|CHAPTER|Figure|Fig\.|Table|[IVX]+\.|\d+\.)/.test(line)
        );

        if (isNewParagraph && currentParagraph.length > 0) {
            // End current paragraph and start new one
            const paragraphText = currentParagraph.join(' ').trim();
            if (paragraphText.length > 20) {
                logicalParagraphs.push(paragraphText);
            }
            currentParagraph = [line];
        } else {
            // Continue current paragraph
            currentParagraph.push(line);
        }
    }

    // Don't forget the last paragraph
    if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ').trim();
        if (paragraphText.length > 20) {
            logicalParagraphs.push(paragraphText);
        }
    }

    console.log(`✅ Found ${logicalParagraphs.length} logical paragraphs`);
    return logicalParagraphs;
}

/**
 * Test the sentence reconstruction on Introduction chapter
 */
async function testSentenceReconstruction() {
    console.log('🧪 Testing sentence reconstruction + paragraph detection...\n');

    try {
        // Read the raw introduction chapter text
        const rawTextPath = path.join(__dirname, 'output', 'introduction-chapter-raw.txt');

        if (!fs.existsSync(rawTextPath)) {
            console.error('❌ Raw introduction text file not found.');
            return;
        }

        const rawFileContent = fs.readFileSync(rawTextPath, 'utf8');

        // Skip the header comments and find the actual content
        const lines = rawFileContent.split('\n');
        const contentStartIndex = lines.findIndex(line => line.includes('========================================'));
        const originalChapterText = lines.slice(contentStartIndex + 2).join('\n');

        console.log(`📊 Original chapter text: ${originalChapterText.length} characters, ${originalChapterText.split('\n').length} lines`);

        // Step 1: Reconstruct sentences split across pages
        const reconstructedText = reconstructSentences(originalChapterText);

        // Step 2: Apply logical paragraph detection
        const logicalParagraphs = detectLogicalParagraphs(reconstructedText);

        // Step 3: Create paragraph objects
        const paragraphObjects = logicalParagraphs.map((text, index) => {
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

        // Analysis
        const validParagraphs = paragraphObjects.filter(p =>
            p.startsWithCapital && p.endsWithPunctuation && p.wordCount >= 50 && p.wordCount <= 500
        );

        console.log(`\n📊 RESULTS WITH SENTENCE RECONSTRUCTION:`);
        console.log(`   Total paragraphs: ${paragraphObjects.length}`);
        console.log(`   Valid paragraphs: ${validParagraphs.length} (${Math.round(validParagraphs.length / paragraphObjects.length * 100)}%)`);
        console.log(`   Average word count: ${Math.round(paragraphObjects.reduce((sum, p) => sum + p.wordCount, 0) / paragraphObjects.length)}`);

        // Show first few paragraphs to verify improvement
        console.log(`\n📖 First 5 paragraphs after sentence reconstruction:`);
        paragraphObjects.slice(0, 5).forEach((paragraph, index) => {
            const compliance = [];
            if (paragraph.startsWithCapital) compliance.push('✅ Capital');
            else compliance.push('❌ Capital');

            if (paragraph.endsWithPunctuation) compliance.push('✅ Punctuation');
            else compliance.push('❌ Punctuation');

            console.log(`\nParagraph ${index + 1} (${paragraph.wordCount} words):`);
            console.log(`Compliance: ${compliance.join(' | ')}`);
            console.log(`"${paragraph.text.slice(0, 200)}${paragraph.text.length > 200 ? '...' : ''}"`);
        });

        // Save results
        const outputPath = path.join(__dirname, 'output', 'introduction-paragraphs-sentence-reconstructed.txt');
        let output = `# Introduction Chapter - WITH SENTENCE RECONSTRUCTION\n`;
        output += `# Generated: ${new Date().toISOString()}\n`;
        output += `# Total Paragraphs: ${paragraphObjects.length}\n`;
        output += `# Valid Paragraphs: ${validParagraphs.length}\n`;
        output += `# Step 1: Sentence reconstruction (merge split sentences)\n`;
        output += `# Step 2: Logical paragraph detection\n\n`;

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
        console.log(`\n💾 Results saved to: ${outputPath}`);

        return paragraphObjects;

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    testSentenceReconstruction().catch(console.error);
}

module.exports = { reconstructSentences, detectLogicalParagraphs, testSentenceReconstruction }; 