// Real Transformers book processing data for testing
const fs = require('fs');
const path = require('path');

// Load expected results from the expected results JSON file
const expectedResultsPath = path.join(__dirname, 'transformers-expected-results.json');
let expectedResults = {};

try {
  if (fs.existsSync(expectedResultsPath)) {
    expectedResults = JSON.parse(fs.readFileSync(expectedResultsPath, 'utf8'));
  }
} catch (error) {
  console.error('Could not load expected results:', error.message);
}

// Load actual data from the real Transformers output files (if available for comparison)
const transformersOutputPath = path.join(__dirname, '../../../../../../files/Transformers/output.json');
const transformersSummaryPath = path.join(__dirname, '../../../../../../files/Transformers/summary.json');
const transformersRawTextPath = path.join(__dirname, '../../../../../../files/Transformers/raw-pdf-text.txt');

let actualOutput = {};
let actualSummary = {};
let actualRawText = '';

try {
  if (fs.existsSync(transformersOutputPath)) {
    actualOutput = JSON.parse(fs.readFileSync(transformersOutputPath, 'utf8'));
  }
  if (fs.existsSync(transformersSummaryPath)) {
    actualSummary = JSON.parse(fs.readFileSync(transformersSummaryPath, 'utf8'));
  }
  if (fs.existsSync(transformersRawTextPath)) {
    actualRawText = fs.readFileSync(transformersRawTextPath, 'utf8');
  }
} catch (error) {
  console.warn('Could not load actual Transformers data (using expected results for testing):', error.message);
}

// Generate sample data based on expected results
const sampleRawText = actualRawText || `




1
Praise for Transformer
'Nick Lane's exploration of the building blocks that underlie life's big
fundamental questions – the origin of life itself, ageing and disease –
have shaped my thinking since I first came across his work. He is one of
my favourite science writers.'
Bill Gates

3
TRANSFORMER
The deep chemistry of life and death
NICK LANE

8
INTRODUCTION
LIFE ITSELF
From space it looks grey and crystalline, obliterating the blue-green
colours of the living Earth. It is criss-crossed by irregular patterns and
convergent striations. There's a central amorphous density, where these
scratches seem lighter.

1
DISCOVERING THE NANOCOSM
Burlington House, Piccadilly, 1932. Its stately Victorian façades are
glittering with light at the fag-end of a particularly dismal November.`;

const sampleChapterMetadata = expectedResults.chapters ? expectedResults.chapters.map((ch, index) => ({
  title: ch.title,
  chapterNumber: index,
  startPosition: index * 1000,
  endPosition: (index + 1) * 1000,
  startingPage: ch.startPageNumber,
  confidence: 0.9,
  detectionSource: 'pdf_bookmarks'
})) : [];

const sampleChapters = expectedResults.chapters ? expectedResults.chapters.map((ch, index) => ({
  title: ch.title,
  chapterNumber: index,
  startingPage: ch.startPageNumber,
  content: ch.contentStartsWith + ' (sample content for testing)',
  wordCount: ch.expectedWordCount,
  pages: [{
    pageNumber: ch.startPageNumber,
    content: ch.contentStartsWith + ' (sample content for testing)',
    wordCount: Math.min(ch.expectedWordCount, 500)
  }]
})) : [];

const sampleParagraphs = sampleChapters.map(ch => ({
  title: ch.title,
  chapterNumber: ch.chapterNumber,
  paragraphs: [{
    pageNumber: ch.startingPage,
    content: ch.content.substring(0, 200) + '...',
    wordCount: Math.min(ch.wordCount, 200),
    sentencesCount: 5
  }]
}));

const sampleChunks = expectedResults.chapters ? expectedResults.chapters.flatMap((ch, chIndex) => 
  Array.from({ length: Math.min(ch.expectedChunkCount, 3) }, (_, index) => ({
    id: `chunk-${chIndex}-${index}`,
    chapterNumber: chIndex,
    content: ch.contentStartsWith + ` (chunk ${index + 1})`,
    wordCount: Math.round(ch.expectedWordCount / ch.expectedChunkCount),
    pageNumber: ch.startPageNumber + index,
    chunkIndex: index
  }))
) : [];

const sampleTextExtractionOutput = {
  rawText: sampleRawText,
  metadata: {
    processingStartTime: new Date().toISOString(),
    processingEndTime: null,
    stepResults: {
      'step-1': {
        success: true,
        duration: 600,
        timestamp: new Date().toISOString()
      }
    },
    textExtraction: {
      characterCount: sampleRawText.length,
      pageCount: expectedResults.book?.pageCount || 317,
      lineCount: sampleRawText.split('\n').length,
      wordCount: sampleRawText.split(/\s+/).length,
      literalNewlineCount: 0,
      extractionTime: new Date().toISOString(),
      averageWordsPerPage: Math.round(sampleRawText.split(/\s+/).length / (expectedResults.book?.pageCount || 317))
    }
  }
};

const sampleChapterDetectionOutput = {
  chapterMetadata: sampleChapterMetadata,
  metadata: {
    processingStartTime: new Date().toISOString(),
    processingEndTime: null,
    stepResults: {
      'step-1': { success: true, duration: 600, timestamp: new Date().toISOString() },
      'step-2-1': { success: true, duration: 700, timestamp: new Date().toISOString() }
    },
    textExtraction: sampleTextExtractionOutput.metadata.textExtraction,
    chapterDetection: {
      chaptersDetected: sampleChapterMetadata.length,
      tocSource: 'pdf_bookmarks',
      tocEntriesFound: sampleChapterMetadata.length,
      patternMatches: sampleChapterMetadata.length * 10,
      averageDetectionConfidence: 0.9,
      pageOffset: 0,
      processingTime: 700,
      detectionMethod: 'hybrid_v1_toc_detection'
    }
  }
};

const samplePageExtractionOutput = {
  chapters: sampleChapters,
  metadata: {
    processingStartTime: new Date().toISOString(),
    stepResults: {
      'step-1': { success: true, duration: 600 },
      'step-2-1': { success: true, duration: 700 },
      'step-2-2': { success: true, duration: 800 },
      'step-3': { success: true, duration: 900 }
    }
  }
};

const sampleParagraphOutput = {
  chapters: sampleParagraphs,
  metadata: {
    processingStartTime: new Date().toISOString(),
    stepResults: {
      'step-1': { success: true, duration: 600 },
      'step-2-1': { success: true, duration: 700 },
      'step-2-2': { success: true, duration: 800 },
      'step-3': { success: true, duration: 900 },
      'step-4': { success: true, duration: 1000 }
    }
  }
};

const sampleChunkingOutput = {
  chunks: sampleChunks,
  metadata: {
    totalChunks: sampleChunks.length,
    averageChunkSize: sampleChunks.length > 0 ? Math.round(sampleChunks.reduce((sum, chunk) => sum + chunk.wordCount, 0) / sampleChunks.length) : 0,
    maxChunkSize: sampleChunks.length > 0 ? Math.max(...sampleChunks.map(chunk => chunk.wordCount)) : 0,
    minChunkSize: sampleChunks.length > 0 ? Math.min(...sampleChunks.map(chunk => chunk.wordCount)) : 0
  }
};

module.exports = {
  sampleRawText,
  sampleChapterMetadata,
  sampleChapters,
  sampleParagraphs,
  sampleChunks,
  sampleTextExtractionOutput,
  sampleChapterDetectionOutput,
  samplePageExtractionOutput,
  sampleParagraphOutput,
  sampleChunkingOutput,
  expectedResults,
  actualOutput,
  actualSummary
}; 