/**
 * Sample test data and fixtures for POC implementation tests
 */

const sampleRawText = `
--- PAGE 1 ---
The Complete Guide to Modern Development

Table of Contents

Chapter 1: Introduction to Modern Development ..................... 3
Chapter 2: Setting Up Your Environment ............................ 15
Chapter 3: Core Concepts and Principles .......................... 28
Chapter 4: Building Your First Application ....................... 42
Chapter 5: Advanced Techniques and Best Practices ................ 65
Chapter 6: Testing and Quality Assurance ......................... 89
Chapter 7: Deployment and Production Considerations .............. 112
Chapter 8: Future Trends and Emerging Technologies ............... 135

--- END PAGE 1 ---

--- PAGE 2 ---

Preface

Welcome to the world of modern development. This book aims to provide a comprehensive guide to the latest practices and techniques in software development. Whether you're a beginner or an experienced developer, you'll find valuable insights and practical advice throughout these pages.

--- END PAGE 2 ---

--- PAGE 3 ---

Chapter 1: Introduction to Modern Development

Modern development has evolved significantly over the past decade. The landscape of software development continues to change rapidly, with new frameworks, tools, and methodologies emerging regularly. This chapter will provide you with a foundational understanding of what modern development entails.

The core principles of modern development include:
- Agile methodologies
- Continuous integration and deployment
- Test-driven development
- Clean code practices
- Collaborative development approaches

These principles form the backbone of successful modern development practices.

--- END PAGE 3 ---

--- PAGE 4 ---

The Evolution of Development Practices

Over the years, development practices have shifted from traditional waterfall models to more iterative and collaborative approaches. This evolution has been driven by the need for faster delivery, better quality, and improved team collaboration.

Modern development emphasizes:
1. Rapid prototyping
2. User feedback integration
3. Continuous improvement
4. Cross-functional collaboration

--- END PAGE 4 ---

--- PAGE 15 ---

Chapter 2: Setting Up Your Environment

Setting up a proper development environment is crucial for productivity and success. This chapter will guide you through the essential tools and configurations needed for modern development.

Essential tools include:
- Version control systems (Git)
- Integrated development environments (IDEs)
- Package managers
- Testing frameworks
- Continuous integration platforms

Each of these tools plays a vital role in the development workflow.

--- END PAGE 15 ---

--- PAGE 28 ---

Chapter 3: Core Concepts and Principles

Understanding the core concepts and principles of modern development is essential for building robust applications. This chapter covers fundamental concepts that every developer should master.

Key concepts include:
- Design patterns
- SOLID principles
- Clean architecture
- Dependency injection
- Error handling strategies

These concepts provide the foundation for writing maintainable and scalable code.

--- END PAGE 28 ---
`;

const sampleChapterMetadata = [
    {
        title: "Introduction to Modern Development",
        chapterNumber: 1,
        startPosition: 850,
        endPosition: 1350,
        startingPage: 3,
        confidence: 0.95,
        detectionSource: "toc_analysis"
    },
    {
        title: "Setting Up Your Environment", 
        chapterNumber: 2,
        startPosition: 1750,
        endPosition: 2200,
        startingPage: 15,
        confidence: 0.90,
        detectionSource: "toc_analysis"
    },
    {
        title: "Core Concepts and Principles",
        chapterNumber: 3,
        startPosition: 2600,
        endPosition: 3100,
        startingPage: 28,
        confidence: 0.92,
        detectionSource: "toc_analysis"
    }
];

const sampleChapters = [
    {
        title: "Introduction to Modern Development",
        chapterNumber: 1,
        content: "Modern development has evolved significantly over the past decade. The landscape of software development continues to change rapidly, with new frameworks, tools, and methodologies emerging regularly. This chapter will provide you with a foundational understanding of what modern development entails.\n\nThe core principles of modern development include:\n- Agile methodologies\n- Continuous integration and deployment\n- Test-driven development\n- Clean code practices\n- Collaborative development approaches\n\nThese principles form the backbone of successful modern development practices.",
        startingPage: 3,
        paragraphs: [],
        headers: [],
        chunks: []
    },
    {
        title: "Setting Up Your Environment",
        chapterNumber: 2,
        content: "Setting up a proper development environment is crucial for productivity and success. This chapter will guide you through the essential tools and configurations needed for modern development.\n\nEssential tools include:\n- Version control systems (Git)\n- Integrated development environments (IDEs)\n- Package managers\n- Testing frameworks\n- Continuous integration platforms\n\nEach of these tools plays a vital role in the development workflow.",
        startingPage: 15,
        paragraphs: [],
        headers: [],
        chunks: []
    }
];

const sampleParagraphs = [
    {
        content: "Modern development has evolved significantly over the past decade. The landscape of software development continues to change rapidly, with new frameworks, tools, and methodologies emerging regularly.",
        startPosition: 850,
        endPosition: 1050,
        chapterNumber: 1,
        paragraphIndex: 0,
        wordCount: 25,
        isHeader: false
    },
    {
        content: "The core principles of modern development include:\n- Agile methodologies\n- Continuous integration and deployment\n- Test-driven development\n- Clean code practices\n- Collaborative development approaches",
        startPosition: 1051,
        endPosition: 1300,
        chapterNumber: 1,
        paragraphIndex: 1,
        wordCount: 20,
        isHeader: false
    }
];

const sampleChunks = [
    {
        id: "chunk-1-1",
        chapterNumber: 1,
        chapterTitle: "Introduction to Modern Development",
        content: "Modern development has evolved significantly over the past decade. The landscape of software development continues to change rapidly, with new frameworks, tools, and methodologies emerging regularly. This chapter will provide you with a foundational understanding of what modern development entails. The core principles of modern development include: Agile methodologies, Continuous integration and deployment, Test-driven development, Clean code practices, and Collaborative development approaches.",
        wordCount: 78,
        startPosition: 850,
        endPosition: 1350,
        pageNumbers: [3, 4],
        paragraphIds: ["p-1-1", "p-1-2"],
        headers: []
    },
    {
        id: "chunk-2-1", 
        chapterNumber: 2,
        chapterTitle: "Setting Up Your Environment",
        content: "Setting up a proper development environment is crucial for productivity and success. This chapter will guide you through the essential tools and configurations needed for modern development. Essential tools include: Version control systems (Git), Integrated development environments (IDEs), Package managers, Testing frameworks, and Continuous integration platforms.",
        wordCount: 52,
        startPosition: 1750,
        endPosition: 2200,
        pageNumbers: [15],
        paragraphIds: ["p-2-1"],
        headers: []
    }
];

const sampleConfig = {
    INPUT_PDF: '/path/to/test.pdf',
    OUTPUT_DIR: '/tmp/test-output',
    DEBUG_DIR: '/tmp/test-debug',
    CHUNK_TARGET_MIN: 80,
    CHUNK_TARGET_MAX: 300,
    CHUNK_ABSOLUTE_MIN: 50,
    CHUNK_ABSOLUTE_MAX: 500
};

const sampleInitialState = {
    rawText: null,
    chapterMetadata: [],
    chapters: [],
    mergedChapters: [],
    paragraphs: [],
    headers: [],
    chunks: [],
    pages: [],
    finalOutput: null,
    metadata: {
        processingStartTime: null,
        processingEndTime: null,
        stepResults: {}
    }
};

module.exports = {
    sampleRawText,
    sampleChapterMetadata,
    sampleChapters,
    sampleParagraphs,
    sampleChunks,
    sampleConfig,
    sampleInitialState
}; 