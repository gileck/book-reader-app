const fs = require('fs');
const path = require('path');

/**
 * IMPROVED sentence reconstruction with more aggressive merging
 */
function improvedSentenceReconstruction(rawText) {
    console.log(`🔧 IMPROVED sentence reconstruction...`);

    const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    console.log(`📊 Processing ${lines.length} lines...`);

    const mergedLines = [];
    let i = 0;

    while (i < lines.length) {
        let currentLine = lines[i].trim();

        // Skip empty lines - preserve as paragraph boundaries
        if (currentLine.length === 0) {
            mergedLines.push('');
            i++;
            continue;
        }

        // Skip page numbers and very short fragments
        if (/^\d+$/.test(currentLine) || currentLine.length < 3) {
            i++;
            continue;
        }

        // Start building a complete sentence/paragraph
        let completeText = currentLine;
        let lookahead = 1;

        // Keep merging until we have a complete sentence
        while (i + lookahead < lines.length) {
            const nextLine = lines[i + lookahead].trim();

            // Stop at empty line (paragraph boundary)
            if (nextLine.length === 0) {
                break;
            }

            // Skip page numbers
            if (/^\d+$/.test(nextLine)) {
                lookahead++;
                continue;
            }

            // Check if we should merge this line
            const shouldMerge = (
                // Current text doesn't end with sentence-ending punctuation
                !/[.!?]$/.test(completeText.trim()) ||

                // Next line starts with lowercase (clear continuation)
                /^[a-z]/.test(nextLine) ||

                // Current text ends with incomplete patterns
                /\b(the|and|of|to|in|on|at|for|with|by|from|as|a|an|but|or|so|if|when|that|which|who|where|why|how|this|these|those|his|her|its|their|our|my|your|some|any|all|each|every|one|two|three|can|will|would|could|should|may|might|must|do|does|did|have|has|had|is|are|was|were|am|be|been|being|into|onto)$/i.test(completeText.trim()) ||

                // Current text ends with punctuation that suggests continuation
                /[,:;–—-]$/.test(completeText.trim()) ||

                // Next line starts with continuation words
                /^(and|or|but|so|yet|for|nor|the|of|to|in|on|at|with|by|from|as|that|which|who|where|when|why|how|this|these|those|into|onto|down|up|over|under|through|across|around|between|among|before|after|during|since|until|while|because|although|though|unless|except|despite|regarding|concerning|according|including|excluding|containing|following|preceding|surrounding|involving|affecting|reflecting|representing|indicating|suggesting|demonstrating|establishing|maintaining|creating|producing|providing|ensuring|allowing|enabling|preventing|avoiding|reducing|increasing|improving|enhancing|supporting|promoting|encouraging|facilitating|contributing|leading|resulting|causing|generating|triggering|initiating|developing|building|forming|shaping|influencing|determining|defining|characterizing|distinguishing|identifying|recognizing|acknowledging|understanding|explaining|describing|illustrating|clarifying|emphasizing|highlighting|revealing|showing|demonstrating|proving|confirming|supporting|justifying|validating|verifying|establishing|maintaining|preserving|protecting|defending|securing|ensuring|guaranteeing|promising|committing|dedicating|devoting|focusing|concentrating|specializing|targeting|addressing|tackling|handling|managing|controlling|directing|guiding|leading|coordinating|organizing|arranging|planning|preparing|developing|implementing|executing|performing|conducting|carrying|proceeding|continuing|advancing|progressing|moving|shifting|changing|transforming|converting|adapting|adjusting|modifying|altering|revising|updating|upgrading|improving|enhancing|optimizing|maximizing|minimizing|balancing|stabilizing|normalizing|standardizing|regulating|monitoring|tracking|measuring|evaluating|assessing|analyzing|examining|investigating|exploring|discovering|uncovering|revealing|exposing|identifying|detecting|locating|finding|searching|seeking|looking|observing|watching|noting|noticing|recognizing|realizing|understanding|comprehending|grasping|appreciating|acknowledging|accepting|embracing|welcoming|encouraging|supporting|promoting|advocating|endorsing|recommending|suggesting|proposing|offering|providing|supplying|delivering|presenting|introducing|launching|initiating|starting|beginning|commencing|opening|establishing|founding|creating|forming|building|constructing|developing|designing|planning|organizing|structuring|arranging|coordinating|managing|operating|running|maintaining|sustaining|preserving|protecting|safeguarding|securing|defending|supporting|backing|reinforcing|strengthening|fortifying|consolidating|solidifying|stabilizing|balancing|harmonizing|synchronizing|aligning|coordinating|integrating|combining|merging|uniting|joining|connecting|linking|relating|associating|correlating|comparing|contrasting|distinguishing|differentiating|separating|dividing|splitting|breaking|cutting|reducing|decreasing|diminishing|limiting|restricting|constraining|controlling|regulating|governing|ruling|directing|guiding|leading|commanding|ordering|instructing|teaching|training|educating|informing|notifying|alerting|warning|advising|counseling|consulting|recommending|suggesting|proposing|requesting|asking|inquiring|questioning|challenging|testing|examining|evaluating|assessing|judging|criticizing|reviewing|analyzing|studying|researching|investigating|exploring|surveying|polling|sampling|measuring|calculating|computing|processing|handling|treating|dealing|coping|managing|solving|resolving|addressing|tackling|approaching|attacking|confronting|facing|meeting|encountering|experiencing|undergoing|suffering|enduring|tolerating|accepting|embracing|welcoming|celebrating|enjoying|appreciating|valuing|treasuring|cherishing|loving|adoring|admiring|respecting|honoring|revering|worshiping|praising|glorifying|exalting|elevating|promoting|advancing|supporting|helping|assisting|aiding|serving|benefiting|favoring|preferring|choosing|selecting|picking|opting|deciding|determining|concluding|finishing|completing|ending|terminating|stopping|ceasing|halting|pausing|resting|waiting|staying|remaining|continuing|persisting|persevering|enduring|lasting|surviving|thriving|flourishing|prospering|succeeding|achieving|accomplishing|attaining|reaching|arriving|coming|going|moving|traveling|journeying|proceeding|advancing|progressing|developing|growing|expanding|extending|spreading|distributing|sharing|communicating|expressing|conveying|transmitting|transferring|delivering|sending|giving|offering|providing|supplying|contributing|donating|sacrificing|dedicating|devoting|committing|pledging|promising|guaranteeing|ensuring|securing|protecting|defending|supporting|maintaining|preserving|conserving|saving|storing|keeping|holding|retaining|maintaining|sustaining|nourishing|feeding|fueling|powering|energizing|activating|stimulating|motivating|inspiring|encouraging|promoting|advancing|developing|improving|enhancing|optimizing|perfecting|refining|polishing|finishing|completing|concluding|summarizing|wrapping)$/i.test(nextLine)
            );

            if (shouldMerge) {
                completeText += ' ' + nextLine;
                lookahead++;

                // If we now have a proper sentence ending AND reasonable length, we can stop
                if (/[.!?]$/.test(completeText.trim()) && completeText.length > 100) {
                    // But only stop if the next line doesn't start with lowercase (which would indicate continuation)
                    if (i + lookahead < lines.length) {
                        const followingLine = lines[i + lookahead].trim();
                        if (followingLine.length > 0 && !/^[a-z]/.test(followingLine)) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            } else {
                // No need to merge
                break;
            }
        }

        // Add the reconstructed text if it's substantial
        if (completeText.trim().length > 10) {
            mergedLines.push(completeText.trim());
        }

        i += lookahead;
    }

    const reconstructedText = mergedLines.join('\n');
    const reduction = lines.length - mergedLines.filter(line => line.trim().length > 0).length;

    console.log(`✅ IMPROVED reconstruction complete:`);
    console.log(`   Original lines: ${lines.length}`);
    console.log(`   Final lines: ${mergedLines.length}`);
    console.log(`   Lines merged: ${reduction}`);

    return reconstructedText;
}

/**
 * Same logical paragraph detection as before
 */
function detectLogicalParagraphs(reconstructedText) {
    console.log(`📝 Detecting logical paragraph boundaries...`);

    const lines = reconstructedText.split('\n');
    const logicalParagraphs = [];
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

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

        const isNewParagraph = (
            (/^[A-Z]/.test(line) && /[.!?]$/.test(prevLine.trim())) ||
            (line.length < 50 && (/^[A-Z\s]+$/.test(line) || /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(line))) ||
            /^(Chapter|CHAPTER|Figure|Fig\.|Table|[IVX]+\.|\d+\.)/.test(line)
        );

        if (isNewParagraph && currentParagraph.length > 0) {
            const paragraphText = currentParagraph.join(' ').trim();
            if (paragraphText.length > 20) {
                logicalParagraphs.push(paragraphText);
            }
            currentParagraph = [line];
        } else {
            currentParagraph.push(line);
        }
    }

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
 * Test the improved reconstruction
 */
async function testImprovedReconstruction() {
    console.log('🧪 Testing IMPROVED sentence reconstruction...\n');

    try {
        const rawTextPath = path.join(__dirname, 'output', 'introduction-chapter-raw.txt');
        const rawFileContent = fs.readFileSync(rawTextPath, 'utf8');
        const lines = rawFileContent.split('\n');
        const contentStartIndex = lines.findIndex(line => line.includes('========================================'));
        const originalChapterText = lines.slice(contentStartIndex + 2).join('\n');

        console.log(`📊 Original: ${originalChapterText.length} chars, ${originalChapterText.split('\n').length} lines`);

        // IMPROVED reconstruction
        const reconstructedText = improvedSentenceReconstruction(originalChapterText);
        const logicalParagraphs = detectLogicalParagraphs(reconstructedText);

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

        const validParagraphs = paragraphObjects.filter(p =>
            p.startsWithCapital && p.endsWithPunctuation && p.wordCount >= 50 && p.wordCount <= 500
        );

        console.log(`\n📊 IMPROVED RESULTS:`);
        console.log(`   Total paragraphs: ${paragraphObjects.length}`);
        console.log(`   Valid paragraphs: ${validParagraphs.length} (${Math.round(validParagraphs.length / paragraphObjects.length * 100)}%)`);
        console.log(`   Average word count: ${Math.round(paragraphObjects.reduce((sum, p) => sum + p.wordCount, 0) / paragraphObjects.length)}`);

        // Check for the specific issue the user mentioned
        console.log(`\n🔍 Checking for sentence reconstruction success:`);
        const cellParagraphs = paragraphObjects.filter(p => p.text.includes('cell') && p.text.includes('shrink'));
        if (cellParagraphs.length > 0) {
            console.log(`   Found cell/shrink paragraph: ${cellParagraphs[0].text.slice(0, 150)}...`);
            if (cellParagraphs[0].text.includes('If you shrink yourself down to the size of a molecule')) {
                console.log(`   ✅ SUCCESS: Sentence properly reconstructed!`);
            } else {
                console.log(`   ❌ STILL SPLIT: Needs more work`);
            }
        }

        // Show first few paragraphs
        console.log(`\n📖 First 3 paragraphs with IMPROVED reconstruction:`);
        paragraphObjects.slice(0, 3).forEach((paragraph, index) => {
            const compliance = [];
            if (paragraph.startsWithCapital) compliance.push('✅ Capital');
            else compliance.push('❌ Capital');

            if (paragraph.endsWithPunctuation) compliance.push('✅ Punctuation');
            else compliance.push('❌ Punctuation');

            console.log(`\nParagraph ${index + 1} (${paragraph.wordCount} words):`);
            console.log(`Compliance: ${compliance.join(' | ')}`);
            console.log(`"${paragraph.text.slice(0, 200)}${paragraph.text.length > 200 ? '...' : ''}"`);
        });

        // Save improved results
        const outputPath = path.join(__dirname, 'output', 'introduction-paragraphs-IMPROVED.txt');
        let output = `# Introduction Chapter - IMPROVED SENTENCE RECONSTRUCTION\n`;
        output += `# Generated: ${new Date().toISOString()}\n`;
        output += `# Total Paragraphs: ${paragraphObjects.length}\n`;
        output += `# Valid Paragraphs: ${validParagraphs.length}\n`;
        output += `# Improvement: Aggressive sentence merging before paragraph detection\n\n`;

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
        console.log(`\n💾 IMPROVED results saved to: ${outputPath}`);

        return paragraphObjects;

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

if (require.main === module) {
    testImprovedReconstruction().catch(console.error);
}

module.exports = { improvedSentenceReconstruction, detectLogicalParagraphs, testImprovedReconstruction }; 