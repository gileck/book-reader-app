const fs = require('fs');
const path = require('path');

class ImprovedParagraphPipeline {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    // Step 1: Load raw text from POC 1
    loadRawText() {
        const textPath = path.join(__dirname, '../poc-1-text-extraction/output/pdf-parse-raw-text.txt');
        return fs.readFileSync(textPath, 'utf8');
    }

    // Step 2: Extract clean chapters (skip TOC/copyright)
    extractCleanChapters(rawText) {
        const lines = rawText.split('\n');

        // Skip front matter - look for actual content start
        let contentStart = this.findContentStart(lines);
        const contentLines = lines.slice(contentStart);

        // Detect chapter boundaries
        const chapters = this.detectChapters(contentLines, contentStart);

        return {
            frontMatterSkipped: contentStart,
            chapters: chapters,
            stats: {
                totalChapters: chapters.length,
                contentLines: contentLines.length
            }
        };
    }

    findContentStart(lines) {
        const contentPatterns = [
            /^INTRODUCTION/i,
            /^DISCOVERING THE NANOCOSM/i,
            /^Chapter\s+\d+/i
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (contentPatterns.some(pattern => pattern.test(line))) {
                return Math.max(0, i - 2); // Include some context
            }
        }
        return 100; // Fallback
    }

    detectChapters(lines, startOffset) {
        const chapters = [];
        let currentChapter = null;

        const chapterPatterns = [
            /^(INTRODUCTION|DISCOVERING THE NANOCOSM)/i,
            /^Chapter\s+\d+/i,
            /^[A-Z\s]{10,}$/ // Long uppercase titles
        ];

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            const isChapterStart = chapterPatterns.some(p => p.test(trimmed));

            if (isChapterStart && trimmed.length > 5) {
                // Close previous chapter
                if (currentChapter) {
                    chapters.push(currentChapter);
                }

                // Start new chapter
                currentChapter = {
                    id: chapters.length + 1,
                    title: trimmed.substring(0, 60),
                    startLine: startOffset + index,
                    content: []
                };
            }

            if (currentChapter) {
                currentChapter.content.push(line);
            }
        });

        if (currentChapter) {
            chapters.push(currentChapter);
        }

        return chapters;
    }

    // Step 3: Extract pages and fix cross-page sentences
    processPages(chapters) {
        return chapters.map(chapter => {
            const pages = this.extractPages(chapter.content);
            const fixedPages = this.fixCrossPageSentences(pages);

            return {
                ...chapter,
                pages: fixedPages,
                pageStats: {
                    totalPages: fixedPages.length,
                    reconstructions: fixedPages.reduce((sum, p) => sum + p.fixes.length, 0)
                }
            };
        });
    }

    extractPages(contentLines) {
        const pages = [];
        let currentPage = { pageNumber: 1, content: [], fixes: [] };

        contentLines.forEach(line => {
            const trimmed = line.trim();

            // Detect page numbers (standalone digits)
            if (/^\d+$/.test(trimmed) && trimmed.length <= 4) {
                if (currentPage.content.length > 0) {
                    pages.push(currentPage);
                }
                currentPage = {
                    pageNumber: parseInt(trimmed),
                    content: [],
                    fixes: []
                };
            } else if (trimmed.length > 0) {
                currentPage.content.push(line);
            }
        });

        if (currentPage.content.length > 0) {
            pages.push(currentPage);
        }

        return pages;
    }

    fixCrossPageSentences(pages) {
        for (let i = 0; i < pages.length - 1; i++) {
            const currentPage = pages[i];
            const nextPage = pages[i + 1];

            if (currentPage.content.length === 0) continue;

            const lastLine = currentPage.content[currentPage.content.length - 1];

            if (this.needsFix(lastLine) && nextPage.content.length > 0) {
                const completion = this.findCompletion(nextPage.content);

                if (completion) {
                    const fixed = lastLine.trim() + ' ' + completion.text.trim();
                    currentPage.content[currentPage.content.length - 1] = fixed;

                    currentPage.fixes.push({
                        original: lastLine,
                        fixed: fixed,
                        pageBreak: currentPage.pageNumber
                    });

                    // Remove used text from next page
                    if (completion.remaining.trim()) {
                        nextPage.content[0] = completion.remaining;
                    } else {
                        nextPage.content.shift();
                    }
                }
            }
        }

        return pages;
    }

    needsFix(line) {
        const trimmed = line.trim();
        return trimmed.length > 0 &&
            /[a-zA-Z]/.test(trimmed) &&
            !/[.!?]$/.test(trimmed) &&
            !/^[A-Z\s]+$/.test(trimmed); // Not a header
    }

    findCompletion(contentLines) {
        let text = '';

        for (let i = 0; i < Math.min(3, contentLines.length); i++) {
            const line = contentLines[i].trim();
            if (line === '') continue;

            text += (text ? ' ' : '') + line;

            const match = text.match(/^(.*?[.!?])\s*(.*)$/);
            if (match) {
                return {
                    text: match[1],
                    remaining: match[2]
                };
            }
        }

        return null;
    }

    // Step 4: Extract paragraphs from clean content
    extractParagraphs(chaptersWithPages) {
        return chaptersWithPages.map(chapter => {
            const pagesWithParagraphs = chapter.pages.map(page => {
                const paragraphs = this.detectParagraphs(page.content, page.pageNumber);

                return {
                    ...page,
                    paragraphs: paragraphs,
                    paragraphStats: {
                        total: paragraphs.length,
                        valid: paragraphs.filter(p => p.isValid).length,
                        fr1Compliant: paragraphs.filter(p => p.fr1Compliant).length
                    }
                };
            });

            const allParagraphs = pagesWithParagraphs.flatMap(p => p.paragraphs);

            return {
                ...chapter,
                pages: pagesWithParagraphs,
                chapterStats: {
                    totalParagraphs: allParagraphs.length,
                    fr1Compliant: allParagraphs.filter(p => p.fr1Compliant).length,
                    fr1Rate: allParagraphs.length > 0 ?
                        (allParagraphs.filter(p => p.fr1Compliant).length / allParagraphs.length * 100).toFixed(1) : 0
                }
            };
        });
    }

    detectParagraphs(pageContent, pageNumber) {
        const fullText = pageContent.join('\n');
        const chunks = fullText.split(/\n\s*\n+/);

        return chunks
            .map((chunk, index) => {
                const cleaned = this.cleanText(chunk);

                return {
                    index: index + 1,
                    pageNumber: pageNumber,
                    text: cleaned,
                    wordCount: cleaned.split(/\s+/).length,
                    isValid: this.isValidParagraph(cleaned),
                    fr1Compliant: this.checkFR1(cleaned),
                    analysis: {
                        startsWithCapital: /^[A-Z]/.test(cleaned),
                        endsWithPunctuation: /[.!?]$/.test(cleaned)
                    }
                };
            })
            .filter(p => p.text.length > 10);
    }

    cleanText(text) {
        return text
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^\d+\s*/, '')
            .replace(/\[PAGE\s+\d+\]/g, '')
            .trim();
    }

    isValidParagraph(text) {
        return text.length >= 10 &&
            /[a-zA-Z]/.test(text) &&
            text.split(/\s+/).length >= 3;
    }

    checkFR1(text) {
        return /^[A-Z]/.test(text) && /[.!?]$/.test(text);
    }

    run() {
        console.log('=== IMPROVED 4-STEP PARAGRAPH PIPELINE ===\n');

        try {
            // Step 1: Load raw text
            console.log('Step 1: Loading raw text...');
            const rawText = this.loadRawText();
            console.log(`✅ Loaded ${rawText.split('\n').length} lines\n`);

            // Step 2: Extract clean chapters
            console.log('Step 2: Extracting clean chapters...');
            const cleanChapters = this.extractCleanChapters(rawText);
            console.log(`✅ Found ${cleanChapters.stats.totalChapters} chapters`);
            console.log(`✅ Skipped ${cleanChapters.frontMatterSkipped} lines of front matter\n`);

            // Step 3: Process pages and fix sentences
            console.log('Step 3: Processing pages and fixing cross-page sentences...');
            const pagesResult = this.processPages(cleanChapters.chapters);
            const totalFixes = pagesResult.reduce((sum, c) => sum + c.pageStats.reconstructions, 0);
            console.log(`✅ Processed pages with ${totalFixes} sentence reconstructions\n`);

            // Step 4: Extract paragraphs
            console.log('Step 4: Extracting paragraphs...');
            const finalResult = this.extractParagraphs(pagesResult);

            // Calculate overall stats
            const totalParagraphs = finalResult.reduce((sum, c) => sum + c.chapterStats.totalParagraphs, 0);
            const totalFR1 = finalResult.reduce((sum, c) => sum + c.chapterStats.fr1Compliant, 0);
            const overallFR1Rate = totalParagraphs > 0 ? (totalFR1 / totalParagraphs * 100).toFixed(1) : 0;

            console.log(`✅ Extracted ${totalParagraphs} paragraphs`);
            console.log(`✅ FR-1 Compliance: ${totalFR1}/${totalParagraphs} (${overallFR1Rate}%)\n`);

            // Save outputs
            fs.writeFileSync(path.join(this.outputDir, 'improved-step2-chapters.json'),
                JSON.stringify(cleanChapters, null, 2));
            fs.writeFileSync(path.join(this.outputDir, 'improved-step3-pages.json'),
                JSON.stringify(pagesResult, null, 2));
            fs.writeFileSync(path.join(this.outputDir, 'improved-step4-paragraphs.json'),
                JSON.stringify(finalResult, null, 2));

            // Generate comparison
            this.generateComparison(overallFR1Rate, totalParagraphs, totalFR1, totalFixes);

        } catch (error) {
            console.error('Pipeline error:', error.message);
        }
    }

    generateComparison(newFR1Rate, totalParagraphs, totalFR1, totalFixes) {
        const comparison = {
            previousApproach: {
                fr1Rate: "19.0%",
                compliantParagraphs: "4/21",
                mainIssues: ["Page number breaks", "Incomplete sentences", "No front matter filtering"]
            },
            improvedApproach: {
                fr1Rate: newFR1Rate + "%",
                compliantParagraphs: `${totalFR1}/${totalParagraphs}`,
                improvements: [
                    "Front matter filtering",
                    `${totalFixes} cross-page sentence fixes`,
                    "Page-aware processing",
                    "Clean paragraph detection"
                ]
            },
            improvementFactor: (parseFloat(newFR1Rate) / 19.0).toFixed(1) + "x"
        };

        fs.writeFileSync(path.join(this.outputDir, 'pipeline-comparison.json'),
            JSON.stringify(comparison, null, 2));

        console.log('=== COMPARISON ===');
        console.log(`Previous approach: 19.0% FR-1 compliance`);
        console.log(`Improved approach: ${newFR1Rate}% FR-1 compliance`);
        console.log(`Improvement factor: ${comparison.improvementFactor}`);
        console.log(`Cross-page fixes applied: ${totalFixes}`);
    }
}

// Run the improved pipeline
const pipeline = new ImprovedParagraphPipeline();
pipeline.run(); 