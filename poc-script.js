const fs = require('fs');
const path = require('path');

class ParagraphDetector {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    loadInputData() {
        console.log('Loading input data...');

        // Load reconstructed text from POC-4 (instead of raw text from POC-1)
        const textPath = path.join(__dirname, '../poc-4-cross-page-reconstruction/output/reconstructed-text.txt');
        if (!fs.existsSync(textPath)) {
            throw new Error(`Reconstructed text file not found: ${textPath}. Run POC-4 first.`);
        }
        const rawText = fs.readFileSync(textPath, 'utf8');
        const textLines = rawText.split('\n');

        // Load chapter boundaries from POC-2 (updated to use POC-4 input)
        const chapterPath = path.join(__dirname, '../poc-2-chapter-detection/output/poc-results.json');
        const chapterData = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));

        return {
            textLines,
            chapterBoundaries: this.extractChapterBoundaries(chapterData)
        };
    }

    extractChapterBoundaries(chapterData) {
        // Get validated chapters from POC-2
        const patternBased = chapterData.algorithms.find(alg => alg.name === 'Pattern-Based');
        if (!patternBased || !patternBased.validatedChapters) {
            throw new Error('No validated chapters found in POC-2 data');
        }

        const chapters = patternBased.validatedChapters.map(chapter => ({
            title: chapter.title,
            chapterNumber: chapter.chapterNumber,
            startLine: chapter.lineNumber,
            confidence: chapter.confidence
        }));

        // Sort by line number and add end boundaries
        chapters.sort((a, b) => a.startLine - b.startLine);

        for (let i = 0; i < chapters.length - 1; i++) {
            chapters[i].endLine = chapters[i + 1].startLine - 1;
        }

        // Set last chapter end to end of document
        if (chapters.length > 0) {
            chapters[chapters.length - 1].endLine = 13140; // Total lines from text
        }

        console.log(`Found ${chapters.length} validated chapters`);

        return chapters;
    }

    detectParagraphs(chapterContent) {
        // Split on double newlines to identify paragraph boundaries
        const rawParagraphs = chapterContent.split(/\n\s*\n/);

        const paragraphs = [];

        for (const segment of rawParagraphs) {
            const trimmed = segment.trim();
            if (trimmed.length === 0) continue;

            // Filter out artifacts and page markers
            const lines = trimmed.split('\n').filter(line => {
                const clean = line.trim();
                // Skip page markers, standalone numbers, and very short lines
                return clean.length > 10 &&
                    !clean.match(/^\[PAGE \d+\]$/) &&
                    !clean.match(/^\d+$/) &&
                    !clean.match(/^[IVX]+$/) && // Roman numerals
                    clean.length < 1000; // Skip overly long lines
            });

            if (lines.length === 0) continue;

            // Join lines within paragraph
            const paragraphText = lines.join(' ').replace(/\s+/g, ' ').trim();

            if (paragraphText.length > 50) { // Minimum paragraph length
                paragraphs.push({
                    text: paragraphText,
                    originalText: segment,
                    wordCount: paragraphText.split(/\s+/).length
                });
            }
        }

        return paragraphs;
    }

    classifyWordCount(wordCount) {
        if (wordCount < 50) return 'Short';
        if (wordCount < 100) return 'Medium';
        if (wordCount < 300) return 'Long';
        return 'VeryLong';
    }

    validateParagraph(paragraph) {
        const issues = [];
        const text = paragraph.text.trim();

        // FR-1 Validation Rules

        // 1. Must start with capital letter
        if (!/^[A-Z]/.test(text)) {
            issues.push('No capital start');
        }

        // 2. Must end with proper punctuation
        if (!/[.!?]$/.test(text)) {
            issues.push('No punctuation end');
        }

        // 3. Must be complete sentences (not ending mid-thought)
        if (text.endsWith(' ') ||
            /\b(and|but|or|the|a|an|of|to|in|on|at|by|for|with|from|up|upon|into|through|during|before|after|above|below|between|among|against|towards|across|around)$/i.test(text)) {
            issues.push('Incomplete sentences');
        }

        // 4. Word count should be reasonable (20-500 words)
        if (paragraph.wordCount < 20 || paragraph.wordCount > 500) {
            issues.push('Word count out of range');
        }

        return {
            compliant: issues.length === 0,
            issues: issues
        };
    }

    run() {
        console.log('=== POC-3: Paragraph Detection (Updated with POC-4) ===\n');

        const startTime = Date.now();

        try {
            const { textLines, chapterBoundaries } = this.loadInputData();
            console.log(`Loaded ${textLines.length} lines of reconstructed text from POC-4`);

            const allResults = [];
            const validationResults = [];
            let totalParagraphs = 0;

            console.log(`\nProcessing ${chapterBoundaries.length} chapters for paragraph detection...\n`);

            chapterBoundaries.forEach((chapter, index) => {
                const chapterLines = textLines.slice(chapter.startLine - 1, chapter.endLine);
                const chapterContent = chapterLines.join('\n');
                const paragraphs = this.detectParagraphs(chapterContent);

                // Calculate statistics
                const characterCount = chapterContent.length;
                const avgWordsPerParagraph = paragraphs.length > 0 ?
                    Math.round(paragraphs.reduce((sum, p) => sum + p.wordCount, 0) / paragraphs.length) : 0;

                const wordCountDistribution = {
                    Short: 0, Medium: 0, Long: 0, VeryLong: 0
                };

                paragraphs.forEach(p => {
                    const category = this.classifyWordCount(p.wordCount);
                    wordCountDistribution[category]++;
                });

                const distributionString = Object.entries(wordCountDistribution)
                    .map(([key, value]) => `${key}(${value})`)
                    .join(' ');

                console.log(`Processing Chapter ${index + 1}: "${chapter.title}"`);
                console.log(`  Lines: ${chapter.startLine}-${chapter.endLine} (${chapter.endLine - chapter.startLine + 1} lines)`);
                console.log(`  Characters: ${characterCount.toLocaleString()}`);
                console.log(`  Paragraphs detected: ${paragraphs.length}`);
                console.log(`  Average words per paragraph: ${avgWordsPerParagraph}`);
                console.log(`  Word count distribution: ${distributionString}\n`);

                const chapterResult = {
                    id: index + 1,
                    title: chapter.title,
                    chapterNumber: chapter.chapterNumber,
                    startLine: chapter.startLine,
                    endLine: chapter.endLine,
                    lineCount: chapter.endLine - chapter.startLine + 1,
                    characterCount: characterCount,
                    paragraphs: paragraphs.map((p, pIndex) => ({
                        index: pIndex + 1,
                        text: p.text,
                        originalText: p.originalText,
                        wordCount: p.wordCount,
                        wordCountCategory: this.classifyWordCount(p.wordCount)
                    }))
                };

                allResults.push(chapterResult);
                totalParagraphs += paragraphs.length;

                // Validate sample paragraphs for FR-1 compliance
                const sampleParagraphs = paragraphs.slice(0, 3); // First 3 paragraphs
                sampleParagraphs.forEach((paragraph, pIndex) => {
                    const validation = this.validateParagraph(paragraph);
                    validationResults.push({
                        chapter: chapter.title,
                        paragraphIndex: pIndex + 1,
                        compliant: validation.compliant,
                        issues: validation.issues
                    });
                });
            });

            // Save outputs
            const summary = {
                totalChapters: chapterBoundaries.length,
                totalParagraphs: totalParagraphs,
                processingTime: new Date().toISOString(),
                inputSource: 'POC-4 Reconstructed Text'
            };

            const fullResults = {
                summary: summary,
                chapters: allResults
            };

            const fullPath = path.join(this.outputDir, 'poc-results.json');
            fs.writeFileSync(fullPath, JSON.stringify(fullResults, null, 2));
            console.log(`Full results saved to: ${fullPath}`);

            const samplePath = path.join(this.outputDir, 'sample-results.json');
            const sampleResults = {
                summary: summary,
                sampleChapters: allResults.slice(0, 3).map(chapter => ({
                    ...chapter,
                    paragraphs: chapter.paragraphs.slice(0, 2)
                }))
            };
            fs.writeFileSync(samplePath, JSON.stringify(sampleResults, null, 2));
            console.log(`Sample results saved to: ${samplePath}`);

            const statsPath = path.join(this.outputDir, 'summary-statistics.json');
            const stats = {
                totalChapters: chapterBoundaries.length,
                totalParagraphs: totalParagraphs,
                averageParagraphsPerChapter: Math.round(totalParagraphs / chapterBoundaries.length),
                processingTime: Date.now() - startTime,
                inputSource: 'POC-4 Reconstructed Text'
            };
            fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
            console.log(`Summary statistics saved to: ${statsPath}`);

            // Save introduction paragraphs for inspection (UPDATED)
            const introChapter = allResults.find(c =>
                c.title.toLowerCase().includes('introduction') ||
                c.title.toLowerCase().includes('life itself')
            );

            if (introChapter) {
                const introText = this.generateIntroductionText(introChapter);
                const introPath = path.join(this.outputDir, 'introduction-paragraphs.txt');
                fs.writeFileSync(introPath, introText);
                console.log(`UPDATED introduction paragraphs saved to: ${introPath}`);
            } else {
                console.log('Warning: INTRODUCTION chapter not found, using first chapter');
                const firstChapter = allResults[0];
                if (firstChapter) {
                    const introText = this.generateIntroductionText(firstChapter, 'FIRST CHAPTER');
                    const introPath = path.join(this.outputDir, 'introduction-paragraphs.txt');
                    fs.writeFileSync(introPath, introText);
                    console.log(`First chapter paragraphs saved to: ${introPath}`);
                }
            }

            // Validation summary
            const compliantCount = validationResults.filter(r => r.compliant).length;
            const complianceRate = (compliantCount / validationResults.length * 100).toFixed(1);

            console.log('\n=== Validation Results (with POC-4 Input) ===');
            console.log(`Sample paragraphs validated: ${validationResults.length}`);
            console.log(`FR-1 compliant paragraphs: ${compliantCount}`);
            console.log(`Compliance rate: ${complianceRate}%`);

            const nonCompliantResults = validationResults.filter(r => !r.compliant);
            if (nonCompliantResults.length > 0) {
                console.log('\nValidation Issues Found:');
                nonCompliantResults.forEach(result => {
                    console.log(`  Chapter "${result.chapter}", Paragraph ${result.paragraphIndex}: ${result.issues.join(', ')}`);
                });
            }

            const endTime = Date.now();
            console.log(`\n=== POC-3 Complete (Updated) ===`);
            console.log(`Total processing time: ${endTime - startTime}ms`);
            console.log(`Total chapters processed: ${chapterBoundaries.length}`);
            console.log(`Total paragraphs detected: ${totalParagraphs}`);
            console.log(`Average paragraphs per chapter: ${Math.round(totalParagraphs / chapterBoundaries.length)}`);
            console.log(`Input source: POC-4 Reconstructed Text`);

        } catch (error) {
            console.error('Error in POC-3:', error.message);
            process.exit(1);
        }
    }

    generateIntroductionText(chapter, headerType = 'INTRODUCTION') {
        const header = `${headerType} CHAPTER - RAW PARAGRAPHS (UPDATED WITH POC-4)
======================================

Chapter: ${chapter.title}
Total Paragraphs: ${chapter.paragraphs.length}
Word Count: ${chapter.paragraphs.reduce((sum, p) => sum + p.wordCount, 0)}
Generated: ${new Date().toISOString()}
Input Source: POC-4 Reconstructed Text

======================================

`;

        const paragraphsText = chapter.paragraphs.map((p, index) =>
            `[Paragraph ${index + 1}]\n${p.text}\n`
        ).join('\n');

        return header + paragraphsText;
    }
}

// Run the POC
const detector = new ParagraphDetector();
detector.run(); 