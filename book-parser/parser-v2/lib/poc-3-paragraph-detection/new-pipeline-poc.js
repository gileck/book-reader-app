const fs = require('fs');
const path = require('path');

class ImprovedParagraphDetectionPOC {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    // Step 1: Load raw text (from POC 1)
    loadRawText() {
        const textPath = path.join(__dirname, '../poc-1-text-extraction/output/pdf-parse-raw-text.txt');
        if (!fs.existsSync(textPath)) {
            throw new Error(`Raw text file not found: ${textPath}`);
        }
        return fs.readFileSync(textPath, 'utf8');
    }

    // Step 2: Extract clean chapters (filtering out TOC/copyright)
    extractCleanChapters(rawText) {
        const lines = rawText.split('\n');

        // Find actual content start (skip TOC, copyright, etc.)
        const contentStartPatterns = [
            /^INTRODUCTION/i,
            /^Chapter\s+\d+/i,
            /^DISCOVERING THE NANOCOSM/i
        ];

        let contentStartIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (contentStartPatterns.some(pattern => pattern.test(line))) {
                // Look back a few lines to include context
                contentStartIndex = Math.max(0, i - 2);
                break;
            }
        }

        if (contentStartIndex === -1) {
            console.warn('Could not find content start, using from line 100');
            contentStartIndex = 100; // Fallback
        }

        // Extract content lines (skip front matter)
        const contentLines = lines.slice(contentStartIndex);

        // Detect chapter boundaries
        const chapters = this.detectChapterBoundaries(contentLines, contentStartIndex);

        return {
            contentStartLine: contentStartIndex,
            totalLines: lines.length,
            skippedFrontMatter: contentStartIndex,
            chapters: chapters,
            statistics: {
                totalChapters: chapters.length,
                contentLines: contentLines.length,
                frontMatterSkipped: contentStartIndex
            }
        };
    }

    detectChapterBoundaries(lines, startOffset) {
        const chapters = [];
        let currentChapter = null;

        // Chapter detection patterns
        const chapterPatterns = [
            /^(INTRODUCTION|DISCOVERING THE NANOCOSM|LIFE ITSELF)/i,
            /^Chapter\s+\d+/i,
            /^[A-Z\s]{3,}$/  // All caps titles
        ];

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            const absoluteLineIndex = startOffset + index;

            // Check if this line starts a new chapter
            const isChapterStart = chapterPatterns.some(pattern => pattern.test(trimmed));

            if (isChapterStart && trimmed.length > 2) {
                // Close previous chapter
                if (currentChapter) {
                    currentChapter.endLine = absoluteLineIndex - 1;
                    currentChapter.lineCount = currentChapter.endLine - currentChapter.startLine + 1;
                    chapters.push(currentChapter);
                }

                // Start new chapter
                currentChapter = {
                    id: chapters.length + 1,
                    title: trimmed.substring(0, 80), // Limit title length
                    startLine: absoluteLineIndex,
                    endLine: null,
                    lineCount: 0,
                    rawContent: []
                };
            }

            // Add line to current chapter
            if (currentChapter) {
                currentChapter.rawContent.push(line);
            }
        });

        // Close final chapter
        if (currentChapter) {
            currentChapter.endLine = startOffset + lines.length - 1;
            currentChapter.lineCount = currentChapter.endLine - currentChapter.startLine + 1;
            chapters.push(currentChapter);
        }

        return chapters;
    }

    // Step 3: Extract pages and fix cross-page sentences
    extractPagesAndReconstruct(chapters) {
        const processedChapters = chapters.map(chapter => {
            const pages = this.extractPages(chapter.rawContent);
            const reconstructedPages = this.reconstructCrossPageSentences(pages);

            return {
                ...chapter,
                pages: reconstructedPages,
                statistics: {
                    totalPages: reconstructedPages.length,
                    totalReconstructions: reconstructedPages.reduce((sum, p) => sum + p.reconstructions.length, 0)
                }
            };
        });

        return {
            chapters: processedChapters,
            statistics: {
                totalChapters: processedChapters.length,
                totalPages: processedChapters.reduce((sum, c) => sum + c.pages.length, 0),
                totalReconstructions: processedChapters.reduce((sum, c) => sum + c.statistics.totalReconstructions, 0)
            }
        };
    }

    extractPages(contentLines) {
        const pages = [];
        let currentPage = null;

        contentLines.forEach((line, index) => {
            const trimmed = line.trim();

            // Detect page numbers (standalone numbers)
            const pageNumberMatch = /^\d+$/.test(trimmed) && trimmed.length <= 4;

            if (pageNumberMatch) {
                // Close previous page
                if (currentPage && currentPage.content.length > 0) {
                    pages.push(currentPage);
                }

                // Start new page
                currentPage = {
                    pageNumber: parseInt(trimmed),
                    content: [],
                    originalPageBreak: trimmed,
                    reconstructions: []
                };
            } else if (currentPage) {
                // Add content to current page
                if (trimmed.length > 0) { // Skip empty lines
                    currentPage.content.push(line);
                }
            } else {
                // No page detected yet, start first page
                currentPage = {
                    pageNumber: 1, // Default page number
                    content: [line],
                    originalPageBreak: null,
                    reconstructions: []
                };
            }
        });

        // Add final page
        if (currentPage && currentPage.content.length > 0) {
            pages.push(currentPage);
        }

        return pages;
    }

    reconstructCrossPageSentences(pages) {
        for (let i = 0; i < pages.length - 1; i++) {
            const currentPage = pages[i];
            const nextPage = pages[i + 1];

            if (currentPage.content.length === 0 || nextPage.content.length === 0) continue;

            const lastLine = currentPage.content[currentPage.content.length - 1];
            const firstLine = nextPage.content[0];

            // Check if last line needs sentence completion
            if (this.needsSentenceReconstruction(lastLine)) {
                const completion = this.findSentenceCompletion(nextPage.content);

                if (completion) {
                    const reconstruction = {
                        type: 'cross-page-sentence',
                        pageNumber: currentPage.pageNumber,
                        originalLastLine: lastLine,
                        originalFirstLine: firstLine,
                        reconstructedSentence: lastLine.trim() + ' ' + completion.text.trim(),
                        completionUsed: completion.text
                    };

                    // Apply reconstruction
                    currentPage.content[currentPage.content.length - 1] = reconstruction.reconstructedSentence;
                    currentPage.reconstructions.push(reconstruction);

                    // Remove used text from next page
                    if (completion.remainingText.trim()) {
                        nextPage.content[0] = completion.remainingText;
                    } else {
                        nextPage.content.shift(); // Remove first line entirely
                    }
                }
            }
        }

        return pages;
    }

    needsSentenceReconstruction(line) {
        const trimmed = line.trim();
        if (trimmed.length === 0) return false;

        // Check if line ends with proper sentence punctuation
        const endsWithPunctuation = /[.!?]$/.test(trimmed);

        // Check if it has words but no punctuation
        const hasWords = /[a-zA-Z]/.test(trimmed);
        const looksLikeHeader = /^[A-Z\s]+$/.test(trimmed) && trimmed.length < 50;

        return hasWords && !endsWithPunctuation && !looksLikeHeader;
    }

    findSentenceCompletion(contentLines) {
        let text = '';
        let linesUsed = 0;

        for (const line of contentLines) {
            const trimmed = line.trim();
            if (trimmed === '') continue;

            text += (text ? ' ' : '') + trimmed;
            linesUsed++;

            // Check if we found sentence punctuation
            const punctuationMatch = text.match(/^(.*?[.!?])\s*(.*)$/);
            if (punctuationMatch) {
                return {
                    text: punctuationMatch[1],
                    remainingText: punctuationMatch[2],
                    linesUsed: linesUsed
                };
            }

            // Safety: don't look too far
            if (linesUsed >= 3) break;
        }

        return null;
    }

    // Step 4: Extract paragraphs from cleaned pages
    extractParagraphs(chaptersWithPages) {
        const processedChapters = chaptersWithPages.chapters.map(chapter => {
            const pagesWithParagraphs = chapter.pages.map(page => {
                const paragraphs = this.detectParagraphs(page.content, page.pageNumber);

                return {
                    ...page,
                    paragraphs: paragraphs,
                    statistics: {
                        totalParagraphs: paragraphs.length,
                        validParagraphs: paragraphs.filter(p => p.isValid).length,
                        fr1Compliant: paragraphs.filter(p => p.fr1Compliant).length
                    }
                };
            });

            const allParagraphs = pagesWithParagraphs.flatMap(p => p.paragraphs);

            return {
                ...chapter,
                pages: pagesWithParagraphs,
                paragraphStatistics: {
                    totalParagraphs: allParagraphs.length,
                    validParagraphs: allParagraphs.filter(p => p.isValid).length,
                    fr1Compliant: allParagraphs.filter(p => p.fr1Compliant).length,
                    fr1ComplianceRate: allParagraphs.length > 0 ?
                        (allParagraphs.filter(p => p.fr1Compliant).length / allParagraphs.length * 100).toFixed(1) : 0
                }
            };
        });

        return {
            chapters: processedChapters,
            overallStatistics: {
                totalChapters: processedChapters.length,
                totalPages: processedChapters.reduce((sum, c) => sum + c.pages.length, 0),
                totalParagraphs: processedChapters.reduce((sum, c) => sum + c.paragraphStatistics.totalParagraphs, 0),
                totalValidParagraphs: processedChapters.reduce((sum, c) => sum + c.paragraphStatistics.validParagraphs, 0),
                totalFr1Compliant: processedChapters.reduce((sum, c) => sum + c.paragraphStatistics.fr1Compliant, 0),
                overallFr1Rate: null // Will calculate below
            }
        };
    }

    detectParagraphs(pageContent, pageNumber) {
        // Join content and split by double newlines
        const fullText = pageContent.join('\n');
        const paragraphTexts = fullText.split(/\n\s*\n+/);

        const paragraphs = paragraphTexts
            .map((text, index) => {
                const cleaned = this.cleanParagraphText(text);

                return {
                    index: index + 1,
                    pageNumber: pageNumber,
                    originalText: text,
                    cleanedText: cleaned,
                    wordCount: cleaned.split(/\s+/).length,
                    characterCount: cleaned.length,
                    isValid: this.validateParagraph(cleaned),
                    fr1Compliant: this.checkFR1Compliance(cleaned),
                    analysis: this.analyzeParagraph(cleaned)
                };
            })
            .filter(p => p.cleanedText.length > 10); // Minimum length filter

        return paragraphs;
    }

    cleanParagraphText(text) {
        return text
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/^\d+\s*/, '') // Remove leading page numbers
            .replace(/\[PAGE\s+\d+\]/g, '') // Remove page markers
            .trim();
    }

    validateParagraph(text) {
        return text.length >= 10 &&
            /[a-zA-Z]/.test(text) &&
            text.split(/\s+/).length >= 3;
    }

    checkFR1Compliance(text) {
        const startsWithCapital = /^[A-Z]/.test(text);
        const endsWithPunctuation = /[.!?]$/.test(text);
        return startsWithCapital && endsWithPunctuation;
    }

    analyzeParagraph(text) {
        return {
            startsWithCapital: /^[A-Z]/.test(text),
            endsWithPunctuation: /[.!?]$/.test(text),
            wordCount: text.split(/\s+/).length,
            hasMultipleSentences: (text.match(/[.!?]/g) || []).length > 1
        };
    }

    run() {
        console.log('=== IMPROVED PARAGRAPH DETECTION POC ===\n');
        const startTime = Date.now();

        try {
            // Step 1: Load raw text
            console.log('Step 1: Loading raw text...');
            const rawText = this.loadRawText();
            console.log(`✅ Loaded ${rawText.split('\n').length} lines\n`);

            // Step 2: Extract clean chapters
            console.log('Step 2: Extracting clean chapters...');
            const chaptersResult = this.extractCleanChapters(rawText);
            console.log(`✅ Found ${chaptersResult.statistics.totalChapters} chapters`);
            console.log(`✅ Skipped ${chaptersResult.statistics.frontMatterSkipped} lines of front matter\n`);

            // Save step 2 output
            fs.writeFileSync(
                path.join(this.outputDir, 'step2-clean-chapters.json'),
                JSON.stringify(chaptersResult, null, 2)
            );

            // Step 3: Extract pages and reconstruct sentences
            console.log('Step 3: Processing pages and reconstructing sentences...');
            const pagesResult = this.extractPagesAndReconstruct(chaptersResult.chapters);
            console.log(`✅ Processed ${pagesResult.statistics.totalPages} pages`);
            console.log(`✅ Made ${pagesResult.statistics.totalReconstructions} cross-page reconstructions\n`);

            // Save step 3 output
            fs.writeFileSync(
                path.join(this.outputDir, 'step3-pages-reconstructed.json'),
                JSON.stringify(pagesResult, null, 2)
            );

            // Step 4: Extract paragraphs
            console.log('Step 4: Extracting paragraphs from clean content...');
            const finalResult = this.extractParagraphs(pagesResult);

            // Calculate overall FR1 rate
            const totalParagraphs = finalResult.overallStatistics.totalParagraphs;
            const totalFr1 = finalResult.overallStatistics.totalFr1Compliant;
            finalResult.overallStatistics.overallFr1Rate = totalParagraphs > 0 ?
                (totalFr1 / totalParagraphs * 100).toFixed(1) : 0;

            console.log(`✅ Extracted ${finalResult.overallStatistics.totalParagraphs} paragraphs`);
            console.log(`✅ FR-1 Compliance: ${totalFr1}/${totalParagraphs} (${finalResult.overallStatistics.overallFr1Rate}%)\n`);

            // Save final output
            fs.writeFileSync(
                path.join(this.outputDir, 'step4-final-paragraphs.json'),
                JSON.stringify(finalResult, null, 2)
            );

            // Generate comparison report
            this.generateComparisonReport(finalResult);

            const endTime = Date.now();
            console.log('=== PIPELINE COMPLETE ===');
            console.log(`Processing time: ${endTime - startTime}ms`);
            console.log(`\nImprovement: FR-1 compliance should be significantly higher than 19%`);

        } catch (error) {
            console.error('Error in improved pipeline:', error.message);
            process.exit(1);
        }
    }

    generateComparisonReport(finalResult) {
        const report = {
            summary: {
                pipeline: 'Improved 4-Step Pipeline',
                totalChapters: finalResult.overallStatistics.totalChapters,
                totalPages: finalResult.overallStatistics.totalPages,
                totalParagraphs: finalResult.overallStatistics.totalParagraphs,
                fr1ComplianceRate: finalResult.overallStatistics.overallFr1Rate + '%',
                expectedImprovement: 'Should be significantly higher than previous 19% rate'
            },
            chapterBreakdown: finalResult.chapters.map(chapter => ({
                chapterTitle: chapter.title.substring(0, 50) + '...',
                pages: chapter.pages.length,
                paragraphs: chapter.paragraphStatistics.totalParagraphs,
                fr1Rate: chapter.paragraphStatistics.fr1ComplianceRate + '%',
                reconstructions: chapter.statistics.totalReconstructions
            })),
            firstFewParagraphs: finalResult.chapters[0]?.pages[0]?.paragraphs.slice(0, 3).map(p => ({
                text: p.cleanedText.substring(0, 100) + '...',
                fr1Compliant: p.fr1Compliant,
                startsWithCapital: p.analysis.startsWithCapital,
                endsWithPunctuation: p.analysis.endsWithPunctuation
            })) || []
        };

        fs.writeFileSync(
            path.join(this.outputDir, 'comparison-report.json'),
            JSON.stringify(report, null, 2)
        );

        console.log('\n=== COMPARISON WITH PREVIOUS APPROACH ===');
        console.log(`Previous FR-1 Rate: 19.0% (4/21 paragraphs)`);
        console.log(`New FR-1 Rate: ${finalResult.overallStatistics.overallFr1Rate}%`);
        console.log('\nKey improvements:');
        console.log('✅ Front matter filtering (Steps 1-2)');
        console.log('✅ Page-aware processing (Step 3)');
        console.log('✅ Cross-page sentence reconstruction (Step 3)');
        console.log('✅ Clean paragraph detection (Step 4)');
    }
}

// Run the POC
const poc = new ImprovedParagraphDetectionPOC();
poc.run(); 