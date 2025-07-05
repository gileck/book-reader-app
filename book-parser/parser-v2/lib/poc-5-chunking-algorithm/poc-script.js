const fs = require('fs');
const path = require('path');

class ChunkingAlgorithm {
    constructor() {
        this.outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Chunking parameters
        this.targetWordCount = { min: 80, ideal: 200, max: 300 };
        this.headerBuffer = 20; // Minimum words after header before chunking
    }

    loadInputData() {
        console.log('Loading input data from POC-3 and POC-4...');

        // Load paragraph results from POC-3
        const paragraphPath = path.join(__dirname, '../poc-3-paragraph-detection/output/poc-results.json');
        if (!fs.existsSync(paragraphPath)) {
            throw new Error('POC-3 results not found: ' + paragraphPath + '. Run POC-3 first.');
        }

        // Load header results from POC-4
        const headerPath = path.join(__dirname, '../poc-4-header-detection/output/poc-results.json');
        if (!fs.existsSync(headerPath)) {
            throw new Error('POC-4 results not found: ' + headerPath + '. Run POC-4 first.');
        }

        const paragraphData = JSON.parse(fs.readFileSync(paragraphPath, 'utf8'));
        const headerData = JSON.parse(fs.readFileSync(headerPath, 'utf8'));

        console.log('Loaded ' + paragraphData.summary.totalChapters + ' chapters from POC-3');
        console.log('Loaded header analysis from POC-4');

        return { paragraphData, headerData };
    }

    mergeDataSources(paragraphData, headerData) {
        // Merge paragraph and header data for each chapter
        const mergedChapters = [];

        paragraphData.chapters.forEach(chapter => {
            const headerChapter = headerData.chapters.find(h => h.chapterInfo.id === chapter.id);

            // Enhance paragraphs with header information
            const enhancedParagraphs = chapter.paragraphs.map((paragraph, index) => {
                const headerAnalysis = headerChapter ?
                    headerChapter.headerAnalyses[index] :
                    { isHeader: false, confidence: 0 };

                return {
                    ...paragraph,
                    isHeader: headerAnalysis.isHeader,
                    headerConfidence: headerAnalysis.confidence,
                    chunkable: !headerAnalysis.isHeader || headerAnalysis.confidence < 0.5
                };
            });

            mergedChapters.push({
                ...chapter,
                paragraphs: enhancedParagraphs,
                detectedHeaders: headerChapter ? headerChapter.detectedHeaders : []
            });
        });

        return mergedChapters;
    }

    createChunks(chapter) {
        const paragraphs = chapter.paragraphs;
        const chunks = [];
        let currentChunk = {
            paragraphs: [],
            wordCount: 0,
            characterCount: 0,
            startsWithHeader: false,
            headerText: null
        };

        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];

            // Check if this paragraph is a header
            if (paragraph.isHeader && paragraph.headerConfidence >= 0.3) {
                // If we have content in current chunk, finalize it
                if (currentChunk.paragraphs.length > 0) {
                    chunks.push(this.finalizeChunk(currentChunk, chunks.length + 1));
                    currentChunk = this.createNewChunk();
                }

                // Start new chunk with header
                currentChunk.startsWithHeader = true;
                currentChunk.headerText = paragraph.text.substring(0, 100);
                this.addParagraphToChunk(currentChunk, paragraph);
                continue;
            }

            // Add paragraph to current chunk
            this.addParagraphToChunk(currentChunk, paragraph);

            // Check if chunk should be finalized
            const shouldFinalize = this.shouldFinalizeChunk(currentChunk, paragraphs, i);

            if (shouldFinalize) {
                chunks.push(this.finalizeChunk(currentChunk, chunks.length + 1));
                currentChunk = this.createNewChunk();
            }
        }

        // Finalize any remaining chunk
        if (currentChunk.paragraphs.length > 0) {
            chunks.push(this.finalizeChunk(currentChunk, chunks.length + 1));
        }

        return chunks;
    }

    createNewChunk() {
        return {
            paragraphs: [],
            wordCount: 0,
            characterCount: 0,
            startsWithHeader: false,
            headerText: null
        };
    }

    addParagraphToChunk(chunk, paragraph) {
        chunk.paragraphs.push(paragraph);
        chunk.wordCount += paragraph.wordCount;
        chunk.characterCount += paragraph.text.length;
    }

    shouldFinalizeChunk(currentChunk, allParagraphs, currentIndex) {
        const nextParagraph = allParagraphs[currentIndex + 1];

        // Don't finalize if chunk is too small
        if (currentChunk.wordCount < this.targetWordCount.min) {
            return false;
        }

        // Finalize if chunk is at max size
        if (currentChunk.wordCount >= this.targetWordCount.max) {
            return true;
        }

        // Finalize if next paragraph is a header
        if (nextParagraph && nextParagraph.isHeader && nextParagraph.headerConfidence >= 0.3) {
            return true;
        }

        // Finalize if chunk is at ideal size and next paragraph would make it too large
        if (currentChunk.wordCount >= this.targetWordCount.ideal &&
            nextParagraph &&
            (currentChunk.wordCount + nextParagraph.wordCount) > this.targetWordCount.max) {
            return true;
        }

        return false;
    }

    finalizeChunk(chunkData, chunkIndex) {
        const combinedText = chunkData.paragraphs.map(p => p.text).join(' ');

        return {
            index: chunkIndex,
            text: combinedText,
            wordCount: chunkData.wordCount,
            characterCount: chunkData.characterCount,
            paragraphCount: chunkData.paragraphs.length,
            startsWithHeader: chunkData.startsWithHeader,
            headerText: chunkData.headerText,
            wordCountCategory: this.categorizeWordCount(chunkData.wordCount),
            paragraphIndices: chunkData.paragraphs.map(p => p.index)
        };
    }

    categorizeWordCount(wordCount) {
        if (wordCount < this.targetWordCount.min) return 'TooShort';
        if (wordCount <= this.targetWordCount.ideal) return 'Ideal';
        if (wordCount <= this.targetWordCount.max) return 'Good';
        return 'TooLong';
    }

    analyzeChunkingQuality(chunks) {
        const categories = { TooShort: 0, Ideal: 0, Good: 0, TooLong: 0 };
        const headerChunks = chunks.filter(c => c.startsWithHeader).length;
        const totalWords = chunks.reduce((sum, c) => sum + c.wordCount, 0);
        const avgWordsPerChunk = totalWords / chunks.length;

        chunks.forEach(chunk => {
            categories[chunk.wordCountCategory]++;
        });

        return {
            totalChunks: chunks.length,
            headerChunks: headerChunks,
            wordCountDistribution: categories,
            averageWordsPerChunk: Math.round(avgWordsPerChunk),
            totalWords: totalWords,
            qualityScore: this.calculateQualityScore(categories, chunks.length)
        };
    }

    calculateQualityScore(categories, totalChunks) {
        // Quality score based on how many chunks are in ideal range
        const idealChunks = categories.Ideal + categories.Good;
        return ((idealChunks / totalChunks) * 100).toFixed(1) + '%';
    }

    run() {
        console.log('=== POC-5: Chunking Algorithm ===\n');

        const startTime = Date.now();

        try {
            const { paragraphData, headerData } = this.loadInputData();
            const mergedChapters = this.mergeDataSources(paragraphData, headerData);

            const allResults = [];
            let totalChunks = 0;
            let totalWords = 0;

            console.log('Processing ' + mergedChapters.length + ' chapters for chunking...\n');

            mergedChapters.forEach((chapter, index) => {
                const chunks = this.createChunks(chapter);
                const analysis = this.analyzeChunkingQuality(chunks);

                totalChunks += chunks.length;
                totalWords += analysis.totalWords;

                console.log(`Chapter ${index + 1}: "${chapter.title}"`);
                console.log(`  Paragraphs: ${chapter.paragraphs.length}`);
                console.log(`  Chunks created: ${chunks.length}`);
                console.log(`  Header chunks: ${analysis.headerChunks}`);
                console.log(`  Word distribution: TooShort(${analysis.wordCountDistribution.TooShort}) Ideal(${analysis.wordCountDistribution.Ideal}) Good(${analysis.wordCountDistribution.Good}) TooLong(${analysis.wordCountDistribution.TooLong})`);
                console.log(`  Quality score: ${analysis.qualityScore}\n`);

                allResults.push({
                    chapterInfo: {
                        id: chapter.id,
                        title: chapter.title,
                        totalParagraphs: chapter.paragraphs.length
                    },
                    chunks: chunks,
                    analysis: analysis
                });
            });

            // Generate summary
            const summary = {
                totalChapters: mergedChapters.length,
                totalParagraphs: paragraphData.summary.totalParagraphs,
                totalChunks: totalChunks,
                totalWords: totalWords,
                averageChunksPerChapter: Math.round(totalChunks / mergedChapters.length),
                averageWordsPerChunk: Math.round(totalWords / totalChunks),
                processingTime: new Date().toISOString(),
                algorithm: 'Header-Aware Paragraph-Based Chunking',
                parameters: this.targetWordCount
            };

            const fullResults = {
                summary: summary,
                chapters: allResults
            };

            // Save full results
            const fullPath = path.join(this.outputDir, 'poc-results.json');
            fs.writeFileSync(fullPath, JSON.stringify(fullResults, null, 2));
            console.log('Full results saved to: ' + fullPath);

            // Save sample results (first few chunks from each chapter)
            const sampleResults = {
                summary: summary,
                sampleChapters: allResults.slice(0, 3).map(chapter => ({
                    ...chapter,
                    chunks: chapter.chunks.slice(0, 3) // First 3 chunks only
                }))
            };

            const samplePath = path.join(this.outputDir, 'sample-chunks.json');
            fs.writeFileSync(samplePath, JSON.stringify(sampleResults, null, 2));
            console.log('Sample chunks saved to: ' + samplePath);

            // Save chunking statistics
            const overallStats = this.generateOverallStatistics(allResults);
            const statsPath = path.join(this.outputDir, 'chunking-statistics.json');
            fs.writeFileSync(statsPath, JSON.stringify(overallStats, null, 2));
            console.log('Chunking statistics saved to: ' + statsPath);

            const endTime = Date.now();
            console.log('\n=== POC-5 Chunking Algorithm Complete ===');
            console.log('Processing time: ' + (endTime - startTime) + 'ms');
            console.log('Total chunks created: ' + totalChunks);
            console.log('Average words per chunk: ' + Math.round(totalWords / totalChunks));
            console.log('Overall quality score: ' + overallStats.overallQualityScore);

        } catch (error) {
            console.error('Error in POC-5:', error.message);
            process.exit(1);
        }
    }

    generateOverallStatistics(allResults) {
        const allCategories = { TooShort: 0, Ideal: 0, Good: 0, TooLong: 0 };
        let totalHeaderChunks = 0;
        let totalChunks = 0;

        allResults.forEach(chapter => {
            const dist = chapter.analysis.wordCountDistribution;
            allCategories.TooShort += dist.TooShort;
            allCategories.Ideal += dist.Ideal;
            allCategories.Good += dist.Good;
            allCategories.TooLong += dist.TooLong;
            totalHeaderChunks += chapter.analysis.headerChunks;
            totalChunks += chapter.analysis.totalChunks;
        });

        const idealChunks = allCategories.Ideal + allCategories.Good;
        const overallQuality = ((idealChunks / totalChunks) * 100).toFixed(1) + '%';

        return {
            overallWordCountDistribution: allCategories,
            totalHeaderChunks: totalHeaderChunks,
            headerChunkPercentage: ((totalHeaderChunks / totalChunks) * 100).toFixed(1) + '%',
            overallQualityScore: overallQuality,
            chunkSizeCompliance: {
                withinTarget: idealChunks,
                tooShort: allCategories.TooShort,
                tooLong: allCategories.TooLong,
                totalChunks: totalChunks
            }
        };
    }
}

// Run the POC
const chunker = new ChunkingAlgorithm();
chunker.run(); 