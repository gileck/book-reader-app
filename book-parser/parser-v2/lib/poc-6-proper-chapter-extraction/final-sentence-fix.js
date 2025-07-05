const fs = require('fs');
const path = require('path');

/**
 * FINAL FIX: Ultra-aggressive sentence reconstruction
 * Rule: If a line doesn't end with .!? it MUST be continued on the next line
 */
function finalSentenceFix(rawText) {
    console.log(`🎯 FINAL sentence reconstruction - ultra aggressive...`);

    const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    console.log(`📊 Processing ${lines.length} lines...`);

    const completeSentences = [];
    let currentSentence = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines - they mark paragraph boundaries
        if (line.length === 0) {
            // If we have an incomplete sentence, finish it
            if (currentSentence.trim().length > 0) {
                completeSentences.push(currentSentence.trim());
                currentSentence = '';
            }
            // Add empty line to preserve paragraph breaks
            completeSentences.push('');
            continue;
        }

        // Skip page numbers
        if (/^\d+$/.test(line)) {
            continue;
        }

        // Skip very short fragments (likely headers or artifacts)
        if (line.length < 5) {
            continue;
        }

        // Add to current sentence
        if (currentSentence.length === 0) {
            currentSentence = line;
        } else {
            currentSentence += ' ' + line;
        }

        // Check if this completes a sentence
        // A sentence is complete if it ends with .!? AND is reasonably long
        if (/[.!?]$/.test(currentSentence.trim()) && currentSentence.length > 50) {
            completeSentences.push(currentSentence.trim());
            currentSentence = '';
        }

        // Safety valve: if sentence gets too long (over 2000 chars), force completion
        if (currentSentence.length > 2000) {
            completeSentences.push(currentSentence.trim());
            currentSentence = '';
        }
    }

    // Don't forget the last sentence
    if (currentSentence.trim().length > 0) {
        completeSentences.push(currentSentence.trim());
    }

    const reconstructedText = completeSentences.join('\n');
    const originalLineCount = lines.filter(line => line.trim().length > 0).length;
    const finalLineCount = completeSentences.filter(line => line.trim().length > 0).length;

    console.log(`✅ FINAL reconstruction complete:`);
    console.log(`   Original content lines: ${originalLineCount}`);
    console.log(`   Final sentences: ${finalLineCount}`);
    console.log(`   Lines merged: ${originalLineCount - finalLineCount}`);

    return reconstructedText;
}

/**
 * Apply logical paragraph detection to the fixed sentences
 */
function detectParagraphsFromSentences(reconstructedText) {
    console.log(`📝 Detecting paragraphs from complete sentences...`);

    const sentences = reconstructedText.split('\n');
    const paragraphs = [];
    let currentParagraph = [];

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();

        // Empty line = paragraph break
        if (sentence.length === 0) {
            if (currentParagraph.length > 0) {
                const paragraphText = currentParagraph.join(' ').trim();
                if (paragraphText.length > 30) {  // Minimum paragraph size
                    paragraphs.push(paragraphText);
                }
                currentParagraph = [];
            }
            continue;
        }

        // Check if this sentence starts a new paragraph
        const prevSentence = currentParagraph.length > 0 ? currentParagraph[currentParagraph.length - 1] : '';
        const isNewParagraph = (
            // Clear paragraph starters (chapter headers, etc.)
            /^(Chapter|CHAPTER|Figure|Fig\.|Table|[IVX]+\.|\d+\.)/.test(sentence) ||

            // Title-case headings (short lines with capitals)
            (sentence.length < 60 && /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(sentence)) ||

            // All-caps headings
            (sentence.length < 50 && /^[A-Z\s]+$/.test(sentence)) ||

            // New sentence after a completed previous sentence (both end with punctuation)
            (currentParagraph.length > 0 &&
                /[.!?]$/.test(prevSentence.trim()) &&
                /^[A-Z]/.test(sentence) &&
                sentence.length > 30)  // Don't break on short sentences
        );

        if (isNewParagraph && currentParagraph.length > 0) {
            // Finish current paragraph
            const paragraphText = currentParagraph.join(' ').trim();
            if (paragraphText.length > 30) {
                paragraphs.push(paragraphText);
            }
            currentParagraph = [sentence];
        } else {
            // Continue current paragraph
            currentParagraph.push(sentence);
        }
    }

    // Don't forget the last paragraph
    if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ').trim();
        if (paragraphText.length > 30) {
            paragraphs.push(paragraphText);
        }
    }

    console.log(`✅ Found ${paragraphs.length} logical paragraphs from complete sentences`);
    return paragraphs;
}

/**
 * Test the final fix
 */
async function testFinalFix() {
    console.log('🎯 Testing FINAL sentence reconstruction fix...\n');

    try {
        const rawTextPath = path.join(__dirname, 'output', 'introduction-chapter-raw.txt');
        const rawFileContent = fs.readFileSync(rawTextPath, 'utf8');
        const lines = rawFileContent.split('\n');
        const contentStartIndex = lines.findIndex(line => line.includes('========================================'));
        const originalChapterText = lines.slice(contentStartIndex + 2).join('\n');

        console.log(`📊 Original: ${originalChapterText.length} chars, ${originalChapterText.split('\n').length} lines`);

        // Apply FINAL fix
        const fixedText = finalSentenceFix(originalChapterText);
        const paragraphs = detectParagraphsFromSentences(fixedText);

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

        console.log(`\n📊 FINAL RESULTS:`);
        console.log(`   Total paragraphs: ${paragraphObjects.length}`);
        console.log(`   Valid paragraphs: ${validParagraphs.length} (${Math.round(validParagraphs.length / paragraphObjects.length * 100)}%)`);
        console.log(`   Average word count: ${Math.round(paragraphObjects.reduce((sum, p) => sum + p.wordCount, 0) / paragraphObjects.length)}`);

        // SPECIFICALLY CHECK for the "shrink yourself" issue
        console.log(`\n🔍 Checking for the 'shrink yourself' sentence fix:`);
        const shrinkParagraph = paragraphObjects.find(p => p.text.includes('shrink yourself'));
        if (shrinkParagraph) {
            console.log(`   Found paragraph: "${shrinkParagraph.text.slice(0, 100)}..."`);
            if (shrinkParagraph.text.includes('shrink yourself down to the size of a molecule')) {
                console.log(`   ✅ SUCCESS: Sentence fully reconstructed!`);
            } else if (shrinkParagraph.text.includes('shrink yourself') && !shrinkParagraph.text.includes('down to the size')) {
                console.log(`   ❌ STILL BROKEN: Sentence still split`);
            }
        } else {
            console.log(`   ❓ No 'shrink yourself' paragraph found`);
        }

        // Show key paragraphs
        console.log(`\n📖 Key paragraphs to verify fix:`);
        const cellParagraphs = paragraphObjects.filter(p => p.text.toLowerCase().includes('cell'));
        cellParagraphs.slice(0, 3).forEach((paragraph, index) => {
            console.log(`\nCell Paragraph ${index + 1} (${paragraph.wordCount} words):`);
            console.log(`Starts with capital: ${paragraph.startsWithCapital ? '✅' : '❌'}`);
            console.log(`Ends with punctuation: ${paragraph.endsWithPunctuation ? '✅' : '❌'}`);
            console.log(`"${paragraph.text.slice(0, 150)}..."`);
        });

        // Save final results
        const outputPath = path.join(__dirname, 'output', 'introduction-paragraphs-FINAL.txt');
        let output = `# Introduction Chapter - FINAL SENTENCE FIX\n`;
        output += `# Generated: ${new Date().toISOString()}\n`;
        output += `# Total Paragraphs: ${paragraphObjects.length}\n`;
        output += `# Valid Paragraphs: ${validParagraphs.length}\n`;
        output += `# Method: Ultra-aggressive sentence merging (no line ends without .!?)\n\n`;

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
        console.log(`\n💾 FINAL results saved to: ${outputPath}`);

        return paragraphObjects;

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

if (require.main === module) {
    testFinalFix().catch(console.error);
}

module.exports = { finalSentenceFix, detectParagraphsFromSentences, testFinalFix }; 