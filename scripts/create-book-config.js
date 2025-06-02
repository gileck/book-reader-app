const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(text) {
    return new Promise(resolve => {
        rl.question(text, resolve);
    });
}

async function createBookConfig() {
    console.log('📚 Book Configuration Creator');
    console.log('This will help you create a configuration for parsing a specific book.\n');

    const bookId = await question('Enter a unique ID for this book (e.g., "my-book"): ');

    console.log('\n📖 Book Metadata:');
    const title = await question('Book title (optional, leave empty to auto-detect): ');
    const author = await question('Author name (optional, leave empty to auto-detect): ');

    console.log('\n🎯 Chapter Detection:');
    console.log('How should we detect the start of the actual content?');
    console.log('1. Skip everything until a specific chapter title (recommended)');
    console.log('2. Auto-detect based on content patterns');

    const startMethod = await question('Choose option (1 or 2): ');
    let startChapter = null;

    if (startMethod === '1') {
        startChapter = await question('Enter the exact title of the first chapter: ');
    }

    console.log('\n📝 Chapter Patterns:');
    console.log('What patterns should we use to detect chapter headings?');
    console.log('Current options:');
    console.log('1. All caps titles (e.g., "LIFE ITSELF")');
    console.log('2. "Chapter X" format');
    console.log('3. Numbered titles (e.g., "1. Introduction")');
    console.log('4. Special sections (Introduction, Epilogue, etc.)');

    const patterns = [];
    const useAllCaps = await question('Include all caps titles? (y/n): ');
    if (useAllCaps.toLowerCase() === 'y') {
        patterns.push('^[A-Z\\s]{5,30}$');
    }

    const useChapterFormat = await question('Include "Chapter X" format? (y/n): ');
    if (useChapterFormat.toLowerCase() === 'y') {
        patterns.push('^chapter\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\b');
    }

    const useNumbered = await question('Include numbered format "1. Title"? (y/n): ');
    if (useNumbered.toLowerCase() === 'y') {
        patterns.push('^(\\d+)\\.\\s+([A-Za-z][a-zA-Z\\s]{8,40})$');
    }

    const useSpecial = await question('Include special sections (Introduction, Epilogue, etc.)? (y/n): ');
    if (useSpecial.toLowerCase() === 'y') {
        patterns.push('^(introduction|conclusion|epilogue|prologue|preface|foreword|afterword)$');
    }

    console.log('\n🚫 Exclusion Patterns:');
    console.log('What sections should we exclude from chapters?');

    const excludePatterns = [];
    const defaultExclusions = [
        'appendix', 'bibliography', 'index', 'notes',
        'references', 'acknowledgements', 'about the author', 'glossary'
    ];

    for (const exclusion of defaultExclusions) {
        const include = await question(`Exclude "${exclusion}" sections? (y/n): `);
        if (include.toLowerCase() === 'y') {
            excludePatterns.push(exclusion);
        }
    }

    const customExclusions = await question('Any custom exclusions? (comma-separated, or empty): ');
    if (customExclusions.trim()) {
        excludePatterns.push(...customExclusions.split(',').map(s => s.trim().toLowerCase()));
    }

    // Create the configuration
    const config = {
        startChapter: startChapter || null,
        chapterPatterns: patterns,
        excludePatterns: excludePatterns.length > 0 ? [`^(${excludePatterns.join('|')})$`] : [],
        skipFrontMatter: startMethod === '1' || startChapter !== null,
        chapterNumbering: 'sequential',
        metadata: {
            title: title || null,
            author: author || null
        }
    };

    // Load existing configs and add new one
    const configPath = path.join(__dirname, 'book-config.json');
    let configs = {};

    if (fs.existsSync(configPath)) {
        configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    configs[bookId] = config;

    // Save the updated config
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));

    console.log('\n✅ Configuration created successfully!');
    console.log(`📄 Configuration saved as "${bookId}" in book-config.json`);
    console.log('\n🚀 You can now use it with:');
    console.log(`node parse-pdf-book-generic.js your-book.pdf ${bookId} output.json`);

    rl.close();
}

if (require.main === module) {
    createBookConfig().catch(console.error);
}

module.exports = { createBookConfig }; 