const fs = require('fs');
const path = require('path');

class HeaderDetector {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Header detection rules
        this.rules = {
            ALL_CAPS: { weight: 0.3, description: 'All capital letters' },
            SHORT_LENGTH: { weight: 0.2, description: 'Short length (3-8 words)' },
            NO_PERIOD: { weight: 0.15, description: 'No ending period' },
            ISOLATED_LINE: { weight: 0.15, description: 'Isolated line (blank lines before/after)' },
            BOLD_PATTERN: { weight: 0.1, description: 'Bold/formatting patterns' },
            SEMANTIC_PATTERN: { weight: 0.1, description: 'Semantic header patterns' }
        };
    }

    loadInputData() {
        console.log('Loading input data from POC-3...');

        // Load paragraph results from POC-3
        const paragraphPath = path.join(__dirname, '../poc-3-paragraph-detection/output/poc-results.json');
        if (!fs.existsSync(paragraphPath)) {
            throw new Error('POC-3 results not found: ' + paragraphPath + '. Run POC-3 first.');
        }

        const paragraphData = JSON.parse(fs.readFileSync(paragraphPath, 'utf8'));
        console.log('Loaded ' + paragraphData.summary.totalChapters + ' chapters from POC-3');

        return paragraphData;
    }

    // Rule 1: All caps check
    checkAllCaps(text) {
        const cleanText = text.replace(/[^A-Za-z]/g, '');
        if (cleanText.length === 0) return 0;

        const upperCount = (text.match(/[A-Z]/g) || []).length;
        const letterCount = cleanText.length;

        return upperCount / letterCount;
    }

    // Rule 2: Short length check (3-8 words ideal for headers)
    checkShortLength(text) {
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;

        if (wordCount >= 3 && wordCount <= 8) return 1.0;
        if (wordCount >= 2 && wordCount <= 10) return 0.7;
        if (wordCount >= 1 && wordCount <= 12) return 0.4;

        return 0;
    }

    // Rule 3: No period ending
    checkNoPeriod(text) {
        const trimmed = text.trim();
        return trimmed.endsWith('.') ? 0 : 1;
    }

    // Rule 4: Isolated line (approximated from paragraph context)
    checkIsolatedLine(paragraph, allParagraphs, index) {
        // Check if this is a very short paragraph (likely isolated)
        const wordCount = paragraph.wordCount;

        if (wordCount <= 8) return 1.0;
        if (wordCount <= 15) return 0.6;

        return 0;
    }

    // Rule 5: Bold/formatting patterns
    checkBoldPattern(text) {
        // Look for patterns that suggest formatting
        const patterns = [
            /^[A-Z][A-Z\s]+[A-Z]$/, // ALL CAPS words
            /^\d+\.\s*[A-Z]/, // Numbered sections
            /^Chapter\s+\d+/i, // Chapter headings
            /^[A-Z][a-z]+:/, // Title: format
            /^[A-Z]{2,}/, // Starts with multiple capitals
        ];

        return patterns.some(pattern => pattern.test(text.trim())) ? 1 : 0;
    }

    // Rule 6: Semantic patterns
    checkSemanticPattern(text) {
        const headerKeywords = [
            'introduction', 'conclusion', 'summary', 'overview', 'background',
            'methodology', 'results', 'discussion', 'references', 'appendix',
            'chapter', 'section', 'part', 'book', 'epilogue', 'preface',
            'acknowledgements', 'index', 'bibliography', 'glossary'
        ];

        const lowerText = text.toLowerCase();
        return headerKeywords.some(keyword => lowerText.includes(keyword)) ? 1 : 0;
    }

    analyzeHeader(paragraph, allParagraphs, index) {
        const text = paragraph.text;

        const scores = {
            allCaps: this.checkAllCaps(text),
            shortLength: this.checkShortLength(text),
            noPeriod: this.checkNoPeriod(text),
            isolatedLine: this.checkIsolatedLine(paragraph, allParagraphs, index),
            boldPattern: this.checkBoldPattern(text),
            semanticPattern: this.checkSemanticPattern(text)
        };

        // Calculate weighted score
        let totalScore = 0;
        let explanation = [];

        // Fixed the rule mapping issue
        const ruleMapping = {
            allCaps: 'ALL_CAPS',
            shortLength: 'SHORT_LENGTH',
            noPeriod: 'NO_PERIOD',
            isolatedLine: 'ISOLATED_LINE',
            boldPattern: 'BOLD_PATTERN',
            semanticPattern: 'SEMANTIC_PATTERN'
        };

        Object.entries(scores).forEach(([ruleName, score]) => {
            const ruleKey = ruleMapping[ruleName];
            const rule = this.rules[ruleKey];
            if (rule) {
                const weightedScore = score * rule.weight;
                totalScore += weightedScore;

                if (score > 0.5) {
                    explanation.push(`${rule.description}: ${(score * 100).toFixed(0)}%`);
                }
            }
        });

        // Debug logging for first few paragraphs
        if (index < 3) {
            console.log(`    DEBUG: Paragraph ${index + 1}: "${text.substring(0, 50)}..."`);
            console.log(`    Scores: allCaps=${scores.allCaps.toFixed(2)}, shortLength=${scores.shortLength.toFixed(2)}, noPeriod=${scores.noPeriod.toFixed(2)}`);
            console.log(`    Total score: ${totalScore.toFixed(2)}, isHeader: ${totalScore >= 0.3}\n`);
        }

        return {
            isHeader: totalScore >= 0.3, // Lowered threshold for testing
            confidence: totalScore,
            scores: scores,
            explanation: explanation,
            text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
        };
    }

    processChapter(chapter) {
        const paragraphs = chapter.paragraphs;
        const headerAnalyses = [];
        const detectedHeaders = [];

        paragraphs.forEach((paragraph, index) => {
            const analysis = this.analyzeHeader(paragraph, paragraphs, index);
            headerAnalyses.push(analysis);

            if (analysis.isHeader) {
                detectedHeaders.push({
                    paragraphIndex: index + 1,
                    text: paragraph.text,
                    confidence: analysis.confidence,
                    wordCount: paragraph.wordCount,
                    explanation: analysis.explanation
                });
            }
        });

        return {
            chapterInfo: {
                id: chapter.id,
                title: chapter.title,
                totalParagraphs: paragraphs.length
            },
            headerAnalyses: headerAnalyses,
            detectedHeaders: detectedHeaders,
            statistics: {
                totalParagraphs: paragraphs.length,
                headersDetected: detectedHeaders.length,
                headerRate: (detectedHeaders.length / paragraphs.length * 100).toFixed(1) + '%',
                averageConfidence: detectedHeaders.length > 0 ?
                    (detectedHeaders.reduce((sum, h) => sum + h.confidence, 0) / detectedHeaders.length).toFixed(2) : 0
            }
        };
    }

    run() {
        console.log('=== POC-4: Header Detection ===\n');

        const startTime = Date.now();

        try {
            const paragraphData = this.loadInputData();
            const chapters = paragraphData.chapters;

            const allResults = [];
            let totalHeaders = 0;
            let totalParagraphs = 0;

            console.log('Processing ' + chapters.length + ' chapters for header detection...\n');

            chapters.forEach((chapter, index) => {
                const result = this.processChapter(chapter);
                allResults.push(result);

                totalHeaders += result.detectedHeaders.length;
                totalParagraphs += result.chapterInfo.totalParagraphs;

                console.log(`Chapter ${index + 1}: "${chapter.title}"`);
                console.log(`  Paragraphs: ${result.chapterInfo.totalParagraphs}`);
                console.log(`  Headers detected: ${result.detectedHeaders.length} (${result.statistics.headerRate})`);
                console.log(`  Average confidence: ${result.statistics.averageConfidence}\n`);
            });

            // Generate summary
            const summary = {
                totalChapters: chapters.length,
                totalParagraphs: totalParagraphs,
                totalHeaders: totalHeaders,
                overallHeaderRate: (totalHeaders / totalParagraphs * 100).toFixed(1) + '%',
                processingTime: new Date().toISOString(),
                algorithm: '6-Rule Header Detection',
                rules: this.rules
            };

            const fullResults = {
                summary: summary,
                chapters: allResults
            };

            // Save full results
            const fullPath = path.join(this.outputDir, 'poc-results.json');
            fs.writeFileSync(fullPath, JSON.stringify(fullResults, null, 2));
            console.log('Full results saved to: ' + fullPath);

            // Save sample results (high confidence headers only)
            const sampleResults = {
                summary: summary,
                highConfidenceHeaders: this.extractHighConfidenceHeaders(allResults)
            };

            const samplePath = path.join(this.outputDir, 'sample-headers.json');
            fs.writeFileSync(samplePath, JSON.stringify(sampleResults, null, 2));
            console.log('Sample headers saved to: ' + samplePath);

            // Save header statistics
            const stats = this.generateStatistics(allResults);
            const statsPath = path.join(this.outputDir, 'header-statistics.json');
            fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
            console.log('Header statistics saved to: ' + statsPath);

            const endTime = Date.now();
            console.log('\n=== POC-4 Header Detection Complete ===');
            console.log('Processing time: ' + (endTime - startTime) + 'ms');
            console.log('Total headers detected: ' + totalHeaders);
            console.log('Overall header detection rate: ' + summary.overallHeaderRate);

        } catch (error) {
            console.error('Error in POC-4:', error.message);
            process.exit(1);
        }
    }

    extractHighConfidenceHeaders(allResults) {
        const highConfidenceHeaders = [];

        allResults.forEach(chapterResult => {
            const highConfHeaders = chapterResult.detectedHeaders.filter(h => h.confidence >= 0.7);
            if (highConfHeaders.length > 0) {
                highConfidenceHeaders.push({
                    chapter: chapterResult.chapterInfo.title,
                    headers: highConfHeaders
                });
            }
        });

        return highConfidenceHeaders;
    }

    generateStatistics(allResults) {
        const confidenceBuckets = { low: 0, medium: 0, high: 0 };
        const ruleCounts = { ALL_CAPS: 0, SHORT_LENGTH: 0, NO_PERIOD: 0, ISOLATED_LINE: 0, BOLD_PATTERN: 0, SEMANTIC_PATTERN: 0 };

        allResults.forEach(chapterResult => {
            chapterResult.detectedHeaders.forEach(header => {
                if (header.confidence < 0.5) confidenceBuckets.low++;
                else if (header.confidence < 0.8) confidenceBuckets.medium++;
                else confidenceBuckets.high++;
            });
        });

        return {
            confidenceDistribution: confidenceBuckets,
            totalHeadersAnalyzed: allResults.reduce((sum, r) => sum + r.detectedHeaders.length, 0),
            averageHeadersPerChapter: (allResults.reduce((sum, r) => sum + r.detectedHeaders.length, 0) / allResults.length).toFixed(1)
        };
    }
}

// Run the POC
const detector = new HeaderDetector();
detector.run(); 