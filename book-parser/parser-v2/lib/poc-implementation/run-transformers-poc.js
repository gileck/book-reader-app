#!/usr/bin/env node

/**
 * Run POC with Transformers PDF Book
 * 
 * This script runs the modular POC pipeline with the Transformers book PDF.
 * It sets up the correct paths and configuration for the test.
 * 
 * Usage:
 *   node run-transformers-poc.js [step] [--debug]
 * 
 * Examples:
 *   node run-transformers-poc.js all
 *   node run-transformers-poc.js text-extraction --debug
 *   node run-transformers-poc.js cross-page-merging --debug
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
    // Path to the Transformers PDF book
    PDF_PATH: path.join(__dirname, '../../../../files/Transformers/book.pdf'),
    
    // Main POC script
    MAIN_POC_SCRIPT: path.join(__dirname, 'main-poc.js'),
    
    // Test output directory
    OUTPUT_DIR: path.join(__dirname, 'transformers-output'),
    DEBUG_DIR: path.join(__dirname, 'transformers-debug')
};

// Ensure directories exist
function ensureDirectories() {
    [CONFIG.OUTPUT_DIR, CONFIG.DEBUG_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Validate setup
function validateSetup() {
    console.log('🔍 Validating setup...');
    
    // Check if PDF exists
    if (!fs.existsSync(CONFIG.PDF_PATH)) {
        console.error(`❌ PDF file not found: ${CONFIG.PDF_PATH}`);
        process.exit(1);
    }
    
    // Check if main POC script exists
    if (!fs.existsSync(CONFIG.MAIN_POC_SCRIPT)) {
        console.error(`❌ Main POC script not found: ${CONFIG.MAIN_POC_SCRIPT}`);
        process.exit(1);
    }
    
    console.log('✅ Setup validation complete');
    console.log(`📄 PDF: ${CONFIG.PDF_PATH}`);
    console.log(`📁 Output: ${CONFIG.OUTPUT_DIR}`);
    console.log(`🐛 Debug: ${CONFIG.DEBUG_DIR}`);
}

// Update main-poc.js CONFIG temporarily
function updateMainPocConfig() {
    const mainPocPath = CONFIG.MAIN_POC_SCRIPT;
    let mainPocContent = fs.readFileSync(mainPocPath, 'utf8');
    
    // Create backup
    const backupPath = mainPocPath + '.backup';
    fs.writeFileSync(backupPath, mainPocContent);
    
    // Update CONFIG paths
    const updatedConfig = `const CONFIG = {
    INPUT_PDF: '${CONFIG.PDF_PATH}',
    OUTPUT_DIR: '${CONFIG.OUTPUT_DIR}',
    DEBUG_DIR: '${CONFIG.DEBUG_DIR}',
    CHUNK_TARGET_MIN: 80,
    CHUNK_TARGET_MAX: 300,
    CHUNK_ABSOLUTE_MIN: 50,
    CHUNK_ABSOLUTE_MAX: 500
};`;
    
    // Replace the CONFIG section
    const configPattern = /const CONFIG = \{[^}]+\};/s;
    mainPocContent = mainPocContent.replace(configPattern, updatedConfig);
    
    fs.writeFileSync(mainPocPath, mainPocContent);
    
    return backupPath;
}

// Restore main-poc.js CONFIG
function restoreMainPocConfig(backupPath) {
    if (fs.existsSync(backupPath)) {
        const originalContent = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(CONFIG.MAIN_POC_SCRIPT, originalContent);
        fs.unlinkSync(backupPath);
    }
}

// Run main POC script
function runMainPoc(args) {
    console.log('🚀 Starting Transformers POC...');
    
    const child = spawn('node', [CONFIG.MAIN_POC_SCRIPT, ...args], {
        stdio: 'inherit',
        cwd: path.dirname(CONFIG.MAIN_POC_SCRIPT)
    });
    
    return new Promise((resolve, reject) => {
        child.on('close', (code) => {
            if (code === 0) {
                console.log('✅ POC completed successfully');
                resolve(code);
            } else {
                console.error(`❌ POC failed with code ${code}`);
                reject(new Error(`Process exited with code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            console.error('❌ Failed to start POC:', error.message);
            reject(error);
        });
    });
}

// Show usage
function showUsage() {
    console.log(`
Transformers POC Runner

Usage:
  node run-transformers-poc.js [step] [--debug]

Available steps:
  text-extraction     - Extract raw text from Transformers PDF
  chapter-detection   - Detect chapter boundaries
  cross-page-merging  - Merge split sentences across pages (CRITICAL)
  paragraph-detection - Detect paragraph boundaries
  header-detection    - Detect headers using 6-rule system
  chunking-algorithm  - Create chunks with target word count
  page-assignment     - Assign page numbers to chunks
  output-generation   - Generate final output files
  all                 - Run all steps in sequence

Options:
  --debug            - Enable detailed debug output

Examples:
  node run-transformers-poc.js all
  node run-transformers-poc.js text-extraction --debug
  node run-transformers-poc.js cross-page-merging --debug

Output:
  📁 ${CONFIG.OUTPUT_DIR}
  🐛 ${CONFIG.DEBUG_DIR}
`);
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        showUsage();
        return;
    }
    
    let backupPath = null;
    
    try {
        // Setup
        validateSetup();
        ensureDirectories();
        
        // Update main POC config temporarily
        backupPath = updateMainPocConfig();
        
        // Run POC
        await runMainPoc(args);
        
        // Show results
        console.log('\n📊 Results:');
        console.log(`📁 Output files: ${CONFIG.OUTPUT_DIR}`);
        console.log(`🐛 Debug files: ${CONFIG.DEBUG_DIR}`);
        
        // List output files
        if (fs.existsSync(CONFIG.OUTPUT_DIR)) {
            const outputFiles = fs.readdirSync(CONFIG.OUTPUT_DIR);
            if (outputFiles.length > 0) {
                console.log('\n📄 Generated files:');
                outputFiles.forEach(file => {
                    const filePath = path.join(CONFIG.OUTPUT_DIR, file);
                    const stats = fs.statSync(filePath);
                    console.log(`  - ${file} (${Math.round(stats.size / 1024)}KB)`);
                });
            }
        }
        
        // List debug files
        if (fs.existsSync(CONFIG.DEBUG_DIR)) {
            const debugFiles = fs.readdirSync(CONFIG.DEBUG_DIR);
            if (debugFiles.length > 0) {
                console.log('\n🐛 Debug files:');
                debugFiles.forEach(file => {
                    const filePath = path.join(CONFIG.DEBUG_DIR, file);
                    const stats = fs.statSync(filePath);
                    console.log(`  - ${file} (${Math.round(stats.size / 1024)}KB)`);
                });
            }
        }
        
    } catch (error) {
        console.error('💥 POC execution failed:', error.message);
        process.exit(1);
    } finally {
        // Restore original config
        if (backupPath) {
            restoreMainPocConfig(backupPath);
        }
    }
}

// Execute if called directly
if (require.main === module) {
    main();
}

module.exports = {
    main,
    CONFIG
}; 