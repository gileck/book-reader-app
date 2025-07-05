const fs = require('fs');
const path = require('path');

class CrossPageReconstructor {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    loadRawText() {
        const textPath = path.join(__dirname, '../poc-1-text-extraction/output/pdf-parse-raw-text.txt');
        if (!fs.existsSync(textPath)) {
            throw new Error(`Raw text file not found: ${textPath}`);
        }
        return fs.readFileSync(textPath, 'utf8');
    }

    identifyPageBreaks(lines) {
        const pageBreaks = [];

        lines.forEach((line, index) => {
            const trimmed = line.trim();

            // Standalone page number: just a number on its own line
            if (/^\d+$/.test(trimmed) && trimmed.length <= 4) {
                pageBreaks.push({
                    lineIndex: index,
                    pageNumber: parseInt(trimmed),
                    line: trimmed
                });
            }
        });

        console.log(`Identified ${pageBreaks.length} page breaks`);
        return pageBreaks;
    }

    needsSentenceReconstruction(line) {
        const trimmed = line.trim();
        if (trimmed.length === 0) return false;

        // Check if line ends with proper sentence punctuation
        const endsWithPunctuation = /[.!?]$/.test(trimmed);

        // Check if it looks like an incomplete sentence
        // (has words but no punctuation, and doesn't look like a header)
        const hasWords = /[a-zA-Z]/.test(trimmed);
        const looksLikeHeader = /^[A-Z\s]+$/.test(trimmed) && trimmed.length < 50;

        return hasWords && !endsWithPunctuation && !looksLikeHeader;
    }

    reconstructCrossPageSentences(rawText) {
        const lines = rawText.split('\n');
        const pageBreaks = this.identifyPageBreaks(lines);

        const reconstructions = [];
        const processedLines = [...lines]; // Copy to modify

        // Process each page break
        pageBreaks.forEach(pageBreak => {
            const pageLineIndex = pageBreak.lineIndex;

            // Look backward to find the previous non-empty line
            let prevLineIndex = pageLineIndex - 1;
            while (prevLineIndex >= 0 && processedLines[prevLineIndex].trim() === '') {
                prevLineIndex--;
            }

            // Look forward to find the next non-empty line
            let nextLineIndex = pageLineIndex + 1;
            while (nextLineIndex < processedLines.length && processedLines[nextLineIndex].trim() === '') {
                nextLineIndex++;
            }

            if (prevLineIndex >= 0 && nextLineIndex < processedLines.length) {
                const prevLine = processedLines[prevLineIndex];
                const nextLine = processedLines[nextLineIndex];

                // Check if previous line needs sentence reconstruction
                if (this.needsSentenceReconstruction(prevLine)) {
                    // Find where the sentence ends in the next line(s)
                    const sentenceCompletion = this.findSentenceCompletion(processedLines, nextLineIndex);

                    if (sentenceCompletion) {
                        const reconstruction = {
                            pageNumber: pageBreak.pageNumber,
                            prevLineIndex: prevLineIndex,
                            nextLineIndex: nextLineIndex,
                            originalPrevLine: prevLine,
                            originalNextLine: nextLine,
                            sentenceCompletion: sentenceCompletion.text,
                            endLineIndex: sentenceCompletion.endLineIndex,
                            reconstructedSentence: prevLine.trim() + ' ' + sentenceCompletion.text.trim()
                        };

                        reconstructions.push(reconstruction);

                        // Apply the reconstruction
                        processedLines[prevLineIndex] = reconstruction.reconstructedSentence;

                        // Remove the completed part from next lines
                        if (sentenceCompletion.endLineIndex === nextLineIndex) {
                            // Sentence ends in the same line, remove the used part
                            processedLines[nextLineIndex] = sentenceCompletion.remainingText;
                        } else {
                            // Sentence spans multiple lines, remove used lines
                            for (let i = nextLineIndex; i <= sentenceCompletion.endLineIndex; i++) {
                                processedLines[i] = '';
                            }
                            if (sentenceCompletion.remainingText.trim()) {
                                processedLines[sentenceCompletion.endLineIndex] = sentenceCompletion.remainingText;
                            }
                        }

                        // Keep page number with metadata marker
                        processedLines[pageLineIndex] = `[PAGE ${pageBreak.pageNumber}]`;
                    }
                }
            }
        });

        return {
            reconstructedText: processedLines.join('\n'),
            reconstructions: reconstructions,
            pageBreaks: pageBreaks,
            statistics: {
                totalPageBreaks: pageBreaks.length,
                successfulReconstructions: reconstructions.length,
                reconstructionRate: reconstructions.length / pageBreaks.length * 100
            }
        };
    }

    findSentenceCompletion(lines, startIndex) {
        let text = '';
        let currentIndex = startIndex;

        // Look for sentence completion across multiple lines
        while (currentIndex < lines.length) {
            const line = lines[currentIndex].trim();
            if (line === '') {
                currentIndex++;
                continue;
            }

            // Add this line to our completion text
            text += (text ? ' ' : '') + line;

            // Check if we've found sentence punctuation
            const punctuationMatch = text.match(/^(.*?[.!?])\s*(.*)$/);
            if (punctuationMatch) {
                return {
                    text: punctuationMatch[1], // Text up to and including punctuation
                    remainingText: punctuationMatch[2], // Text after punctuation
                    endLineIndex: currentIndex
                };
            }

            currentIndex++;

            // Safety: don't look too far (max 5 lines for sentence completion)
            if (currentIndex - startIndex > 5) break;
        }

        // If no punctuation found, return what we have
        if (text.trim()) {
            return {
                text: text,
                remainingText: '',
                endLineIndex: currentIndex - 1
            };
        }

        return null;
    }

    generateExamples(reconstructions) {
        // Show examples of reconstructions
        const examples = reconstructions.slice(0, 5).map(r => ({
            pageNumber: r.pageNumber,
            before: {
                prevLine: r.originalPrevLine.trim(),
                nextLine: r.originalNextLine.trim()
            },
            after: {
                reconstructed: r.reconstructedSentence.trim()
            },
            improvement: {
                beforeEndsWithPunctuation: /[.!?]$/.test(r.originalPrevLine.trim()),
                afterEndsWithPunctuation: /[.!?]$/.test(r.reconstructedSentence.trim())
            }
        }));

        return examples;
    }

    run() {
        console.log('=== POC-4: Cross-Page Sentence Reconstruction ===\n');

        const startTime = Date.now();

        try {
            // Load raw text
            console.log('Loading raw text from POC-1...');
            const rawText = this.loadRawText();
            const totalLines = rawText.split('\n').length;
            console.log(`Loaded ${totalLines} lines of text\n`);

            // Perform reconstruction
            console.log('Analyzing page breaks and reconstructing sentences...');
            const result = this.reconstructCrossPageSentences(rawText);

            console.log('\n=== RECONSTRUCTION RESULTS ===');
            console.log(`Total page breaks found: ${result.statistics.totalPageBreaks}`);
            console.log(`Successful reconstructions: ${result.statistics.successfulReconstructions}`);
            console.log(`Reconstruction rate: ${result.statistics.reconstructionRate.toFixed(1)}%`);

            // Generate examples
            const examples = this.generateExamples(result.reconstructions);
            console.log('\n=== RECONSTRUCTION EXAMPLES ===');
            examples.forEach((example, index) => {
                console.log(`\nExample ${index + 1} (Page ${example.pageNumber}):`);
                console.log(`BEFORE: "${example.before.prevLine}" → "${example.before.nextLine}"`);
                console.log(`AFTER:  "${example.after.reconstructed}"`);
                console.log(`Fixed punctuation: ${!example.improvement.beforeEndsWithPunctuation && example.improvement.afterEndsWithPunctuation ? '✅' : '❌'}`);
            });

            // Save outputs
            const reconstructedPath = path.join(this.outputDir, 'reconstructed-text.txt');
            fs.writeFileSync(reconstructedPath, result.reconstructedText);
            console.log(`\nReconstructed text saved to: ${reconstructedPath}`);

            const resultsPath = path.join(this.outputDir, 'reconstruction-results.json');
            fs.writeFileSync(resultsPath, JSON.stringify({
                statistics: result.statistics,
                reconstructions: result.reconstructions,
                pageBreaks: result.pageBreaks,
                examples: examples
            }, null, 2));
            console.log(`Reconstruction details saved to: ${resultsPath}`);

            // Save a sample comparison
            this.generateSampleComparison(rawText, result.reconstructedText);

            const endTime = Date.now();
            console.log(`\n=== POC-4 Complete ===`);
            console.log(`Processing time: ${endTime - startTime}ms`);
            console.log(`Ready for downstream processing (POC-2, POC-3)`);

        } catch (error) {
            console.error('Error in POC-4:', error.message);
            process.exit(1);
        }
    }

    generateSampleComparison(originalText, reconstructedText) {
        // Generate a focused comparison around the "shrink yourself" example
        const originalLines = originalText.split('\n');
        const reconstructedLines = reconstructedText.split('\n');

        // Find the line with "shrink yourself"
        const targetLineIndex = originalLines.findIndex(line =>
            line.includes('shrink yourself'));

        if (targetLineIndex !== -1) {
            const startLine = Math.max(0, targetLineIndex - 2);
            const endLine = Math.min(originalLines.length, targetLineIndex + 5);

            const comparison = {
                original: originalLines.slice(startLine, endLine),
                reconstructed: reconstructedLines.slice(startLine, endLine),
                lineRange: `${startLine + 1}-${endLine}`
            };

            const comparisonPath = path.join(this.outputDir, 'sample-comparison.json');
            fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));
            console.log(`Sample comparison saved to: ${comparisonPath}`);
        }
    }
}

// Run the POC
const reconstructor = new CrossPageReconstructor();
reconstructor.run(); 